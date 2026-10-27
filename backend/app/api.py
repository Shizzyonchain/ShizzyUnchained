import asyncio
import hmac
import json
import logging
import uuid
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timedelta, timezone

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db import close, connect
from app.models import MassWalletRequest
from app.liquidation import liquidation_join
from app.yield_math import subnet_reward_estimate
from app.trading import trading_snapshot

settings = get_settings()
log = logging.getLogger("shizzy.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await connect()
    app.state.screener_cache = None
    app.state.candle_cache = {}
    app.state.candle_refreshing = set()
    app.state.candle_tasks = {}
    app.state.screener_refresh_task = None
    try:
        await asyncio.wait_for(_refresh_screener(app), timeout=10)
    except Exception as exc:
        log.warning("initial screener history warmup failed: %s", type(exc).__name__)
    app.state.screener_refresh_task = asyncio.create_task(_keep_screener_warm(app))
    yield
    app.state.screener_refresh_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.screener_refresh_task
    await close()


app = FastAPI(title="ShizzyUnchained Subtensor API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)


@app.get("/v1/market/trading")
async def node_trading(period: str = Query('24h', pattern='^(1h|24h)$'), x_api_key: str | None = Header(None)):
    await authorize(x_api_key)
    try:
        return await trading_snapshot(app.state.db, period)
    except ValueError as exc:
        since = await app.state.db.fetchval("SELECT min(block_time) FROM market_trade_blocks_v2")
        headers = {"X-Trade-History-Since": since.isoformat()} if since else {}
        raise HTTPException(503, str(exc), headers=headers) from exc


async def authorize(x_api_key: str | None = Header(None)):
    if settings.public_reads:
        return
    if not x_api_key or not any(hmac.compare_digest(x_api_key, key) for key in settings.api_keys):
        raise HTTPException(401, "Missing or invalid API key")


class YieldCheckRow(BaseModel):
    hotkey: str = Field(pattern=r"^[1-9A-HJ-NP-Za-km-z]{48}$")
    block: int = Field(ge=216000)
    timestamp: datetime
    seven: float | None = Field(default=None, allow_inf_nan=False)
    thirty: float | None = Field(default=None, allow_inf_nan=False)


class YieldCheckRequest(BaseModel):
    netuid: int = Field(ge=1, le=1024)
    rows: list[YieldCheckRow] = Field(min_length=1, max_length=512)
    watch: bool = True


@app.post("/v1/validators/yield-checks")
async def queue_yield_check(payload: YieldCheckRequest, x_api_key: str | None = Header(None)):
    # Queue writes always require the server credential, even with public reads.
    if not x_api_key or not any(hmac.compare_digest(x_api_key, key) for key in settings.api_keys):
        raise HTTPException(401, "Missing or invalid API key")
    now = datetime.now(timezone.utc)
    if any(row.timestamp.tzinfo is None or not -60 <= (now - row.timestamp).total_seconds() <= 7200 for row in payload.rows):
        raise HTTPException(400, "Fresh dated yield sources required")
    if len({row.hotkey for row in payload.rows}) != len(payload.rows) or len({row.block for row in payload.rows}) != 1:
        raise HTTPException(400, "Unique hotkeys at one provider block required")
    if payload.watch:
        await app.state.db.execute("UPDATE validator_yield_checks SET last_viewed_at=now() WHERE netuid=$1", payload.netuid)
    accepted = await app.state.db.fetchval("""INSERT INTO validator_yield_checks(netuid,payload)
        VALUES($1,$2::jsonb) ON CONFLICT(netuid) DO UPDATE SET
        payload=EXCLUDED.payload,state='queued',requested_at=now(),error=NULL
        WHERE validator_yield_checks.state NOT IN ('queued','running')
          AND (validator_yield_checks.requested_at<now()-interval '1 hour'
            OR (validator_yield_checks.requested_at<now()-interval '15 minutes'
                AND validator_yield_checks.payload->'rows'->0->>'block' IS DISTINCT FROM EXCLUDED.payload->'rows'->0->>'block')
            OR (validator_yield_checks.result IS NOT NULL
                AND COALESCE((validator_yield_checks.result->>'methodVersion')::int,0)<>4))
        RETURNING netuid""", payload.netuid, payload.model_dump_json())
    return {"queued": accepted is not None, "netuid": payload.netuid}


@app.get("/v1/validators/yield-checks", dependencies=[Depends(authorize)])
async def read_yield_check(netuid: int = Query(ge=1, le=1024)):
    row = await app.state.db.fetchrow("""SELECT state,result,checked_at,error
        FROM validator_yield_checks WHERE netuid=$1""", netuid)
    if not row:
        return {"netuid": netuid, "state": "pending", "rows": []}
    result = json.loads(row["result"]) if isinstance(row["result"], str) else row["result"]
    return {"netuid": netuid, "state": row["state"], "result": result,
            "checkedAt": row["checked_at"], "error": row["error"]}


@app.get("/v1/validators/yield-watch", dependencies=[Depends(authorize)])
async def yield_watch():
    rows = await app.state.db.fetch("""SELECT netuid FROM validator_yield_checks
        WHERE state NOT IN ('queued','running') AND last_viewed_at>now()-interval '24 hours'
          AND requested_at<now()-interval '1 hour'
        ORDER BY requested_at LIMIT 2""")
    return {"netuids": [row["netuid"] for row in rows]}


@app.get("/livez")
async def liveness():
    """Render liveness probe; deliberately never waits on Postgres or Finney."""
    return {"status": "ok"}


async def _health_details():
    await app.state.db.fetchval("SELECT 1")
    latest = await app.state.db.fetchrow(
        "SELECT block_number, block_time, indexed_at FROM chain_blocks ORDER BY block_number DESC LIMIT 1"
    )
    if not latest:
        return {
            "status": "degraded",
            "reason": "indexer has not stored a block yet",
            "latest_indexed_block": None,
        }
    latest_market = await app.state.db.fetchrow(
        """SELECT block_number,time
           FROM subnet_latest_samples
           WHERE netuid=0
           ORDER BY time DESC,block_number DESC LIMIT 1"""
    )
    now = datetime.now(timezone.utc)
    chain_lag_seconds = (now - latest["block_time"]).total_seconds()
    market_lag_seconds = (
        (now - latest_market["time"]).total_seconds()
        if latest_market else float("inf")
    )
    details = {
        "latest_indexed_block": dict(latest),
        "latest_market_snapshot": dict(latest_market) if latest_market else None,
        "chain_lag_seconds": round(chain_lag_seconds),
        "market_lag_seconds": (
            round(market_lag_seconds) if latest_market else None
        ),
    }
    if chain_lag_seconds > 180:
        return {
            "status": "degraded",
            "reason": f"finalized block stale by {int(chain_lag_seconds)} seconds",
            **details,
        }
    if market_lag_seconds > 90:
        return {
            "status": "degraded",
            "reason": f"market prices stale by {int(market_lag_seconds)} seconds",
            **details,
        }
    return {"status": "ok", **details}


@app.get("/healthz")
async def health():
    try:
        details = await asyncio.wait_for(_health_details(), timeout=3)
        if details["status"] != "ok":
            return JSONResponse(status_code=503, content=jsonable_encoder(details))
        return details
    except Exception as exc:
        raise HTTPException(503, f"database unavailable: {type(exc).__name__}") from exc


@app.get("/v1/subnets/prices", dependencies=[Depends(authorize)])
async def current_prices():
    rows = await app.state.db.fetch(
        """SELECT DISTINCT ON (p.netuid) p.netuid,s.name,s.symbol,p.time,p.block_number,
                  p.price_tao,p.tao_reserve,p.alpha_reserve,p.alpha_out,p.volume_tao
           FROM subnet_latest_samples p LEFT JOIN subnets s USING(netuid)
           ORDER BY p.netuid,p.time DESC,p.block_number DESC"""
    )
    return {"data": [dict(row) for row in rows]}


async def _refresh_live_screener(current_app: FastAPI):
    """Fetch the constant-size latest-price table without scanning history."""
    rows = await current_app.state.db.fetch(
        f"""SELECT p.netuid,s.name,s.symbol,s.description,s.website,s.github_repo,
                  s.discord,s.contact,s.logo_url,s.additional,p.time,p.block_number,p.price_tao,
                  p.tao_reserve,p.alpha_reserve,p.alpha_out,
                  liq.liquidation_price_tao,liq.time AS liquidation_time,
                  100 * (liq.liquidation_price_tao / NULLIF(p.price_tao,0) - 1)
                    AS liquidation_diff_pct,
                  100 * p.emission_share AS emission_pct,
                  p.tempo,
                  p.staker_epoch_dividends_alpha,
                  p.circulating_alpha,
                  p.alpha_reserve,
                  p.conviction_locked_alpha,
                  CASE WHEN p.conviction_locked_alpha IS NULL
                         OR COALESCE(p.alpha_out, 0) <= 0
                       THEN NULL ELSE
                    100 * p.conviction_locked_alpha / p.alpha_out
                  END AS conviction_locked_pct,
                  (p.price_tao * p.circulating_alpha)
                    AS market_cap_tao
           FROM subnet_latest_samples p
           JOIN subnets s ON s.netuid=p.netuid
           {liquidation_join("p")}
           ORDER BY p.netuid"""
    )
    live_by_netuid = {row["netuid"]: {**dict(row), **subnet_reward_estimate(row)} for row in rows}
    cached = current_app.state.screener_cache
    if cached:
        merged = []
        for old_row in cached["data"]:
            row = dict(old_row)
            row.update(live_by_netuid.pop(row["netuid"], {}))
            if row.get("emission_share_24h") is not None and row.get("emission_pct") is not None:
                row["emission_change_24h"] = row["emission_pct"] - 100 * row["emission_share_24h"]
            merged.append(row)
        merged.extend(live_by_netuid.values())
    else:
        merged = list(live_by_netuid.values())
    current_app.state.screener_cache = {
        "data": merged,
        "cached_at": datetime.now(timezone.utc),
    }
    return current_app.state.screener_cache


async def _refresh_screener(current_app: FastAPI):
    rows = await current_app.state.db.fetch(
        f"""WITH latest AS (
             SELECT netuid,time,block_number,price_tao,tao_reserve,
                    alpha_reserve,alpha_out,volume_tao,tao_in_emission,alpha_out_emission,
                    emission_share,root_prop,conviction_locked_alpha,tempo,
                    staker_epoch_dividends_alpha,circulating_alpha
             FROM subnet_latest_samples
           )
           SELECT l.netuid,s.name,s.symbol,s.description,s.website,s.github_repo,
                  s.discord,s.contact,s.logo_url,s.additional,l.time,l.block_number,l.price_tao,
                  l.tao_reserve,l.alpha_reserve,l.alpha_out,
                  liq.liquidation_price_tao,liq.time AS liquidation_time,
                  100 * (liq.liquidation_price_tao / NULLIF(l.price_tao,0) - 1)
                    AS liquidation_diff_pct,
                  100 * l.emission_share AS emission_pct,
                  l.tempo,
                  l.staker_epoch_dividends_alpha,
                  l.circulating_alpha,
                  l.alpha_reserve,
                  l.conviction_locked_alpha,
                  CASE WHEN l.conviction_locked_alpha IS NULL
                         OR COALESCE(l.alpha_out, 0) <= 0
                       THEN NULL ELSE
                    100 * l.conviction_locked_alpha / l.alpha_out
                  END AS conviction_locked_pct,
                  (l.price_tao * l.circulating_alpha)
                    AS market_cap_tao,
                  l.volume_tao - COALESCE(v24.volume_tao,l.volume_tao) AS volume_24h_tao,
                  p10.price_tao AS price_10m_tao,p10.time AS time_10m,
                  p1.price_tao AS price_1h_tao,p1.time AS time_1h,
                  p24.price_tao AS price_24h_tao,p24.time AS time_24h,
                  p7.price_tao AS price_7d_tao,p7.time AS time_7d,
                  100 * (l.price_tao / NULLIF(p10.price_tao,0) - 1) AS change_10m,
                  100 * (l.price_tao / NULLIF(p1.price_tao,0) - 1) AS change_1h,
                  100 * (l.price_tao / NULLIF(p24.price_tao,0) - 1) AS change_24h,
                  100 * (l.price_tao / NULLIF(p7.price_tao,0) - 1) AS change_7d,
                  100 * (l.tao_reserve / NULLIF(p1.tao_reserve,0) - 1)
                    AS liquidity_change_1h,
                  100 * (l.tao_reserve / NULLIF(p24.tao_reserve,0) - 1)
                    AS liquidity_change_24h,
                  100 * (l.emission_share - p1.emission_share)
                    AS emission_change_1h,
                  p24.emission_share AS emission_share_24h,
                  100 * (l.emission_share - p24.emission_share)
                    AS emission_change_24h,
                  l.volume_tao - p1.volume_tao AS volume_1h_tao,
                  (l.volume_tao - p1.volume_tao) /
                    NULLIF(p1.volume_tao - p2.volume_tao,0) AS volume_acceleration_1h,
                  (l.volume_tao - p24.volume_tao) /
                    NULLIF(p24.volume_tao - p48.volume_tao,0) AS volume_acceleration_24h
           FROM latest l LEFT JOIN subnets s USING(netuid)
           {liquidation_join("l")}
           LEFT JOIN LATERAL (
             SELECT price_tao,time FROM subnet_price_samples
             WHERE netuid=l.netuid AND time <= l.time - interval '10 minutes'
             ORDER BY time DESC LIMIT 1
           ) p10 ON true
           LEFT JOIN LATERAL (
             SELECT hist1.price_tao,hist1.time,hist1.tao_reserve,hist1.emission_share,hist1.volume_tao
             FROM subnet_price_samples hist1
             WHERE hist1.netuid=l.netuid AND hist1.time <= l.time - interval '1 hour'
             ORDER BY hist1.time DESC LIMIT 1
           ) p1 ON true
           LEFT JOIN LATERAL (
             SELECT hist2.volume_tao FROM subnet_price_samples hist2
             WHERE hist2.netuid=l.netuid AND hist2.time <= l.time - interval '2 hours'
             ORDER BY hist2.time DESC LIMIT 1
           ) p2 ON true
           LEFT JOIN LATERAL (
             SELECT price_tao,time,emission_share,tao_reserve,volume_tao FROM subnet_price_samples
             WHERE netuid=l.netuid AND time <= l.time - interval '24 hours'
               AND time >= l.time - interval '24 hours 10 minutes'
             ORDER BY time DESC LIMIT 1
           ) p24 ON true
           LEFT JOIN LATERAL (
             SELECT volume_tao FROM subnet_price_samples
             WHERE netuid=l.netuid AND time <= l.time - interval '48 hours'
               AND time >= l.time - interval '48 hours 10 minutes'
             ORDER BY time DESC LIMIT 1
           ) p48 ON true
           LEFT JOIN LATERAL (
             SELECT price_tao,time FROM subnet_price_samples
             WHERE netuid=l.netuid AND time <= l.time - interval '7 days'
             ORDER BY time DESC LIMIT 1
           ) p7 ON true
           LEFT JOIN LATERAL (
             SELECT volume_tao FROM subnet_price_samples
             WHERE netuid=l.netuid AND time <= l.time - interval '24 hours'
             ORDER BY time DESC LIMIT 1
           ) v24 ON true
           ORDER BY market_cap_tao DESC NULLS LAST"""
    )
    current_app.state.screener_cache = {
        "data": [{**dict(row), **subnet_reward_estimate(row)} for row in rows],
        "cached_at": datetime.now(timezone.utc),
    }
    return current_app.state.screener_cache


async def _keep_screener_warm(current_app: FastAPI):
    """Refresh independently of visitors; requests never wait for SQL history."""
    history_due = 0.0
    while True:
        try:
            await asyncio.wait_for(_refresh_live_screener(current_app), timeout=5)
            if asyncio.get_running_loop().time() >= history_due:
                await asyncio.wait_for(_refresh_screener(current_app), timeout=10)
                history_due = asyncio.get_running_loop().time() + 20
        except Exception as exc:
            log.warning("background screener refresh failed: %s", type(exc).__name__)
        await asyncio.sleep(6)


@app.get("/v1/screener", dependencies=[Depends(authorize)])
async def screener():
    cached = app.state.screener_cache
    if not cached or not cached["data"]:
        raise HTTPException(503, "live market snapshot is warming up")
    return cached


@app.get("/v1/subnets/{netuid}/prices", dependencies=[Depends(authorize)])
async def historical_prices(
    netuid: int,
    start: datetime = Query(default_factory=lambda: datetime.now(timezone.utc) - timedelta(days=1)),
    end: datetime = Query(default_factory=lambda: datetime.now(timezone.utc)),
    interval: str = Query("1m", pattern="^(raw|1m|5m|10m|15m|1h|4h|1d)$"),
    limit: int = Query(5000, ge=1, le=10000),
):
    if start >= end or end - start > timedelta(days=366):
        raise HTTPException(422, "start must precede end; maximum range is 366 days")
    if interval != "raw":
        buckets = {"1m": "1 minute", "5m": "5 minutes", "10m": "10 minutes", "15m": "15 minutes",
                   "1h": "1 hour", "4h": "4 hours", "1d": "1 day"}
        rows = await app.state.db.fetch(
            f"""SELECT date_bin('{buckets[interval]}',time,TIMESTAMPTZ '2000-01-01') AS time,netuid,
                       (array_agg(price_tao ORDER BY time))[1] AS open,max(price_tao) AS high,
                       min(price_tao) AS low,(array_agg(price_tao ORDER BY time DESC))[1] AS close,
                       (array_agg(tao_reserve ORDER BY time DESC))[1] AS tao_reserve,
                       (array_agg(alpha_reserve ORDER BY time DESC))[1] AS alpha_reserve,
                       max(volume_tao)-min(volume_tao) AS volume_tao
                FROM subnet_price_samples WHERE netuid=$1 AND time >= $2 AND time < $3
                GROUP BY 1,2 ORDER BY 1 LIMIT $4""", netuid, start, end, limit,
        )
    else:
        rows = await app.state.db.fetch(
            """SELECT time,block_number,netuid,price_tao,tao_reserve,alpha_reserve,alpha_out
               FROM subnet_price_samples WHERE netuid=$1 AND time >= $2 AND time < $3
               ORDER BY time LIMIT $4""", netuid, start, end, limit,
        )
    return {"data": [dict(row) for row in rows]}


@app.get("/v1/subnets/{netuid}/candles", dependencies=[Depends(authorize)])
async def compact_candles(
    netuid: int,
    interval: str = Query("1m", pattern="^(1m|10m|1h|1d)$"),
    limit: int = Query(180, ge=20, le=500),
):
    """Return recent chart-ready OHLC rows with a short in-process cache.

    The dashboard does not need reserves, names, or repeated object keys for
    every candle. Keeping this response compact makes subnet/timeframe changes
    fast and avoids re-running the same aggregation on every browser poll.
    """
    cache_key = (netuid, interval, limit)
    now = datetime.now(timezone.utc)
    cached = app.state.candle_cache.get(cache_key)
    if cached and (now - cached["cached_at"]).total_seconds() < 30:
        return cached["payload"]

    if cached:
        if cache_key not in app.state.candle_refreshing:
            app.state.candle_refreshing.add(cache_key)
            asyncio.create_task(_refresh_candle_cache_in_background(cache_key, netuid, interval, limit))
        return cached["payload"]

    task = app.state.candle_tasks.get(cache_key)
    if task is None or task.done():
        task = asyncio.create_task(_refresh_candle_cache(cache_key, netuid, interval, limit))
        app.state.candle_tasks[cache_key] = task
        task.add_done_callback(lambda _task: app.state.candle_tasks.pop(cache_key, None))
    return await asyncio.shield(task)


async def _refresh_candle_cache_in_background(cache_key, netuid: int, interval: str, limit: int):
    try:
        await _refresh_candle_cache(cache_key, netuid, interval, limit)
    except Exception as exc:
        log.warning(
            "background candle refresh failed netuid=%s interval=%s error=%s",
            netuid,
            interval,
            type(exc).__name__,
        )
    finally:
        app.state.candle_refreshing.discard(cache_key)


async def _refresh_candle_cache(cache_key, netuid: int, interval: str, limit: int):
    now = datetime.now(timezone.utc)

    buckets = {"1m": "1 minute", "10m": "10 minutes", "1h": "1 hour", "1d": "1 day"}
    if interval == "1m":
        query = """WITH candles AS (
                   SELECT date_bin('1 minute',time,TIMESTAMPTZ '2000-01-01') AS bucket,
                          (array_agg(price_tao ORDER BY time))[1] AS open,
                          max(price_tao) AS high,
                          min(price_tao) AS low,
                          (array_agg(price_tao ORDER BY time DESC))[1] AS close,
                          max(volume_tao)-min(volume_tao) AS volume
                   FROM subnet_price_samples
                   WHERE netuid=$1 AND time >= now()-interval '3 hours'
                   GROUP BY 1
                   ORDER BY 1 DESC
                   LIMIT $2
                 )
                 SELECT bucket,open,high,low,close,volume FROM candles ORDER BY bucket"""
    else:
        step = buckets[interval]
        query = f"""WITH params AS (
                   SELECT interval '{step}' AS step,
                          date_bin('{step}',now(),TIMESTAMPTZ '2000-01-01') AS latest
                 ), buckets AS (
                   SELECT generate_series(latest-(($2::integer-1)*step),latest,step) AS bucket,step
                   FROM params
                 )
                 SELECT b.bucket,o.price_tao AS open,
                        GREATEST(o.price_tao,c.price_tao) AS high,
                        LEAST(o.price_tao,c.price_tao) AS low,
                        c.price_tao AS close,
                        GREATEST(c.volume_tao-o.volume_tao,0) AS volume
                 FROM buckets b
                 LEFT JOIN LATERAL (
                   SELECT price_tao,volume_tao FROM subnet_price_samples
                   WHERE netuid=$1 AND time < b.bucket
                   ORDER BY time DESC LIMIT 1
                 ) o ON true
                 LEFT JOIN LATERAL (
                   SELECT price_tao,volume_tao FROM subnet_price_samples
                   WHERE netuid=$1 AND time < b.bucket+b.step
                   ORDER BY time DESC LIMIT 1
                 ) c ON true
                 WHERE c.price_tao IS NOT NULL
                 ORDER BY b.bucket"""
    rows = await asyncio.wait_for(app.state.db.fetch(query, netuid, limit), timeout=20)
    payload = {
        "data": [
            [row["bucket"], row["open"], row["high"], row["low"], row["close"], row["volume"]]
            for row in rows
        ],
        "interval": interval,
        "method": "exact" if interval == "1m" else "boundary",
        "cached_at": now,
    }
    app.state.candle_cache[cache_key] = {"cached_at": now, "payload": payload}
    if len(app.state.candle_cache) > 1024:
        cutoff = now - timedelta(minutes=10)
        app.state.candle_cache = {
            key: value for key, value in app.state.candle_cache.items()
            if value["cached_at"] >= cutoff
        }
    return payload


@app.get("/v1/activity", dependencies=[Depends(authorize)])
async def chain_activity(
    netuid: int | None = Query(None, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    where = "WHERE ($1::integer IS NULL OR e.netuid=$1 OR e.destination_netuid=$1)"
    summary_where = "WHERE ($1::integer IS NULL OR e.netuid=$1 OR e.destination_netuid=$1)"
    rows = await app.state.db.fetch(
        f"""SELECT e.block_number,e.event_index,e.time,e.event_type,e.netuid,
                   e.destination_netuid,e.coldkey,e.destination_coldkey,e.hotkey,
                   e.destination_hotkey,e.amount_alpha,e.amount_tao,e.perpetual,
                   CASE WHEN e.amount_alpha IS NOT NULL
                     THEN e.amount_alpha * ep.price_tao
                     ELSE e.amount_tao
                   END AS tao_value,
                   s.name,s.symbol,ds.name AS destination_name,
                   ds.symbol AS destination_symbol
            FROM chain_events e
            LEFT JOIN subnets s ON s.netuid=e.netuid
            LEFT JOIN subnets ds ON ds.netuid=e.destination_netuid
            LEFT JOIN LATERAL (
              SELECT price_tao FROM subnet_price_samples
              WHERE netuid=e.netuid AND time <= e.time
              ORDER BY time DESC LIMIT 1
            ) ep ON true
            {where}
            ORDER BY e.block_number DESC,e.event_index DESC LIMIT $2""",
        netuid, limit,
    )
    summary = await app.state.db.fetchrow(
        f"""WITH recent_events AS MATERIALIZED (
              SELECT time,event_type,netuid,destination_netuid,amount_alpha,amount_tao
              FROM chain_events
              WHERE time >= now()-interval '24 hours'
            )
            SELECT
              COALESCE(SUM(amount_alpha) FILTER (
                WHERE event_type='StakeLocked'
              ),0) AS locked_alpha_24h,
              COALESCE(SUM(amount_alpha) FILTER (
                WHERE event_type='StakeUnlocked'
              ),0) AS unlocked_alpha_24h,
              COALESCE(SUM(e.amount_alpha * ep.price_tao) FILTER (
                WHERE e.event_type='StakeLocked'
                  AND e.amount_alpha * ep.price_tao >= 10
              ),0) AS locked_tao_24h,
              COALESCE(SUM(e.amount_alpha * ep.price_tao) FILTER (
                WHERE e.event_type='StakeUnlocked'
                  AND e.amount_alpha * ep.price_tao >= 10
              ),0) AS unlocked_tao_24h,
              COUNT(*) FILTER (
                WHERE event_type IN ('StakeMoved','StakeSwapped','StakeTransferred')
              ) AS stake_moves_24h,
              COUNT(*) FILTER (
                WHERE event_type='ColdkeySwapped'
              ) AS coldkey_swaps_24h,
              COUNT(*) FILTER (
                WHERE event_type IN ('HotkeySwapped','HotkeySwappedOnSubnet')
              ) AS hotkey_swaps_24h,
              COUNT(*) FILTER (
                WHERE event_type='SubnetOwnerChanged'
              ) AS subnet_owner_changes_24h,
              COUNT(*) AS event_count_24h,
              COALESCE(SUM(amount_tao),0) AS tao_moved_24h,
              COALESCE(MAX(amount_tao),0) AS largest_move_tao_24h,
              COUNT(DISTINCT netuid) AS active_subnets_24h
            FROM recent_events e
            LEFT JOIN LATERAL (
              SELECT price_tao FROM subnet_price_samples
              WHERE netuid=e.netuid AND time <= e.time
              ORDER BY time DESC LIMIT 1
            ) ep ON true
            {summary_where}""",
        netuid,
    )
    collecting_since = await app.state.db.fetchval("SELECT min(time) FROM chain_events")
    summary_data = dict(summary)
    summary_data["net_locked_alpha_24h"] = (
        summary_data["locked_alpha_24h"] - summary_data["unlocked_alpha_24h"]
    )
    summary_data["net_locked_tao_24h"] = (
        summary_data["locked_tao_24h"] - summary_data["unlocked_tao_24h"]
    )
    return {
        "data": [dict(row) for row in rows],
        "summary": summary_data,
        "collecting_since": collecting_since,
    }


async def _persist_wallet(conn, result: dict, timestamp: datetime):
    await conn.execute(
        """INSERT INTO wallet_balance_snapshots
           (time,block_number,address,free_tao,staked_tao_value,total_tao_value)
           VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING""",
        timestamp, result["block_number"], result["address"], result["free_tao"],
        result["staked_tao_value"], result["total_tao_value"],
    )
    await conn.executemany(
        """INSERT INTO wallet_stake_snapshots(time,block_number,address,hotkey,netuid,alpha,tao_value)
           VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING""",
        [(timestamp, result["block_number"], result["address"], stake["hotkey"], stake["netuid"],
          stake["alpha"], stake["tao_value"]) for stake in result["stakes"]],
    )


@app.post("/v1/wallets/mass-check", dependencies=[Depends(authorize)])
async def mass_wallet_check(body: MassWalletRequest):
    raise HTTPException(410, "synchronous wallet checks retired; use /v1/wallets/jobs")


@app.post("/v1/wallets/jobs", status_code=202, dependencies=[Depends(authorize)])
async def create_wallet_job(body: MassWalletRequest):
    if len(body.addresses) > settings.max_mass_wallets:
        raise HTTPException(413, f"maximum {settings.max_mass_wallets} addresses per request")
    pending = await app.state.db.fetchval(
        "SELECT count(*) FROM wallet_lookup_jobs WHERE status IN ('queued','processing')"
    )
    if pending >= settings.max_pending_wallet_jobs:
        raise HTTPException(429, "wallet checker is busy; please retry shortly")
    job_id = uuid.uuid4().hex
    await app.state.db.execute(
        """INSERT INTO wallet_lookup_jobs(id,addresses,total)
           VALUES($1,$2::jsonb,$3)""",
        job_id, json.dumps(body.addresses), len(body.addresses),
    )
    return {"job_id": job_id, "status": "queued", "completed": 0, "total": len(body.addresses)}


@app.get("/v1/wallets/jobs/{job_id}", dependencies=[Depends(authorize)])
async def wallet_job_status(job_id: str):
    row = await app.state.db.fetchrow(
        """SELECT id,status,results,completed,total,block_number,error,created_at,updated_at
           FROM wallet_lookup_jobs WHERE id=$1""", job_id,
    )
    if not row:
        raise HTTPException(404, "wallet lookup job not found")
    payload = dict(row)
    if isinstance(payload["results"], str):
        payload["results"] = json.loads(payload["results"])
    return payload


@app.get("/v1/wallets/{address}/history", dependencies=[Depends(authorize)])
async def wallet_history(address: str, limit: int = Query(1000, ge=1, le=10000)):
    rows = await app.state.db.fetch(
        """SELECT time,block_number,address,free_tao,staked_tao_value,total_tao_value
           FROM wallet_balance_snapshots WHERE address=$1 ORDER BY time DESC LIMIT $2""", address, limit,
    )
    return {"data": [dict(row) for row in rows]}


@app.websocket("/v1/ws/prices")
async def price_socket(websocket: WebSocket):
    key = websocket.query_params.get("api_key")
    if not settings.public_reads and not key:
        await websocket.close(code=4401)
        return
    if not settings.public_reads and not any(hmac.compare_digest(key, item) for item in settings.api_keys):
        await websocket.close(code=4403)
        return
    await websocket.accept()
    await websocket.send_json(jsonable_encoder(await current_prices()))
    try:
        while True:
            await asyncio.sleep(12)
            await websocket.send_json(jsonable_encoder(await current_prices()))
    except WebSocketDisconnect:
        pass
    finally:
        pass


def run():
    uvicorn.run("app.api:app", host="0.0.0.0", port=8000)
