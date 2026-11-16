export type ChartPayload = Record<string, unknown> & { data: unknown[] };
export type ChartSnapshot = { payload: ChartPayload; checkedAt: number; retryAt?: number };
export type ChartStore = { get(key: string): Promise<unknown>; set(key: string, value: ChartSnapshot, options: { ttl: number }): Promise<unknown> };
const memory = new Map<string, ChartSnapshot>();
const pending = new Map<string, Promise<ChartSnapshot>>();
const MAX_AGE = 7 * 86400_000;
function valid(value: unknown, now: number): value is ChartSnapshot {
  const row = value as ChartSnapshot | null;
  return !!row && Number.isFinite(row.checkedAt) && row.checkedAt <= now + 60_000 && now - row.checkedAt <= MAX_AGE && Array.isArray(row.payload?.data);
}
// Serve a shared last-good history immediately. Failure never replaces it with
// an empty response or nine days of node history. Live quotes are separate.
export async function cachedChart(key: string, store: ChartStore, load: () => Promise<ChartPayload>, background: (work: () => Promise<void>) => void, now = Date.now(), awaitRefresh = false) {
  const previous = memory.get(key);
  let saved: unknown;
  try { saved = await store.get(key); } catch { /* Regional cache is optional. */ }
  const cached = valid(saved, now) ? saved : valid(previous, now) ? previous : null;
  const remember = async (snapshot: ChartSnapshot) => {
    memory.delete(key); memory.set(key, snapshot);
    while (memory.size > 256) memory.delete(memory.keys().next().value!);
    try { await store.set(key, snapshot, { ttl: 7 * 86400 }); } catch { /* Keep the warm-instance fallback. */ }
  };
  const refresh = () => {
    const existing = pending.get(key);
    if (existing) return existing;
    const task = (async () => {
      try {
        const payload = await load();
        if (!Array.isArray(payload.data) || (!payload.data.length && payload.done !== true)) throw new Error("Incomplete chart history");
        if (cached?.payload.data.length && !payload.data.length) throw new Error("Empty replacement history");
        const snapshot = { payload, checkedAt: Date.now() };
        await remember(snapshot); return snapshot;
      } catch (error) {
        if (cached) await remember({ ...cached, retryAt: Date.now() + 60_000 });
        throw error;
      }
    })().finally(() => pending.delete(key));
    pending.set(key, task); return task;
  };
  if (cached) {
    const stale = now - cached.checkedAt > 60_000;
    if (stale && awaitRefresh && (!cached.retryAt || cached.retryAt <= now)) {
      try {
        const fresh = await refresh();
        return { ...fresh.payload, historyCheckedAt: new Date(fresh.checkedAt).toISOString(), historyStale: false };
      } catch { /* Retain explicitly stale history if the bounded refresh fails. */ }
    }
    if (stale && !awaitRefresh && (!cached.retryAt || cached.retryAt <= now)) background(async () => { try { await refresh(); } catch { /* Retain dated history; retry after cooldown. */ } });
    return { ...cached.payload, historyCheckedAt: new Date(cached.checkedAt).toISOString(), historyStale: stale };
  }
  const snapshot = await refresh();
  return { ...snapshot.payload, historyCheckedAt: new Date(snapshot.checkedAt).toISOString(), historyStale: false };
}
