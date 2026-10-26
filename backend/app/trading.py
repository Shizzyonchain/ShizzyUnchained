"""Finalized, contiguous TAO/alpha trade windows. RPC runs only in the worker."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.chain import ChainClient, _plain, field, scale_int
from app.rpc import finalized_heads

log = logging.getLogger("shizzy.trading")
SCHEMA = """CREATE TABLE IF NOT EXISTS market_trade_blocks (
 block_number BIGINT PRIMARY KEY, block_hash TEXT NOT NULL,
 block_time TIMESTAMPTZ NOT NULL, buy_rao NUMERIC(40,0) NOT NULL,
 sell_rao NUMERIC(40,0) NOT NULL, trades INTEGER NOT NULL,
 indexed_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE INDEX IF NOT EXISTS market_trade_time_idx ON market_trade_blocks(block_time);"""


def trade_totals(records):
    """Count successful external TAO↔alpha legs; exclude root and alpha↔alpha routing.

    Runtime 484 six-field StakeAdded/Removed balances are raw rao. Explicit
    alpha-fee conversions are matched by wallet/subnet/alpha amount.
    Failed nested calls have rolled-back events; surviving successful batch
    items remain valid even when a later item interrupts the batch.
    """
    rows = [_plain(r) for r in getattr(records, "value", records) or []]
    if not rows or not any(
        field(field(r, "event", default=r), "module_id") == "System"
        and field(field(r, "event", default=r), "event_id") == "ExtrinsicSuccess"
        for r in rows
    ):
        raise ValueError("Missing decoded successful block events")
    result = {"buy": 0, "sell": 0, "trades": 0}
    groups = {}
    for r in rows:
        idx = field(r, "extrinsic_idx")
        if idx is not None:
            groups.setdefault(idx, []).append(field(r, "event", default=r))
    for peers in groups.values():
        if not any(
            field(e, "module_id") == "System" and field(e, "event_id") == "ExtrinsicSuccess"
            for e in peers
        ):
            continue
        routed = set()
        fees = []
        for position, e in enumerate(peers):
            if field(e, "module_id") != "SubtensorModule":
                continue
            name, a = field(e, "event_id"), field(e, "attributes")
            if name == "StakeSwapped":
                if not isinstance(a, (list, tuple)) or len(a) != 5:
                    raise ValueError("Unreviewed StakeSwapped layout")
                if scale_int(a[2]) > 0 and scale_int(a[3]) > 0:
                    for sn, kind in [
                        (scale_int(a[2]), "StakeRemoved"),
                        (scale_int(a[3]), "StakeAdded"),
                    ]:
                        matches = [
                            i
                            for i in range(position)
                            if i not in routed
                            and field(peers[i], "module_id") == "SubtensorModule"
                            and field(peers[i], "event_id") == kind
                            and list(field(peers[i], "attributes"))[:2] == list(a)[:2]
                            and scale_int(field(peers[i], "attributes")[4]) == sn
                        ]
                        if not matches:
                            raise ValueError("Unmatched routed trade leg")
                        routed.add(matches[-1])
            if name == "TransactionFeePaidWithAlpha":
                if not isinstance(a, dict) or not {"who", "netuid", "alpha_fee"} <= a.keys():
                    raise ValueError("Unreviewed alpha fee layout")
                fees.append((str(a["who"]), scale_int(a["netuid"]), scale_int(a["alpha_fee"])))
        for position, e in enumerate(peers):
            if field(e, "module_id") != "SubtensorModule" or field(e, "event_id") not in {
                "StakeAdded",
                "StakeRemoved",
            }:
                continue
            name, a = field(e, "event_id"), field(e, "attributes")
            if not isinstance(a, (list, tuple)) or len(a) != 6:
                raise ValueError("Unreviewed stake event layout")
            cold, hot, tao, alpha, sn, _fee = a
            sn, tao, alpha = scale_int(sn), scale_int(tao), scale_int(alpha)
            if not 1 <= sn <= 128 or tao <= 0:
                continue
            if position in routed:
                continue
            fee = (str(cold), sn, alpha)
            if name == "StakeRemoved" and fee in fees:
                fees.remove(fee)
                continue
            result["buy" if name == "StakeAdded" else "sell"] += tao
            result["trades"] += 1
    return result


async def trading_loop(db, settings):
    endpoints = list(dict.fromkeys([settings.backfill_ws_url, *settings.subtensor_ws_urls]))
    endpoint_index = 0
    while True:
        try:
            async with ChainClient(settings, endpoint_url=endpoints[endpoint_index]) as chain:
                if await chain.client.spec_version() != 484:
                    raise ValueError("Trade event semantics need runtime review")
                heads = finalized_heads(endpoints[endpoint_index])
                try:
                    head = await asyncio.wait_for(anext(heads), 20)
                finally:
                    await heads.aclose()
                end = head["number"]
                last = await db.fetchval("SELECT max(block_number) FROM market_trade_blocks")
                # Bring the hourly window online first. The daily window stays
                # unavailable until its own complete older coverage is present.
                start = last + 1 if last is not None else max(1, end - 360)
                semaphore = asyncio.Semaphore(8)

                async def collect(number):
                    async with semaphore, asyncio.timeout(35):
                        view = await chain.client.at(number)
                        records = await view.query(("System", "Events"))
                        totals = trade_totals(records)
                        stamp = await view.timestamp()
                        # Pinned SDK 11.1: reuse its cached hash resolution rather
                        # than downloading/decoding all block extrinsics again.
                        block_hash = await chain.client._block_hash(number)
                        if not isinstance(stamp, datetime) or not block_hash:
                            raise ValueError("Missing finalized trade block provenance")
                        return (
                            number,
                            str(block_hash),
                            stamp,
                            Decimal(totals["buy"]),
                            Decimal(totals["sell"]),
                            totals["trades"],
                        )

                insert = """INSERT INTO market_trade_blocks
                  (block_number,block_hash,block_time,buy_rao,sell_rao,trades)
                  VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING"""
                for n in range(start, end + 1, 32):
                    batch = await asyncio.gather(
                        *(collect(k) for k in range(n, min(n + 32, end + 1)))
                    )
                    # A failed read never advances a checkpoint or writes partial coverage.
                    await db.executemany(insert, batch)
                    if (n - start) % 512 == 0:
                        log.info("finalized trade history through=%s target=%s", batch[-1][0], end)
                first = await db.fetchval("SELECT min(block_number) FROM market_trade_blocks")
                if first is not None and first > end - 7800:
                    older = await asyncio.gather(
                        *(collect(k) for k in range(max(1, end - 7800, first - 256), first))
                    )
                    if older:
                        # executemany is atomic in pinned asyncpg: extend the
                        # prefix together, never checkpoint beyond a new hole.
                        await db.executemany(insert, older)
                        log.info("trade backfill earliest=%s target=%s", older[0][0], end - 7800)
                await db.execute(
                    "DELETE FROM market_trade_blocks WHERE block_time < now()-interval '3 days'"
                )
            await asyncio.sleep(12)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning(
                "trade collector paused: %s; preserving complete checkpoints", type(exc).__name__
            )
            endpoint_index = (endpoint_index + 1) % len(endpoints)
            await asyncio.sleep(20)


async def trading_snapshot(db, period):
    end = await db.fetchval("SELECT max(block_time) FROM market_trade_blocks")
    now = datetime.now(timezone.utc)
    if not end or not -60 <= (now - end).total_seconds() <= 180:
        raise ValueError("Node trade history is warming or delayed")
    start = end - timedelta(hours=1 if period == "1h" else 24)
    boundary = await db.fetchval(
        "SELECT max(block_number) FROM market_trade_blocks WHERE block_time <= $1", start
    )
    if boundary is None:
        raise ValueError("Incomplete node trade window")
    row = await db.fetchrow(
        """SELECT count(*) AS blocks,min(block_number) AS first,
      max(block_number) AS last,
      coalesce(sum(buy_rao) FILTER(WHERE block_time > $2),0) AS buy,
      coalesce(sum(sell_rao) FILTER(WHERE block_time > $2),0) AS sell,
      coalesce(sum(trades) FILTER(WHERE block_time > $2),0) AS trades
      FROM market_trade_blocks WHERE block_number >= $1 AND block_time <= $3""",
        boundary,
        start,
        end,
    )
    if row["blocks"] != row["last"] - row["first"] + 1:
        raise ValueError("Gap in finalized trade coverage")
    return dict(
        buy=float(row["buy"] / Decimal(10**9)),
        sell=float(row["sell"] / Decimal(10**9)),
        trades=row["trades"],
        count=128,
        asOf=end.isoformat(),
        windowStart=start.isoformat(),
        source="Shizzy finalized chain index",
        fromBlock=row["first"],
        toBlock=row["last"],
    )
