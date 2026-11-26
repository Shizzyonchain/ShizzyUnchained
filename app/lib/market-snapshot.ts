export const MARKET_SNAPSHOT_MAX_AGE_MS = 3 * 60_000;
export const MARKET_SNAPSHOT_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;

export function latestSnapshotTime(rows: { time?: string | null }[]) {
  const times = rows.map(row => Date.parse(row.time || "")).filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

export function snapshotIsFresh(updatedAt: number | null, now = Date.now()) {
  return updatedAt !== null && Number.isFinite(updatedAt) && updatedAt <= now + 60_000 && now - updatedAt <= MARKET_SNAPSHOT_MAX_AGE_MS;
}

// Browser persistence is optional. A quota/security failure must never discard
// a successful live response or stop the UI recovering from a stale snapshot.
export function persistMarketSnapshot(data: unknown, storage: () => Pick<Storage, "setItem">) {
  try {
    storage().setItem("shizzy:screener", JSON.stringify({ data, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function marketSnapshotHealth(rows: { netuid: number; time?: string | null }[], now = Date.now()) {
  const alpha = rows.filter(row => row.netuid > 0);
  const stale = alpha.filter(row => !snapshotIsFresh(Date.parse(row.time || ""), now)).length;
  const unique = new Set(alpha.map(row => row.netuid));
  const complete = alpha.length >= 128 && unique.size === alpha.length && alpha.every(row => Number.isInteger(row.netuid) && row.netuid <= alpha.length);
  return { fresh: complete && stale === 0, stale, complete, count: alpha.length };
}
