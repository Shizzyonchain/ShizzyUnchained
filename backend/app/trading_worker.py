"""Independent live and historical lanes; history cannot hold up current totals."""

import asyncio
import logging
from datetime import datetime
from decimal import Decimal
from app.chain import ChainClient
from app.rpc import finalized_heads

log = logging.getLogger("shizzy.trading")
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


async def run_trading(db, settings, parse):
    async def lane(history):
        endpoints = list(dict.fromkeys([settings.backfill_ws_url, *settings.subtensor_ws_urls]))
        endpoint = 0
        while True:
            heads = None
            try:
                async with ChainClient(settings, endpoint_url=endpoints[endpoint]) as chain:
                    if await chain.client.spec_version() != 484:
                        raise ValueError("Trade event semantics need runtime review")
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
                        if await chain.client.spec_version() != 484:
                            raise ValueError("Trade runtime changed")
                        if history:
                            end = await db.fetchval(
                                "SELECT max(block_number) FROM market_trade_blocks_v2"
                            )
                            first = await db.fetchval(
                                "SELECT min(block_number) FROM market_trade_blocks_v2"
                            )
                            if first is None:
                                await asyncio.sleep(5)
                                continue
                            target = max(1, end - int(26 * 3600 / seconds))
                            if first <= target:
                                await asyncio.sleep(60)
                                continue
                            numbers = range(max(target, first - 64), first)
                        else:
                            head = await asyncio.wait_for(anext(heads), 45)
                            end = head["number"]
                            last = await db.fetchval(
                                "SELECT max(block_number) FROM market_trade_blocks_v2"
                            )
                            first = (
                                last + 1
                                if last is not None
                                else max(1, end - int(70 * 60 / seconds))
                            )
                            numbers = range(first, end + 1)
                        pending = list(numbers)
                        # Prefix chunks commit atomically; never skip a hole.
                        # Live chunks are independent and always prioritize the head.
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
                            log.info("trade history earliest=%s target=%s", pending[0], target)
                        else:
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
