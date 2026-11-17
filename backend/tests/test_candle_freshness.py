import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from app import api


async def test_first_read_of_expired_tail_waits_and_concurrent_readers_share_refresh(monkeypatch):
    key = (51, "10m", 180)
    old = {"data": [["2026-11-16T17:10:00Z", 1, 1, 1, 1, 0]]}
    fresh = {"data": [["2026-11-17T16:10:00Z", 2, 2, 2, 2, 0]]}
    api.app.state.candle_cache = {key: {
        "cached_at": datetime.now(timezone.utc) - timedelta(hours=20), "payload": old}}
    api.app.state.candle_tasks = {}
    started, release = asyncio.Event(), asyncio.Event()
    calls = 0

    async def refresh(*args):
        nonlocal calls
        calls += 1
        started.set()
        await release.wait()
        return fresh

    monkeypatch.setattr(api, "_refresh_candle_cache", refresh)
    readers = [asyncio.create_task(api.compact_candles(51, "10m", 180)) for _ in range(5)]
    await started.wait()
    assert all(not reader.done() for reader in readers)
    release.set()
    assert await asyncio.gather(*readers) == [fresh] * 5
    assert calls == 1


async def test_failed_expired_refresh_does_not_silently_return_old_tail(monkeypatch):
    key = (51, "1h", 60)
    api.app.state.candle_cache = {key: {
        "cached_at": datetime.now(timezone.utc) - timedelta(hours=2), "payload": {"data": []}}}
    api.app.state.candle_tasks = {}

    async def failed(*args):
        raise TimeoutError("database timeout")

    monkeypatch.setattr(api, "_refresh_candle_cache", failed)
    with pytest.raises(TimeoutError):
        await api.compact_candles(51, "1h", 60)


async def test_fresh_cache_does_not_query_database(monkeypatch):
    key = (51, "10m", 60)
    payload = {"data": [["recent"]]}
    api.app.state.candle_cache = {key: {"cached_at": datetime.now(timezone.utc), "payload": payload}}

    async def unexpected(*args):
        raise AssertionError("fresh cache should be reused")

    monkeypatch.setattr(api, "_refresh_candle_cache", unexpected)
    assert await api.compact_candles(51, "10m", 60) == payload
