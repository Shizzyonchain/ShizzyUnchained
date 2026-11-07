import type { FxPoint } from "./currency-returns";

// Coinbase omits no-tick minutes. Carry the last close across short INTERNAL
// gaps only: a later completed candle must bound the gap. Never extend the tail
// of a stalled feed, interpolate future prices, or bridge separate fetch windows.
export function completeCandleWindow(raw: unknown, now: number, maxInternalGapSeconds = 300): FxPoint[] {
  if (!Array.isArray(raw)) return [];
  const points = new Map<number, FxPoint>();
  for (const candle of raw) {
    if (!Array.isArray(candle) || candle.length < 5) continue;
    const time = Number(candle[0]) + 60, usd = Number(candle[4]);
    if (Number.isFinite(time) && time <= now && Number.isFinite(usd) && usd > 0) points.set(time, { time, usd });
  }
  const sorted = [...points.values()].sort((a, b) => a.time - b.time);
  const result: FxPoint[] = [];
  sorted.forEach((point, index) => {
    const previous = sorted[index - 1];
    if (previous && point.time - previous.time <= maxInternalGapSeconds) {
      for (let time = previous.time + 60; time < point.time; time += 60) {
        result.push({ time, usd: previous.usd, carriedFrom: previous.time });
      }
    }
    result.push(point);
  });
  return result;
}
