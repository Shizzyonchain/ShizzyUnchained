import asyncio
import logging
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

from app.backfill import sample_blocks
from app.chain import ChainClient
from app.config import get_settings
from app.db import close, connect
from app.rpc import finalized_heads
from app.retention import retention_loop
from app.wallet_job import wallet_job_loop
from app.validator_yield import yield_check_loop
from app.trading import trading_loop

log = logging.getLogger("shizzy.indexer")
MAX_CATCHUP_BLOCKS = 250

LATEST_PRICE_UPSERT = """INSERT INTO subnet_latest_samples
   (time,block_number,block_hash,netuid,price_tao,tao_reserve,
    alpha_reserve,alpha_out,volume_tao,tao_in_emission,
    alpha_out_emission,emission_share,root_prop,
    conviction_locked_alpha,tempo,staker_epoch_dividends_alpha,
    circulating_alpha)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
   ON CONFLICT(netuid) DO UPDATE SET
   time=EXCLUDED.time,block_number=EXCLUDED.block_number,
   block_hash=EXCLUDED.block_hash,price_tao=EXCLUDED.price_tao,
   tao_reserve=EXCLUDED.tao_reserve,alpha_reserve=EXCLUDED.alpha_reserve,
   alpha_out=EXCLUDED.alpha_out,volume_tao=EXCLUDED.volume_tao,
   tao_in_emission=EXCLUDED.tao_in_emission,
   alpha_out_emission=EXCLUDED.alpha_out_emission,
   emission_share=EXCLUDED.emission_share,root_prop=EXCLUDED.root_prop,
   conviction_locked_alpha=EXCLUDED.conviction_locked_alpha,
   tempo=EXCLUDED.tempo,
   staker_epoch_dividends_alpha=EXCLUDED.staker_epoch_dividends_alpha,
   circulating_alpha=EXCLUDED.circulating_alpha
   WHERE subnet_latest_samples.block_number <= EXCLUDED.block_number"""


async def close_chain_resources(heads, chain, endpoint_name: str):
    """Best-effort cleanup must never terminate an otherwise recoverable failover loop."""
    if heads is not None:
        try:
            await heads.aclose()
        except Exception as exc:
            log.warning("Finney subscription cleanup failed endpoint=%s error=%s", endpoint_name, type(exc).__name__)
    try:
        await chain.__aexit__(None, None, None)
    except Exception as exc:
        log.warning("Finney client cleanup failed endpoint=%s error=%s", endpoint_name, type(exc).__name__)


def _block_hash(info) -> str:
    value = getattr(info, "hash", None) or getattr(info, "block_hash", None)
    if value is None and isinstance(info, dict):
        value = info.get("hash") or info.get("block_hash")
    return str(value) if value is not None else ""


def _parent_hash(info) -> str | None:
    header = getattr(info, "header", None)
    if header is None and isinstance(info, dict):
        header = info.get("header")
    if isinstance(header, dict):
        return header.get("parentHash") or header.get("parent_hash")
    return None


def _block_time(info) -> datetime:
    value = getattr(info, "timestamp", None)
    if value is None and isinstance(info, dict):
        value = info.get("timestamp")
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


async def persist_block(
    db,
    chain,
    number: int,
    announced_hash: str | None = None,
    include_events: bool = True,
    include_auxiliary: bool = True,
    include_yield_metrics: bool | None = None,
    include_lock_metrics: bool | None = None,
    include_market_data: bool = True,
):
    info = await chain.block_info(number)
    block_hash = _block_hash(info) or announced_hash
    if not block_hash:
        raise RuntimeError(f"No hash returned for finalized block {number}")
    timestamp = _block_time(info)
    rows = (
        await chain.subnets_at(
            number,
            include_auxiliary=include_auxiliary,
            include_yield_metrics=include_yield_metrics,
            include_lock_metrics=include_lock_metrics,
        )
        if include_market_data else []
    )
    events = []
    if include_events:
        try:
            events = await chain.events_at(number)
        except Exception as exc:
            log.warning("event read failed at finalized block %s: %s", number, exc)
    async with db.acquire() as conn, conn.transaction():
        claimed = await conn.fetchval(
            """INSERT INTO chain_blocks(block_number,block_hash,parent_hash,block_time)
               VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING block_number""",
            number, block_hash, _parent_hash(info), timestamp,
        )
        if claimed is None:
            return
        if rows:
            await conn.executemany(
                """INSERT INTO subnets
               (netuid,name,symbol,description,website,github_repo,discord,contact,logo_url,additional,
                first_seen_block,last_seen_block)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) ON CONFLICT(netuid) DO UPDATE SET
               name=EXCLUDED.name, symbol=EXCLUDED.symbol, description=EXCLUDED.description,
               website=EXCLUDED.website, github_repo=EXCLUDED.github_repo, discord=EXCLUDED.discord,
               contact=EXCLUDED.contact, logo_url=EXCLUDED.logo_url, additional=EXCLUDED.additional,
               last_seen_block=EXCLUDED.last_seen_block""",
                [(r["netuid"], r["name"], r["symbol"], r["description"], r["website"],
                  r["github_repo"], r["discord"], r["contact"], r["logo_url"],
                  r["additional"], number) for r in rows],
            )
            price_rows = [
                (timestamp, number, block_hash, r["netuid"], r["price_tao"], r["tao_reserve"],
                 r["alpha_reserve"], r["alpha_out"], r["volume_tao"], r["tao_in_emission"],
                 r["alpha_out_emission"], r["emission_share"], r["root_prop"],
                 r["conviction_locked_alpha"], r["tempo"],
                 r["staker_epoch_dividends_alpha"], r["circulating_alpha"])
                for r in rows
            ]
            await conn.executemany(
                """INSERT INTO subnet_price_samples
               (time,block_number,block_hash,netuid,price_tao,tao_reserve,alpha_reserve,alpha_out,volume_tao,
                tao_in_emission,alpha_out_emission,emission_share,root_prop,conviction_locked_alpha,
                tempo,staker_epoch_dividends_alpha,circulating_alpha)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
               ON CONFLICT(time,netuid,block_number) DO UPDATE SET
               block_hash=EXCLUDED.block_hash, price_tao=EXCLUDED.price_tao,
               tao_reserve=EXCLUDED.tao_reserve, alpha_reserve=EXCLUDED.alpha_reserve,
               alpha_out=EXCLUDED.alpha_out, volume_tao=EXCLUDED.volume_tao,
               tao_in_emission=EXCLUDED.tao_in_emission,
               alpha_out_emission=EXCLUDED.alpha_out_emission,
               emission_share=EXCLUDED.emission_share, root_prop=EXCLUDED.root_prop,
               conviction_locked_alpha=EXCLUDED.conviction_locked_alpha,
               tempo=EXCLUDED.tempo,
               staker_epoch_dividends_alpha=EXCLUDED.staker_epoch_dividends_alpha,
               circulating_alpha=EXCLUDED.circulating_alpha""",
                price_rows,
            )
            await conn.executemany(LATEST_PRICE_UPSERT, price_rows)
            if include_auxiliary:
                await conn.executemany(
                    """INSERT INTO subnet_liquidation_samples
                       (netuid,time,block_number,stake_block,liquidation_price_tao)
                       VALUES($1,$2,$3,$4,$5)
                       ON CONFLICT(netuid) DO UPDATE SET
                       time=EXCLUDED.time,block_number=EXCLUDED.block_number,
                       stake_block=EXCLUDED.stake_block,
                       liquidation_price_tao=EXCLUDED.liquidation_price_tao
                       WHERE subnet_liquidation_samples.block_number <= EXCLUDED.block_number""",
                    [(r["netuid"], timestamp, number, r.get("liquidation_stake_block"),
                      r.get("liquidation_price_tao")) for r in rows],
                )
        if events:
            await conn.executemany(
                """INSERT INTO chain_events
                   (block_number,event_index,block_hash,time,event_type,netuid,
                    destination_netuid,coldkey,destination_coldkey,hotkey,
                    destination_hotkey,amount_alpha,amount_tao,perpetual,raw)
                   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
                   ON CONFLICT DO NOTHING""",
                [
                    (
                        number, event["event_index"], block_hash, timestamp,
                        event["event_type"], event["netuid"],
                        event["destination_netuid"], event["coldkey"],
                        event["destination_coldkey"], event["hotkey"],
                        event["destination_hotkey"], event["amount_alpha"],
                        event["amount_tao"], event["perpetual"], event["raw"],
                    )
                    for event in events
                ],
            )
    log.info(
        "indexed finalized block %s (%s subnets, %s tracked events, market_data=%s)",
        number, len(rows), len(events), include_market_data,
    )


async def persist_price_tick(
    db,
    chain,
    number: int,
    announced_hash: str | None = None,
):
    """Persist finalized spot prices without waiting for heavy subnet enrichment."""
    started = time.monotonic()
    info = await chain.block_info(number)
    block_hash = _block_hash(info) or announced_hash
    if not block_hash:
        raise RuntimeError(f"No hash returned for finalized price tick {number}")
    timestamp = _block_time(info)
    prices = await chain.prices_at(number)
    previous_rows = await db.fetch(
        """SELECT DISTINCT ON(netuid) netuid,tao_reserve,alpha_reserve,alpha_out,
                  volume_tao,tao_in_emission,alpha_out_emission,emission_share,
                  root_prop,conviction_locked_alpha,tempo,
                  staker_epoch_dividends_alpha,circulating_alpha
           FROM subnet_latest_samples
           ORDER BY netuid"""
    )
    previous = {int(row["netuid"]): row for row in previous_rows}
    rows = []
    for netuid, price in prices.items():
        metrics = previous.get(netuid)
        rows.append((
            timestamp,
            number,
            block_hash,
            netuid,
            price,
            metrics["tao_reserve"] if metrics else None,
            metrics["alpha_reserve"] if metrics else None,
            metrics["alpha_out"] if metrics else None,
            metrics["volume_tao"] if metrics else None,
            metrics["tao_in_emission"] if metrics else None,
            metrics["alpha_out_emission"] if metrics else None,
            metrics["emission_share"] if metrics else None,
            metrics["root_prop"] if metrics else None,
            metrics["conviction_locked_alpha"] if metrics else None,
            metrics["tempo"] if metrics else None,
            metrics["staker_epoch_dividends_alpha"] if metrics else None,
            metrics["circulating_alpha"] if metrics else None,
        ))
    if rows:
        await db.executemany(
            """INSERT INTO subnet_price_samples
               (time,block_number,block_hash,netuid,price_tao,tao_reserve,
                alpha_reserve,alpha_out,volume_tao,tao_in_emission,
                alpha_out_emission,emission_share,root_prop,
                conviction_locked_alpha,tempo,staker_epoch_dividends_alpha,
                circulating_alpha)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
               ON CONFLICT(time,netuid,block_number) DO UPDATE SET
               block_hash=EXCLUDED.block_hash,price_tao=EXCLUDED.price_tao""",
            rows,
        )
        await db.executemany(LATEST_PRICE_UPSERT, rows)
    log.info(
        "Finney live prices indexed block=%s subnets=%s tick_ms=%s",
        number,
        len(rows),
        round((time.monotonic() - started) * 1000),
    )


async def live_price_loop(db, settings):
    """Keep finalized prices current independently of enrichment and event scans."""
    endpoints = settings.subtensor_ws_urls
    endpoint_index = 0
    retry_delay = 1
    last = await db.fetchval("SELECT max(block_number) FROM subnet_latest_samples")
    while True:
        endpoint = endpoints[endpoint_index]
        endpoint_name = urlsplit(endpoint).hostname or "configured-rpc"
        chain_settings = settings.model_copy(update={"subtensor_ws_url": endpoint})
        chain = ChainClient(chain_settings)
        heads = None
        try:
            await asyncio.wait_for(
                chain.__aenter__(), timeout=settings.rpc_connect_timeout_seconds
            )
            log.info("Finney live-price RPC connected endpoint=%s", endpoint_name)
            heads = finalized_heads(
                endpoint,
                connect_timeout=settings.rpc_connect_timeout_seconds,
                subscribe_timeout=settings.rpc_subscribe_timeout_seconds,
            )
            while True:
                head = await asyncio.wait_for(
                    anext(heads), timeout=settings.rpc_head_timeout_seconds
                )
                if last is not None and head["number"] <= last:
                    continue
                await asyncio.wait_for(
                    persist_price_tick(
                        db,
                        chain,
                        head["number"],
                        head.get("hash"),
                    ),
                    timeout=settings.rpc_block_timeout_seconds,
                )
                last = head["number"]
                retry_delay = 1
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            next_index = (endpoint_index + 1) % len(endpoints)
            next_name = urlsplit(endpoints[next_index]).hostname or "configured-rpc"
            log.exception(
                "Finney live-price RPC failed endpoint=%s error=%s; failing over to endpoint=%s",
                endpoint_name,
                type(exc).__name__,
                next_name,
            )
            endpoint_index = next_index
            if endpoint_index == 0:
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 30)
        finally:
            await close_chain_resources(heads, chain, endpoint_name)


async def _missing_price_ranges(db, minimum_gap_blocks: int):
    return await db.fetch(
        """WITH price_blocks AS (
             SELECT block_number,min(time) AS block_time
             FROM subnet_price_samples
             WHERE time >= now() - interval '8 days'
             GROUP BY block_number
           ), ordered AS (
             SELECT block_number,block_time,
                    lead(block_number) OVER (ORDER BY block_number) AS next_block,
                    lead(block_time) OVER (ORDER BY block_number) AS next_time
             FROM price_blocks
           ), desired_horizon AS (
             SELECT
               (SELECT block_number FROM chain_blocks
                WHERE block_time <= now() - interval '25 hours'
                ORDER BY block_time DESC LIMIT 1) AS start_block,
               (SELECT block_time FROM chain_blocks
                WHERE block_time <= now() - interval '25 hours'
                ORDER BY block_time DESC LIMIT 1) AS start_time,
               COALESCE(
                 (SELECT min(block_number) FROM price_blocks),
                 (SELECT max(block_number) FROM subnet_latest_samples)
               ) AS end_block,
               COALESCE(
                 (SELECT min(block_time) FROM price_blocks),
                 (SELECT max(time) FROM subnet_latest_samples)
               ) AS end_time
           )
           SELECT block_number AS start_block,next_block AS end_block,
                  block_time AS start_time,next_time AS end_time
           FROM ordered
           WHERE next_block-block_number > $1
             AND next_time-block_time > interval '90 seconds'
           UNION ALL
           SELECT start_block,end_block,start_time,end_time
           FROM desired_horizon
           WHERE start_block IS NOT NULL AND end_block IS NOT NULL
             AND end_block-start_block > $1
           ORDER BY start_block""",
        minimum_gap_blocks,
    )


async def backfill_missing_prices(db, settings):
    """Repair historical chart gaps with real archive-node state at one-minute resolution."""
    if not settings.backfill_price_gaps or not settings.backfill_ws_url:
        return
    step = max(1, settings.backfill_sample_blocks)
    ranges = await _missing_price_ranges(db, step)
    if not ranges:
        log.info("historical price backfill found no missing ranges")
        return
    total = sum(len(sample_blocks(row["start_block"], row["end_block"], step)) for row in ranges)
    log.warning(
        "historical price backfill found %s ranges (%s archive samples)",
        len(ranges),
        total,
    )
    completed = 0
    backfill_settings = settings.model_copy(update={"subtensor_ws_url": settings.backfill_ws_url})
    async with ChainClient(backfill_settings) as archive:
        semaphore = asyncio.Semaphore(max(1, settings.backfill_concurrency))

        async def repair(number):
            nonlocal completed
            async with semaphore:
                try:
                    # Price history may have been pruned while chain_blocks was
                    # retained. This writer deliberately does not claim the block,
                    # so it can restore price samples for already-known blocks.
                    await persist_price_tick(db, archive, number)
                except Exception:
                    log.exception(
                        "archive backfill failed at block %s; continuing", number
                    )
                    return
                completed += 1
                if completed % 25 == 0 or completed == total:
                    log.info(
                        "historical price backfill progress %s/%s",
                        completed,
                        total,
                    )

        for gap in ranges:
            log.warning(
                "repairing chart gap %s..%s (%s to %s)",
                gap["start_block"],
                gap["end_block"],
                gap["start_time"],
                gap["end_time"],
            )
            blocks = sample_blocks(
                gap["start_block"], gap["end_block"], step
            )
            await asyncio.gather(*(repair(number) for number in blocks))
    log.warning("historical price backfill completed %s/%s archive samples", completed, total)


async def backfill_loop(db, settings):
    while True:
        try:
            await backfill_missing_prices(db, settings)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("historical price backfill cycle failed")
        await asyncio.sleep(300)


async def indexer():
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)
    db = await connect()
    last = await db.fetchval("SELECT max(block_number) FROM chain_blocks")
    if last is None and settings.indexer_start_block.isdigit():
        last = int(settings.indexer_start_block) - 1
    asyncio.create_task(live_price_loop(db, settings))
    asyncio.create_task(backfill_loop(db, settings))
    asyncio.create_task(wallet_job_loop(db, settings))
    asyncio.create_task(retention_loop(db, settings))
    asyncio.create_task(yield_check_loop(db, settings))
    asyncio.create_task(trading_loop(db, settings))
    endpoints = settings.subtensor_ws_urls
    endpoint_index = 0
    retry_delay = 1
    while True:
        endpoint = endpoints[endpoint_index]
        endpoint_name = urlsplit(endpoint).hostname or "configured-rpc"
        chain_settings = settings.model_copy(update={"subtensor_ws_url": endpoint})
        chain = ChainClient(chain_settings)
        heads = None
        connected_at = time.monotonic()
        try:
            await asyncio.wait_for(
                chain.__aenter__(), timeout=settings.rpc_connect_timeout_seconds
            )
            log.info("Finney RPC connected endpoint=%s", endpoint_name)
            heads = finalized_heads(
                endpoint,
                connect_timeout=settings.rpc_connect_timeout_seconds,
                subscribe_timeout=settings.rpc_subscribe_timeout_seconds,
            )
            while True:
                head_started = time.monotonic()
                head = await asyncio.wait_for(
                    anext(heads), timeout=settings.rpc_head_timeout_seconds
                )
                retry_delay = 1
                gap = head["number"] - last if last is not None else 0
                if last is not None and gap > MAX_CATCHUP_BLOCKS:
                    log.warning(
                        "indexer is %s blocks behind; jumping to finalized block %s",
                        gap,
                        head["number"],
                    )
                    start = head["number"]
                else:
                    start = head["number"] if last is None else last + 1
                # Preserve finalized events for skipped heights, but only perform
                # the expensive 128-subnet market snapshot at the newest head.
                for number in range(start, head["number"]):
                    await asyncio.wait_for(
                        persist_block(
                            db,
                            chain,
                            number,
                            include_auxiliary=False,
                            include_yield_metrics=False,
                            include_lock_metrics=False,
                            include_market_data=False,
                        ),
                        timeout=settings.rpc_block_timeout_seconds,
                    )
                    last = number
                start = head["number"]
                for number in range(start, head["number"] + 1):
                    block_started = time.monotonic()
                    await asyncio.wait_for(
                        persist_block(
                            db, chain, number,
                            head.get("hash") if number == head["number"] else None,
                            include_auxiliary=True,
                            include_yield_metrics=True,
                            include_lock_metrics=True,
                        ),
                        timeout=settings.rpc_block_timeout_seconds,
                    )
                    last = number
                    log.info(
                        "Finney block indexed endpoint=%s block=%s rpc_ms=%s head_wait_ms=%s",
                        endpoint_name,
                        number,
                        round((time.monotonic() - block_started) * 1000),
                        round((block_started - head_started) * 1000),
                    )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            next_index = (endpoint_index + 1) % len(endpoints)
            next_name = urlsplit(endpoints[next_index]).hostname or "configured-rpc"
            log.exception(
                "Finney RPC failed endpoint=%s connected_ms=%s error=%s; "
                "failing over to endpoint=%s",
                endpoint_name,
                round((time.monotonic() - connected_at) * 1000),
                type(exc).__name__,
                next_name,
            )
            endpoint_index = next_index
            if endpoint_index == 0:
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 30)
        finally:
            await close_chain_resources(heads, chain, endpoint_name)


async def main():
    try:
        await indexer()
    finally:
        await close()


def run():
    asyncio.run(main())


if __name__ == "__main__":
    run()
