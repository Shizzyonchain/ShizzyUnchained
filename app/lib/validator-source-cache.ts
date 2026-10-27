// Shared completed generations keep pages coherent and retries bounded.
// Evidence timestamps remain provider timestamps; cache age never refreshes them.
export type SourcePage<T> = { data: T[]; pagination: { current_page: number; next_page: number | null; total_items: number } };
type Cache = { get(key: string): Promise<unknown>; set(key: string, value: unknown, options: { ttl: number }): Promise<unknown>; delete(key: string): Promise<unknown> };
type Manifest = { generation: string; pages: number; completedAt: number };
export const validatorSourceTtl = (path: string) => path === "/v1/validators/yield" ? 2700 : 1800;
export async function cachedValidatorCollection<T>(cache: Cache, identity: string, ttl: number, read: (page: number) => Promise<SourcePage<T>>, now = Date.now): Promise<T[]> {
  const prefix = `source:${identity}`;
  async function completed(manifest: Manifest) {
    const pages = await Promise.all(Array.from({ length: manifest.pages }, (_, i) => cache.get(`${prefix}:${manifest.generation}:${i + 1}`) as Promise<SourcePage<T> | undefined>));
    if (pages.some(page => !page)) return null;
    const rows = pages.flatMap(page => page!.data);
    if (rows.length !== pages[0]!.pagination.total_items) return null;
    return rows;
  }
  const previous = await cache.get(`${prefix}:complete`) as Manifest | undefined;
  if (previous && now() >= previous.completedAt && now() - previous.completedAt < ttl * 1000) {
    const rows = await completed(previous);
    if (rows) return rows;
  }
  // Best-effort cross-instance lease. No stale or partial generation ranks visitors.
  if (await cache.get(`${prefix}:preparing`)) throw new Error("Shared validator sources are being prepared; previous recommendations retained.");
  await cache.set(`${prefix}:preparing`, true, { ttl: 120 });
  try {
    let generation = await cache.get(`${prefix}:progress`) as string | undefined;
    if (!generation) {
      generation = `${now()}`;
      await cache.set(`${prefix}:progress`, generation, { ttl: 600 });
    }
    const rows: T[] = [];
    for (let page = 1; page <= 128; page++) {
      const pageKey = `${prefix}:${generation}:${page}`;
      let payload = await cache.get(pageKey) as SourcePage<T> | undefined;
      if (!payload) {
        payload = await read(page);
        if (!Array.isArray(payload.data) || payload.pagination?.current_page !== page || !Number.isInteger(payload.pagination.total_items) || payload.pagination.total_items < 0) throw new Error("Incomplete validator source response.");
        await cache.set(pageKey, payload, { ttl: 7200 });
      }
      if (!Array.isArray(payload.data) || payload.pagination?.current_page !== page) throw new Error("Invalid validator source checkpoint.");
      rows.push(...payload.data);
      if (payload.pagination.next_page === null) {
        if (rows.length !== payload.pagination.total_items) {
          await cache.delete(`${prefix}:progress`);
          throw new Error("Validator coverage changed during preparation; complete retry required.");
        }
        await cache.set(`${prefix}:complete`, { generation, pages: page, completedAt: now() }, { ttl });
        await cache.delete(`${prefix}:progress`);
        await cache.delete(`${prefix}:preparing`);
        return rows;
      }
      if (payload.pagination.next_page !== page + 1) throw new Error("Validator pagination did not advance correctly.");
    }
    throw new Error("Source exceeds bounded scan; partial results cannot rank.");
  } catch (error) {
    await cache.set(`${prefix}:preparing`, true, { ttl: 60 });
    throw error;
  }
}
