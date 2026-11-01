export type MonthCandle = { time: number; open: number; close: number };
export type ReturnCell = { month: number; value: number; open: number; close: number; current: boolean; partial: boolean };
export function parseMonthCandles(raw: unknown): MonthCandle[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error("Monthly prices unavailable");
  const rows = raw.map((row): MonthCandle => {
    if (!Array.isArray(row)) throw new Error("Invalid monthly candle");
    const time = Number(row[0]), open = Number(row[1]), close = Number(row[4]);
    const date = new Date(time);
    if (![time, open, close].every(Number.isFinite) || open <= 0 || close <= 0 || date.getUTCDate() !== 1 || date.getUTCHours() !== 0) throw new Error("Invalid monthly price");
    return { time, open, close };
  }).sort((a, b) => a.time - b.time);
  for (let i = 1; i < rows.length; i++) {
    const prior = new Date(rows[i - 1].time);
    if (rows[i].time !== Date.UTC(prior.getUTCFullYear(), prior.getUTCMonth() + 1, 1)) throw new Error("Monthly history has gaps or duplicates");
  }
  return rows;
}
export function monthlyReturns(candles: MonthCandle[], asOf: number) {
  const now = new Date(asOf), current = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const available = candles.filter(c => c.time <= current);
  const years = [...new Set(available.map(c => new Date(c.time).getUTCFullYear()))].sort((a, b) => b - a);
  return years.map(year => {
    const inYear = available.filter(c => new Date(c.time).getUTCFullYear() === year);
    const months: (ReturnCell | null)[] = Array.from({ length: 12 }, (_, month) => {
      const c = inYear.find(row => new Date(row.time).getUTCMonth() === month);
      return c ? { month, value: (c.close / c.open - 1) * 100, open: c.open, close: c.close, current: c.time === current, partial: c.time === available[0]?.time } : null;
    });
    const first = inYear[0], last = inYear.at(-1)!;
    return { year, months, value: (last.close / first.open - 1) * 100, current: year === now.getUTCFullYear(), partial: first.time === available[0]?.time || new Date(first.time).getUTCMonth() !== 0 };
  });
}
