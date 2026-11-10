import json
from decimal import Decimal
from datetime import datetime, timedelta, timezone

import pytest

from app.api import (
    _refresh_candle_cache,
    _refresh_live_screener,
    _refresh_screener,
    app,
    chain_activity,
    health,
    liveness,
)


class RecordingDatabase:
    def __init__(self):
        self.queries = []

    async def fetch(self, query, *args):
        self.queries.append(query)
        return []

    async def fetchrow(self, query, *args):
        self.queries.append(query)
        return {
            "locked_alpha_24h": 0,
            "unlocked_alpha_24h": 0,
            "locked_tao_24h": 0,
            "unlocked_tao_24h": 0,
            "stake_moves_24h": 0,
            "event_count_24h": 0,
            "tao_moved_24h": 0,
            "largest_move_tao_24h": 0,
            "active_subnets_24h": 0,
        }

    async def fetchval(self, query, *args):
        self.queries.append(query)


@pytest.mark.asyncio
async def test_activity_summary_filters_history_before_price_join():
    database = RecordingDatabase()
    app.state.db = database

    await chain_activity(netuid=None, limit=50)

    summary_query = database.queries[1]
    window_position = summary_query.index("WHERE time >= now()-interval '24 hours'")
    join_position = summary_query.index("LEFT JOIN LATERAL")
    assert window_position < join_position
    assert "FROM recent_events e" in summary_query


@pytest.mark.asyncio
async def test_activity_price_lookups_are_bounded_before_enrichment():
    database = RecordingDatabase()
    app.state.db = database

    await chain_activity(netuid=58, limit=200)

    event_query, summary_query = database.queries[:2]
    # PostgreSQL must select the requested page before historical-price enrichment.
    assert "selected_events AS MATERIALIZED" in event_query
    assert event_query.index("LIMIT $2") < event_query.index("LEFT JOIN LATERAL")
    assert "FROM selected_events e" in event_query
    # Only lock/unlock totals use historical prices; moves must not trigger lookups.
    assert "WHERE e.event_type IN ('StakeLocked','StakeUnlocked')" in summary_query
    recent = summary_query[:summary_query.index("SELECT\n              COALESCE")]
    assert "netuid=$1 OR destination_netuid=$1" in recent


@pytest.mark.asyncio
async def test_screener_uses_yield_metrics_from_latest_sample():
    database = RecordingDatabase()
    app.state.db = database

    await _refresh_screener(app)

    query = database.queries[0]
    assert "conviction_locked_alpha,tempo" in query
    assert "staker_epoch_dividends_alpha,circulating_alpha" in query
    assert "last_yield" not in query
    assert "100 * l.conviction_locked_alpha / l.alpha_out" in query
    assert "l.alpha_reserve, 0) + COALESCE(l.alpha_out" not in query
    assert "l.price_tao * l.circulating_alpha" in query
    assert "COALESCE(l.circulating_alpha" not in query


@pytest.mark.asyncio
async def test_live_screener_updates_price_without_discarding_history_metrics():
    class LiveDatabase:
        async def fetch(self, query):
            assert "FROM subnet_latest_samples p" in query
            return [{"netuid": 64, "block_number": 123, "price_tao": 0.5}]

    app.state.db = LiveDatabase()
    app.state.screener_cache = {
        "data": [{"netuid": 64, "block_number": 122, "price_tao": 0.4, "change_1h": 2.5}],
        "cached_at": datetime.now(timezone.utc),
    }

    result = await _refresh_live_screener(app)

    assert result["data"][0]["block_number"] == 123
    assert result["data"][0]["price_tao"] == 0.5
    assert result["data"][0]["change_1h"] == 2.5


@pytest.mark.asyncio
@pytest.mark.parametrize("current,baseline,expected", [
    ("12", "0.10", "2"),
    ("8", "0.10", "-2"),
    ("10", "0.10", "0"),
])
async def test_live_emission_direction_uses_retained_daily_share(current, baseline, expected):
    class LiveDatabase:
        async def fetch(self, query):
            return [{"netuid": 64, "emission_pct": Decimal(current)}]

    app.state.db = LiveDatabase()
    app.state.screener_cache = {"data": [{
        "netuid": 64,
        "emission_share_24h": Decimal(baseline),
        "emission_change_24h": Decimal("999"),
    }]}
    result = await _refresh_live_screener(app)
    assert result["data"][0]["emission_change_24h"] == Decimal(expected)


@pytest.mark.asyncio
async def test_long_candles_use_bounded_index_lookups():
    database = RecordingDatabase()
    app.state.db = database
    app.state.candle_cache = {}

    result = await _refresh_candle_cache((64, "10m", 180), 64, "10m", 180)

    query = database.queries[0]
    assert "generate_series" in query
    assert "time < b.bucket+b.step" in query
    assert result["method"] == "boundary"


class HealthDatabase:
    async def fetchval(self, _query):
        return 1

    def __init__(self, market_age_seconds):
        self.queries = []
        now = datetime.now(timezone.utc)
        self.rows = [
            {"block_number": 100, "block_time": now, "indexed_at": now},
            {"block_number": 99, "time": now - timedelta(seconds=market_age_seconds)},
        ]

    async def fetchrow(self, query):
        self.queries.append(query)
        return self.rows.pop(0)


@pytest.mark.asyncio
async def test_health_reports_actual_market_staleness():
    database = HealthDatabase(market_age_seconds=120)
    app.state.db = database

    result = await health()
    payload = json.loads(result.body)

    assert result.status_code == 503
    assert payload["status"] == "degraded"
    assert payload["reason"].startswith("market prices stale by")
    assert payload["market_lag_seconds"] >= 120
    assert "WHERE netuid=0" in database.queries[1]


@pytest.mark.asyncio
async def test_liveness_does_not_require_database():
    app.state.db = None

    assert await liveness() == {"status": "ok"}
