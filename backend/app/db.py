import asyncpg

from app.config import get_settings
from app.liquidation import LIQUIDATION_SCHEMA
from app.validator_yield import SCHEMA as VALIDATOR_YIELD_SCHEMA
from app.trading import SCHEMA as TRADING_SCHEMA

pool: asyncpg.Pool | None = None


async def connect() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(get_settings().database_url, min_size=1, max_size=10)
        async with pool.acquire() as connection, connection.transaction():
            # Both Render services can start together; serialize additive DDL.
            await connection.execute("SELECT pg_advisory_xact_lock(726494779)")
            await connection.execute(LIQUIDATION_SCHEMA)
            await connection.execute(VALIDATOR_YIELD_SCHEMA)
            await connection.execute(TRADING_SCHEMA)
    return pool


async def close() -> None:
    global pool
    if pool:
        await pool.close()
        pool = None

