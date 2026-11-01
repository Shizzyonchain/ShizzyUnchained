export const returnPeriods = { "10m": 600, "1h": 3600, "24h": 86400, "7d": 604800 } as const;
type Period = keyof typeof returnPeriods;
export type FxPoint = { time: number; usd: number; carriedFrom?: number };
export type ReturnHistory = Partial<Record<`price_${Period}_tao` | `time_${Period}`, string>>;
type ReturnRow = ReturnHistory & { price_tao: string; time?: string } & Partial<Record<`change_${Period}`, string>>;

// Use only completed minutes at or before the chain timestamp. Never look ahead
// or silently substitute a distant rate when the exchange history has a gap.
export function rateAt(points: FxPoint[], time: number): number | undefined {
  if (!Number.isFinite(time)) return undefined;
  let low = 0, high = points.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (points[mid].time <= time) low = mid + 1;
    else high = mid;
  }
  const point = points[low - 1];
  return point && time - point.time <= 120 && Number.isFinite(point.usd) && point.usd > 0 ? point.usd : undefined;
}

export function currencyReturns<T extends ReturnRow>(row: T, currency: "usd" | "tao", points: FxPoint[]): T {
  const result = { ...row };
  const now = Date.parse(row.time || "") / 1000;
  const currentRate = currency === "usd" ? rateAt(points, now) : 1;
  for (const [period, seconds] of Object.entries(returnPeriods) as [Period, number][]) {
    const key = `change_${period}` as const;
    const then = Date.parse(row[`time_${period}`] || "") / 1000;
    const baseline = Number(row[`price_${period}_tao`]);
    // Old API/cached rows remain usable in TAO mode during a rolling deployment.
    if (currency === "tao" && row[`time_${period}`] == null) continue;
    const historicalRate = currency === "usd" ? rateAt(points, then) : 1;
    const elapsed = now - then;
    const current = Number(row.price_tao);
    result[key] = Number.isFinite(current) && current > 0 && Number.isFinite(baseline) && baseline > 0
      && currentRate && historicalRate && elapsed >= seconds - 120 && elapsed <= seconds + 240
      ? String(100 * ((current * currentRate) / (baseline * historicalRate) - 1))
      : undefined;
  }
  return result;
}
// The fast backend refresh overlays current prices on older precomputed change
// fields. Derive sector returns from the same bounded price pairs as the table.
// Missing anchors must be invalid, not the legacy "trust change_*" fallback.
export function sectorPriceRows<T extends { time?: string; price_tao?: string | number; price_1h_tao?: string | number; price_24h_tao?: string | number; time_1h?: string; time_24h?: string }>(rows: T[]) {
 return rows.map(row => currencyReturns({ ...row, price_tao: String(row.price_tao ?? ""), price_1h_tao: String(row.price_1h_tao ?? ""), price_24h_tao: String(row.price_24h_tao ?? ""), time_1h: row.time_1h ?? "", time_24h: row.time_24h ?? "" }, "tao", []));
}
