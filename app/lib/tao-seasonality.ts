import type { MonthCandle } from "./monthly-returns";

/** Calendar-month samples, excluding the first partial-history candle and unfinished months. */
export function taoSeasonality(candles: MonthCandle[], asOf: number, fromYear: number, toYear: number) {
  const now = new Date(asOf);
  const boundary = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const first = Math.min(...candles.map(c => c.time));
  return Array.from({ length: 12 }, (_, month) => {
    const samples = candles.filter(c => {
      const date = new Date(c.time), year = date.getUTCFullYear();
      return c.time !== first && c.time < boundary && year >= fromYear && year <= toYear && date.getUTCMonth() === month;
    }).map(c => ({ year: new Date(c.time).getUTCFullYear(), value: (c.close / c.open - 1) * 100 }));
    const values = samples.map(s => s.value).sort((a, b) => a - b), n = values.length;
    const positive = values.filter(v => v > 0).length;
    return { month, samples, n, positive, average: n ? values.reduce((a, b) => a + b, 0) / n : null,
      median: n ? (values[Math.floor((n - 1) / 2)] + values[Math.floor(n / 2)]) / 2 : null,
      best: n ? values[n - 1] : null, worst: n ? values[0] : null };
  });
}
