from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from app.trading_worker import read_trade_block


async def test_history_reuses_finalized_provenance_but_always_rereads_events():
    read = AsyncMock(return_value=["new events"])
    chain = SimpleNamespace(client=SimpleNamespace(_substrate=SimpleNamespace(query=read)))
    stamp = datetime.now(timezone.utc)
    result = await read_trade_block(
        chain,
        123,
        lambda rows: {"buy": 7, "sell": 3, "trades": 2},
        {"block_hash": "0x123", "block_time": stamp},
    )
    read.assert_awaited_once_with("System", "Events", block_hash="0x123")
    assert result[0:3] == (123, "0x123", stamp)
    assert result[3:] == (7, 3, 2)


async def test_missing_provenance_reads_exact_pinned_timestamp_and_hash():
    stamp = datetime.now(timezone.utc)
    view = SimpleNamespace(
        query=AsyncMock(return_value=[]), timestamp=AsyncMock(return_value=stamp)
    )
    chain = SimpleNamespace(
        client=SimpleNamespace(
            at=AsyncMock(return_value=view), _block_hash=AsyncMock(return_value="0x456")
        )
    )
    result = await read_trade_block(chain, 456, lambda rows: {"buy": 0, "sell": 0, "trades": 0})
    chain.client.at.assert_awaited_once_with(456)
    view.timestamp.assert_awaited_once()
    assert result[:3] == (456, "0x456", stamp)


def test_reviewed_runtime_upgrade_resumes_worker_but_unknown_versions_still_stop():
    import pytest
    from app.trading_worker import require_trade_runtime
    for version in [484, 486]:
        require_trade_runtime(version)
    for version in [483, 485, 487, None]:
        with pytest.raises(ValueError, match="runtime review"):
            require_trade_runtime(version)


def test_live_lane_prioritizes_current_head_after_long_outage():
    from app.trading_worker import live_trade_numbers
    assert list(live_trade_numbers(100, 2000)) == list(range(1937, 2001))
    assert list(live_trade_numbers(1998, 2000)) == [1999, 2000]
    assert list(live_trade_numbers(2000, 2000)) == []
    assert list(live_trade_numbers(None, 20)) == list(range(1, 21))
