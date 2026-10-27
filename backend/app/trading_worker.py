"""Independent live and historical lanes; history cannot hold up current totals."""

import asyncio
import logging
from datetime import datetime
from decimal import Decimal
from app.chain import ChainClient
from app.rpc import finalized_heads

log = logging.getLogger("shizzy.trading")
# Runtime 486 reviewed against RaoFoundation/subtensor commit
# 72323e13249c9e25c7e792a2b3c08502c84651d5: stake/event semantics unchanged;
# only GetStakeAvailabilityV1 read-weight accounting and version changed.
# Evidence: public/evidence/2026-10-26-chain-monitor-2048.json.
REVIEWED_TRADE_RUNTIMES = frozenset({484, 486})


def require_trade_runtime(version):
    if version not in REVIEWED_TRADE_RUNTIMES:
        raise ValueError(f"Trade event semantics need runtime review (spec {version})")


INSERT = """INSERT INTO market_trade_blocks_v2
 (block_number,block_hash,block_time,buy_rao,sell_rao,trades)
 VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING"""


async def read_trade_block(chain, number, parse, known=None):
    if known:
        # Existing finalized block provenance avoids fetching its hash and
        # timestamp again. Events are still decoded afresh, even if the old
        # enrichment indexer failed to collect that block's events.
        block_hash, stamp = known["block_hash"], known["block_time"]
        records = await chain.client._substrate.query("System", "Events", block_hash=block_hash)
    else:
        view = await chain.client.at(number)
        records = await view.query(("System", "Events"))
        stamp = await view.timestamp()
        block_hash = await chain.client._block_hash(number)
    values = parse(records)
    if not isinstance(stamp, datetime) or not block_hash:
        raise ValueError("Missing finalized block provenance")
    return (
        number,
        str(block_hash),
        stamp,
        Decimal(values["buy"]),
        Decimal(values["sell"]),
        values["trades"],
    )


def live_trade_numbers(last, end):
    # A restart can be hours behind. Pin the head lane to at most64 blocks;
    # the independent bounded history scan repairs every older missing block.
    first = max(1, end - 63, last + 1 if last is not None else 1)
    return range(first, end + 1)


async def run_trading(db, settings, parse):
    async def lane(history):
        endpoints = list(dict.fromkeys([settings.backfill_ws_url, *settings.subtensor_ws_urls]))
        endpoint = 0
        while True:
            heads = None
            try:
                async with ChainClient(settings, endpoint_url=endpoints[endpoint]) as chain:
                    require_trade_runtime(await chain.client.spec_version())
                    seconds = await chain.client.block_time()
                    if not 0 < seconds <= 60:
                        raise ValueError("Invalid chain block time")
                    semaphore = asyncio.Semaphore(6 if history else 4)

                    async def collect(number, known=None):
                        async with semaphore, asyncio.timeout(35):
                            return await read_trade_block(chain, number, parse, known)

                    if not history:
                        heads = finalized_heads(endpoints[endpoint])
                    while True:
                        require_trade_runtime(await chain.client.spec_version())
                        if history:
                            end = await db.fetchval(
                                "SELECT max(block_number) FROM market_trade_blocks_v2"
                            )
                            if end is None:
                                await asyncio.sleep(5)
                                continue
                            target = max(1, end - int(26 * 3600 / seconds))
                            # Repair internal outage gaps as well as the early boundary.
                            # Newest holes first restores the hourly window before 24h.
                            missing = await db.fetch(
                                """SELECT n FROM generate_series($1::bigint,$2::bigint) n
                                LEFT JOIN market_trade_blocks_v2 b ON b.block_number=n
                                WHERE b.block_number IS NULL ORDER BY n DESC LIMIT 64""",
                                target, end,
                            )
                            if not missing:
                                await asyncio.sleep(60)
                                continue
                            numbers = [row["n"] for row in missing]
                        else:
                            head = await asyncio.wait_for(anext(heads), 45)
                            end = head["number"]
                            last = await db.fetchval(
                                "SELECT max(block_number) FROM market_trade_blocks_v2"
                            )
                            numbers = live_trade_numbers(last, end)
                        pending = list(numbers)
                        # Live tails never wait on a long historical backlog.
                        # Missing blocks are repaired by the history lane; reads
                        # still require every block in their complete window.
                        for offset in range(0, len(pending), 64):
                            chunk = pending[offset : offset + 64]
                            provenance = await db.fetch(
                                "SELECT block_number,block_hash,block_time FROM chain_blocks WHERE block_number=ANY($1::bigint[]) AND finalized=true",
                                chunk,
                            )
                            known = {row["block_number"]: row for row in provenance}
                            batch = await asyncio.gather(*(collect(n, known.get(n)) for n in chunk))
                            if batch:
                                await db.executemany(INSERT, batch)
                        if history:
                            log.info("trade history repaired=%s oldest=%s newest=%s target=%s", len(pending), min(pending), max(pending), target)
                        else:
                            log.info("trade live through=%s repaired=%s", end, len(pending))
                            await db.execute(
                                "DELETE FROM market_trade_blocks_v2 WHERE block_time<now()-interval '3 days'"
                            )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.warning(
                    "trade %s lane paused: %s", "history" if history else "live", type(exc).__name__
                )
                endpoint = (endpoint + 1) % len(endpoints)
                await asyncio.sleep(15)
            finally:
                if heads is not None:
                    await heads.aclose()

    await asyncio.gather(lane(False), lane(True))
