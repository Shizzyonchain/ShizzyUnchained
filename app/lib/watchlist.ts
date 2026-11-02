export const WATCHLIST_KEY = "shizzy.subnet-watchlist.v1";
export function readWatchlist(raw: string, allowed: number[]): number[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is number => Number.isInteger(id) && allowed.includes(id)))].slice(0, 20);
  } catch { return []; }
}
