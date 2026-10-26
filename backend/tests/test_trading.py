from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from app.trading import trade_totals, trading_snapshot


def event(name, attributes=None, module="SubtensorModule", idx=1):
    return {
        "extrinsic_idx": idx,
        "event": {"module_id": module, "event_id": name, "attributes": attributes},
    }


def stake(name, sn, tao, alpha=100, cold="cold"):
    return event(name, [cold, "hot", tao, alpha, sn, 0])


SUCCESS = event("ExtrinsicSuccess", {}, "System")


def test_trades_use_native_amounts_exclude_root_failed_and_explicit_alpha_fees():
    rows = [
        stake("StakeAdded", 1, 5000000000),
        stake("StakeRemoved", 2, 2000000000),
        stake("StakeAdded", 0, 9000000000),
        stake("StakeRemoved", 2, 120, alpha=7),
        event(
            "TransactionFeePaidWithAlpha",
            {"who": "cold", "netuid": 2, "alpha_fee": 7, "tao_amount": 100},
        ),
        SUCCESS,
    ]
    assert trade_totals(rows) == {"buy": 5000000000, "sell": 2000000000, "trades": 2}
    assert trade_totals(
        rows[:-1]
        + [event("ExtrinsicFailed", {}, "System"), event("ExtrinsicSuccess", {}, "System", idx=0)]
    ) == {"buy": 0, "sell": 0, "trades": 0}
    assert trade_totals(
        [
            stake("StakeAdded", 1, 999),
            event("StakeAdded", ["cold", "hot", 999, 1, 1, 0], idx=None),
            event("ExtrinsicSuccess", {}, "System", idx=0),
        ]
    ) == {"buy": 0, "sell": 0, "trades": 0}


def test_repeated_alpha_routes_in_batch_do_not_hide_a_separate_external_buy():
    rows = []
    for _ in range(2):
        rows += [
            stake("StakeRemoved", 1, 500),
            stake("StakeAdded", 2, 490),
            event("StakeSwapped", ["cold", "hot", 1, 2, 500]),
        ]
    rows += [stake("StakeAdded", 2, 700), event("BatchInterrupted", {}, "Utility"), SUCCESS]
    assert trade_totals(rows) == {"buy": 700, "sell": 0, "trades": 1}


def test_root_to_alpha_swap_still_counts_external_alpha_buy_and_unknown_layout_blocks():
    rows = [
        stake("StakeRemoved", 0, 500),
        stake("StakeAdded", 2, 490),
        event("StakeSwapped", ["cold", "hot", 0, 2, 500]),
        SUCCESS,
    ]
    assert trade_totals(rows)["buy"] == 490
    with pytest.raises(ValueError):
        trade_totals([event("StakeAdded", [1, 2, 3]), SUCCESS])


class Window:
    def __init__(self, gap=False, stale=False):
        self.end = datetime.now(timezone.utc) - timedelta(minutes=10 if stale else 1)
        self.gap = gap

    async def fetchval(self, query, *args):
        return 100 if args else self.end

    async def fetchrow(self, query, *args):
        return {
            "blocks": 299 if self.gap else 300,
            "first": 100,
            "last": 399,
            "buy": Decimal(1500000000),
            "sell": Decimal(250000000),
            "trades": 7,
        }


async def test_node_windows_require_contiguous_coverage_and_keep_hour_day_separate():
    db = Window()
    hour = await trading_snapshot(db, "1h")
    day = await trading_snapshot(db, "24h")
    assert hour["buy"] == 1.5 and hour["sell"] == 0.25
    assert datetime.fromisoformat(hour["asOf"]) - datetime.fromisoformat(
        hour["windowStart"]
    ) == timedelta(hours=1)
    assert datetime.fromisoformat(day["asOf"]) - datetime.fromisoformat(
        day["windowStart"]
    ) == timedelta(days=1)
    with pytest.raises(ValueError):
        await trading_snapshot(Window(gap=True), "1h")
    with pytest.raises(ValueError):
        await trading_snapshot(Window(stale=True), "24h")
