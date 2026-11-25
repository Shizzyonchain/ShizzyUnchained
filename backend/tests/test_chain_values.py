from decimal import Decimal

from app.chain import (
    ChainClient,
    circulating_alpha_supply,
    emission_shares,
    fixed_to_decimal,
    parse_chain_events,
    rolled_locked_alpha,
    scale_int,
    total_locked_alpha,
)
from app.config import Settings


def test_circulating_supply_uses_pool_plus_live_stake():
    supply = circulating_alpha_supply(
        Decimal("2551990.446453411"),
        Decimal("3342138.125851868"),
    )

    assert supply == Decimal("5894128.572305279")


def test_scale_int_unwraps_bittensor_v11_codec_shapes():
    values = [
        123,
        {"bits": 123},
        {"value": {"bits": 123}},
        {"inner": {"raw": 123}},
        {"FixedU128": {"bits": 123}},
    ]

    assert [scale_int(value) for value in values] == [123] * len(values)


def test_fixed_to_decimal_preserves_binary_fraction_precision():
    assert fixed_to_decimal({"bits": 1 << 32}) == Decimal(1)
    assert fixed_to_decimal({"value": {"bits": 1 << 31}}) == Decimal("0.5")


def test_composite_storage_key_extracts_netuid_from_mapping():
    assert ChainClient._first_int({"netuid": 64}) == 64
    assert ChainClient._last_int(({"value": [1, 2, 3]}, 51)) == 51


class FakePricesNamespace:
    def __init__(self):
        self.calls = 0

    async def alpha_prices(self):
        self.calls += 1
        return {4: 0.123, 64: 1.5}


class FakePriceView:
    def __init__(self):
        self.prices = FakePricesNamespace()


class FakePriceClient:
    def __init__(self):
        self.view = FakePriceView()
        self.blocks = []

    async def at(self, block):
        self.blocks.append(block)
        return self.view


async def test_prices_at_uses_single_all_subnet_runtime_read():
    chain = ChainClient.__new__(ChainClient)
    chain.client = FakePriceClient()

    prices = await chain.prices_at(12345)

    assert prices == {4: Decimal("0.123"), 64: Decimal("1.5")}
    assert chain.client.blocks == [12345]
    assert chain.client.view.prices.calls == 1


class FakeStakeView:
    async def runtime(self, method, params):
        assert method == ("SubnetInfoRuntimeApi", "get_all_metagraphs")
        assert params == []
        return [
            {"netuid": 64, "alpha_stake": [2_000_000_000, 750_000_000]},
            {"netuid": 4, "alpha_stake": [1_250_000_000]},
            None,
        ]


async def test_actual_stake_sums_hotkey_alpha_by_subnet():
    chain = ChainClient.__new__(ChainClient)

    totals = await chain._actual_stake_by_subnet(FakeStakeView())

    assert totals == {64: Decimal("2.75"), 4: Decimal("1.25")}


def test_circulating_alpha_matches_pool_plus_live_stake():
    assert circulating_alpha_supply(
        Decimal("2.58233983"),
        Decimal("2.92766017"),
    ) == Decimal("5.51000000")


class FakeYieldView:
    def __init__(self):
        self.dividend_netuids = []

    async def query_map(self, storage, params=None):
        if storage == ("SubtensorModule", "Tempo"):
            assert params is None
            return [(4, 359), (64, 99)]
        assert storage == ("SubtensorModule", "AlphaDividendsPerSubnet")
        assert params is not None and len(params) == 1
        netuid = params[0]
        self.dividend_netuids.append(netuid)
        return {
            4: [("5HotA", 1_250_000_000)],
            64: [
                ("5HotB", 2_000_000_000),
                ("5HotC", 750_000_000),
            ],
        }[netuid]


async def test_yield_metrics_scope_dividend_reads_to_each_subnet():
    chain = ChainClient(Settings())
    view = FakeYieldView()

    metrics = await chain._subnet_yield_metrics(view, [0, 4, 64])

    assert sorted(view.dividend_netuids) == [4, 64]
    assert metrics == {
        0: (None, None),
        4: (359, Decimal("1.25")),
        64: (99, Decimal("2.75")),
    }


class FakeLockView:
    async def query_map(self, storage):
        return {
            ("SubtensorModule", "HotkeyLock"): [
                ((4, "5HotA"), {"locked_mass": 2_000_000_000, "last_update": 90}),
            ],
            ("SubtensorModule", "DecayingHotkeyLock"): [
                ((4, "5HotB"), {"locked_mass": 1_000_000_000, "last_update": 90}),
            ],
            ("SubtensorModule", "OwnerLock"): [
                (64, {"locked_mass": 3_000_000_000, "last_update": 90}),
            ],
            ("SubtensorModule", "DecayingOwnerLock"): [],
        }[storage]

    async def query(self, storage, params=None):
        if storage == ("SubtensorModule", "HasMigrationRun"):
            assert params == [list(b"migrate_one_lock_bucket_per_hotkey")]
            return False
        assert storage == ("SubtensorModule", "UnlockRate")
        return 10


async def test_locked_alpha_uses_bounded_storage_maps_and_rolls_decay():
    chain = ChainClient(Settings())

    totals = await chain._locked_alpha_by_subnet(FakeLockView(), [4, 64], 100)

    assert totals[4] == Decimal(2) + rolled_locked_alpha(
        {"locked_mass": 1_000_000_000, "last_update": 90},
        100,
        10,
        decaying=True,
    )
    assert totals[64] == Decimal(3)


async def test_migrated_locks_include_owner_once_without_removed_storage_reads():
    class Migrated(FakeLockView):
        async def query(self, storage, params=None):
            if storage == ("SubtensorModule", "HasMigrationRun"):
                return True
            return await super().query(storage, params)

        async def query_map(self, storage):
            assert storage[1] not in ("OwnerLock", "DecayingOwnerLock")
            rows = await super().query_map(storage)
            if storage[1] == "HotkeyLock":
                rows += [((64, "owner-hotkey"), {"locked_mass": 3_000_000_000, "last_update": 90})]
            return rows

    totals = await ChainClient(Settings())._locked_alpha_by_subnet(Migrated(), [4, 64], 100)
    assert totals[64] == Decimal(3)
    assert totals[4] > Decimal(2)


def test_emission_share_includes_pool_injection_and_chain_buys():
    shares = emission_shares(
        {4: Decimal("0.02"), 64: Decimal("0.03")},
        {4: Decimal("0.04"), 64: Decimal("0.01")},
    )

    assert shares == {4: Decimal("0.6"), 64: Decimal("0.4")}


def test_emission_share_handles_disabled_and_zero_allocation_subnets():
    shares = emission_shares(
        {4: Decimal("0"), 5: Decimal("0")},
        {4: Decimal("0"), 5: Decimal("0")},
    )

    assert shares == {4: Decimal("0"), 5: Decimal("0")}


class FakeBalance:
    def __init__(self, rao: int):
        self.rao = rao

    @property
    def tao(self):
        raise ValueError("alpha balances cannot be read as TAO")


def test_total_locked_alpha_uses_bittensor_v11_aggregate():
    result = {
        "total_locked_alpha": FakeBalance(1_500_000_000),
        "hotkeys": [{"locked_alpha": FakeBalance(999)}],
    }

    assert total_locked_alpha(result) == Decimal("1.5")


def test_total_locked_alpha_falls_back_to_hotkey_entries():
    result = {
        "hotkeys": [
            {"locked_alpha": FakeBalance(1_250_000_000)},
            {"locked_alpha": FakeBalance(750_000_000)},
        ]
    }

    assert total_locked_alpha(result) == Decimal("2")


def test_parse_chain_events_tracks_named_conviction_lock_fields():
    records = [{
        "event": {
            "module_id": "SubtensorModule",
            "event_id": "StakeLocked",
            "attributes": {
                "who": "5Cold",
                "hotkey": "5Hot",
                "netuid": 64,
                "amount": FakeBalance(2_500_000_000),
            },
        }
    }]

    event = parse_chain_events(records)[0]
    assert event["event_type"] == "StakeLocked"
    assert event["coldkey"] == "5Cold"
    assert event["hotkey"] == "5Hot"
    assert event["netuid"] == 64
    assert event["amount_alpha"] == Decimal("2.5")


def test_parse_chain_events_tracks_positional_stake_transfer_fields():
    records = [{
        "event": {
            "pallet": "SubtensorModule",
            "name": "StakeTransferred",
            "fields": ["5From", "5To", "5Hot", 4, 64, FakeBalance(3_000_000_000)],
        }
    }]

    event = parse_chain_events(records)[0]
    assert event["coldkey"] == "5From"
    assert event["destination_coldkey"] == "5To"
    assert event["netuid"] == 4
    assert event["destination_netuid"] == 64
    assert event["amount_tao"] == Decimal("3")


def test_parse_chain_events_converts_raw_scale_balance_from_rao():
    records = [{
        "module_id": "SubtensorModule",
        "event_id": "StakeUnlocked",
        "attributes": ["5Cold", "5Hot", 9, 1_250_000_000],
    }]

    assert parse_chain_events(records)[0]["amount_alpha"] == Decimal("1.25")


def test_parse_chain_events_ignores_unrelated_runtime_events():
    records = [
        {"event": {"module_id": "Balances", "event_id": "Transfer", "attributes": []}},
        {"event": {"module_id": "SubtensorModule", "event_id": "NeuronRegistered", "attributes": []}},
    ]

    assert parse_chain_events(records) == []
