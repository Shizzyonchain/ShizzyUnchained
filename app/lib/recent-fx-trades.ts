import type { FxPoint } from "./currency-returns";

// Actual trade timestamps supplement lagging candle publication. No invented
// minute closes, look-ahead, or extension of an old quote into the present.
export function recentFxTrades(raw: unknown, now: number): FxPoint[] {
  if (!Array.isArray(raw)) return [];
  const points = new Map<number, FxPoint>();
  for (const row of [...raw].reverse()) {
    const time = Date.parse(row?.time) / 1000, usd = Number(row?.price);
    if (Number.isFinite(time) && time <= now && time >= now - 10800 && Number.isFinite(usd) && usd > 0) points.set(time, { time, usd });
  }
  return [...points.values()].sort((a,b)=>a.time-b.time);
}
