"""Finalized, contiguous TAO/alpha trade windows. RPC runs only in the worker."""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.chain import _plain, field, scale_int

log = logging.getLogger("shizzy.trading")
SCHEMA = """CREATE TABLE IF NOT EXISTS market_trade_blocks_v2 (
 block_number BIGINT PRIMARY KEY, block_hash TEXT NOT NULL,
 block_time TIMESTAMPTZ NOT NULL, buy_rao NUMERIC(40,0) NOT NULL,
 sell_rao NUMERIC(40,0) NOT NULL, trades INTEGER NOT NULL,
 indexed_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE INDEX IF NOT EXISTS market_trade_time_v2_idx ON market_trade_blocks_v2(block_time);"""


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

    def basket(e):
        if field(e, "module_id") != "SubtensorModule" or field(e, "event_id") != "BasketSwapped":
            return
        a = field(e, "attributes")
        if (
            not isinstance(a, dict)
            or not {"origin_netuid", "destination_netuid", "tao_mid"} <= a.keys()
        ):
            raise ValueError("Unreviewed basket trade layout")
        origin, destination, amount = (
            scale_int(a[k]) for k in ["origin_netuid", "destination_netuid", "tao_mid"]
        )
        if amount > 0 and (
            (origin == 0 and 1 <= destination <= 128) or (destination == 0 and 1 <= origin <= 128)
        ):
            result["buy" if origin == 0 else "sell"] += amount
            result["trades"] += 1

    groups = {}
    for r in rows:
        idx = field(r, "extrinsic_idx")
        if idx is not None:
            groups.setdefault(idx, []).append(field(r, "event", default=r))
        else:
            basket(field(r, "event", default=r))
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
            if name in {"StakeSwapped", "StakeMoved", "StakeTransferred"}:
                if not isinstance(a, (list, tuple)) or len(a) != (
                    5 if name == "StakeSwapped" else 6
                ):
                    raise ValueError("Unreviewed routed stake layout")
                if name == "StakeSwapped":
                    origin, destination = (a[0], a[1], a[2]), (a[0], a[1], a[3])
                elif name == "StakeMoved":
                    origin, destination = (a[0], a[1], a[2]), (a[0], a[3], a[4])
                else:
                    origin, destination = (a[0], a[2], a[3]), (a[1], a[2], a[4])
                if (
                    scale_int(origin[2]) > 0
                    and scale_int(destination[2]) > 0
                    and origin[2] != destination[2]
                ):
                    pair = []
                    for account, kind in [(origin, "StakeRemoved"), (destination, "StakeAdded")]:
                        matches = [
                            i
                            for i in range((pair[0] + 1) if pair else 0, position)
                            if i not in routed
                            and field(peers[i], "module_id") == "SubtensorModule"
                            and field(peers[i], "event_id") == kind
                            and tuple(field(peers[i], "attributes")[:2]) == tuple(account[:2])
                            and scale_int(field(peers[i], "attributes")[4]) == scale_int(account[2])
                        ]
                        if not matches:
                            break
                        pair.append(matches[-1])
                    # Dust below the destination minimum can leave TAO free.
                    # Without a completed pair it is an actual external sale.
                    if len(pair) == 2:
                        routed.update(pair)
            basket(e)
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
    from app.trading_worker import run_trading

    await run_trading(db, settings, trade_totals)


async def trading_snapshot(db, period):
    end = await db.fetchval("SELECT max(block_time) FROM market_trade_blocks_v2")
    now = datetime.now(timezone.utc)
    if not end or not -60 <= (now - end).total_seconds() <= 180:
        raise ValueError("Node trade history is warming or delayed")
    start = end - timedelta(hours=1 if period == "1h" else 24)
    boundary = await db.fetchval(
        "SELECT max(block_number) FROM market_trade_blocks_v2 WHERE block_time <= $1", start
    )
    if boundary is None:
        raise ValueError("Incomplete node trade window")
    row = await db.fetchrow(
        """SELECT count(*) AS blocks,min(block_number) AS first,
      max(block_number) AS last,
      coalesce(sum(buy_rao) FILTER(WHERE block_time > $2),0) AS buy,
      coalesce(sum(sell_rao) FILTER(WHERE block_time > $2),0) AS sell,
      coalesce(sum(trades) FILTER(WHERE block_time > $2),0) AS trades
      FROM market_trade_blocks_v2 WHERE block_number >= $1 AND block_time <= $3""",
        boundary,
        start,
        end,
    )
    if row["blocks"] != row["last"] - row["first"] + 1:
        raise ValueError("Gap in finalized trade coverage")
    return dict(
        methodVersion=2,
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
