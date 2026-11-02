import type { MonthCandle } from "./monthly-returns";
/** Observed first-open to last-close windows, with no interpolation across missing months. */
export function rollingReturns(candles: MonthCandle[], asOf: number, months: number) {
  if (![3, 6, 12].includes(months) || !Number.isFinite(asOf)) return [];
  const now = new Date(asOf), boundary = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const full = sorted.slice(1).filter(c => c.time < boundary);
  return full.flatMap((last, i) => {
    if (i < months - 1) return [];
    const window = full.slice(i - months + 1, i + 1), first = window[0];
    if (window.some((c, j) => ![c.time, c.open, c.close].every(Number.isFinite) || c.open <= 0 || c.close <= 0 || c.time !== Date.UTC(new Date(first.time).getUTCFullYear(), new Date(first.time).getUTCMonth() + j, 1))) return [];
    const value = (last.close / first.open - 1) * 100;
    return Number.isFinite(value) ? [{ start: first.time, end: last.time, open: first.open, close: last.close, value }] : [];
  });
}
