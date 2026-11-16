export type Candle = {
  time: string; open: string; high: string; low: string; close: string; volume_tao?: string;
};
export type PriceBar = { time: number; open: number; high: number; low: number; close: number; volume: number };
export function mergeChartCandles(older: Candle[], newer: Candle[]): Candle[] {
  const unique = new Map<number, Candle>();
  for (const candle of [...older, ...newer]) {
    const time = Date.parse(candle.time);
    if (Number.isFinite(time)) unique.set(time, candle);
  }
  return [...unique.entries()].sort((a,b) => a[0] - b[0]).map(([,candle]) => candle);
}
export const chartIntervals: Record<string, number> = { "1m": 60, "10m": 600, "1h": 3600, "1d": 86400 };

// Time-only chart space, never forecast prices or volume. Calendar months must
// advance by month rather than repeating the length of the latest month.
export function futureChartTimes(last: number | undefined, interval: string): number[] {
  if (last === undefined || !Number.isFinite(last)) return [];
  const count = interval === "1mo" ? 60 : interval === "1w" ? 104 : interval === "1d" ? 365 : 288;
  const date = new Date(last * 1000);
  return Array.from({ length: count }, (_, i) => interval === "1mo"
    ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + i + 1, 1) / 1000
    : last + (i + 1) * (interval === "1w" ? 604800 : chartIntervals[interval] || 3600));
}

// Invalid/incomplete rows must not become zero-price candles or invented history.
export function priceBars(candles: Candle[]): PriceBar[] {
  const unique = new Map<number, PriceBar>();
  for (const candle of candles) {
    const time = Math.floor(Date.parse(candle.time) / 1000);
    if ([candle.open, candle.high, candle.low, candle.close].some(value => value == null || value.trim() === "")) continue;
    const [open, high, low, close] = [candle.open, candle.high, candle.low, candle.close].map(Number);
    if (!Number.isFinite(time) || [open, high, low, close].some(value => !Number.isFinite(value) || value <= 0)) continue;
    if (low > Math.min(open, close) || high < Math.max(open, close) || low > high) continue;
    const volume = Number(candle.volume_tao);
    unique.set(time, { time, open, high, low, close, volume: Number.isFinite(volume) && volume >= 0 ? volume : 0 });
  }
  return [...unique.values()].sort((a, b) => a.time - b.time);
}

// TaoStats volume_24h is rolling USD activity, not volume for this candle.
export function taoPriceCandles(payload: unknown): Candle[] {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) throw new Error("Invalid TAO price history");
  return priceBars(payload.data.flatMap(row => {
    if (!row || typeof row !== "object" || typeof row.timestamp !== "string" ||
      ![row.open, row.high, row.low, row.close].every(value => typeof value === "string")) return [];
    return [{ time: row.timestamp, open: row.open, high: row.high, low: row.low, close: row.close }];
  })).map(bar => ({ time: new Date(bar.time * 1000).toISOString(), open: String(bar.open), high: String(bar.high), low: String(bar.low), close: String(bar.close) }));
}

// OHLC products do not reveal simultaneous extrema. USD high/low are bounds,
// explicitly labelled as estimates in the UI; never multiply all history by spot.
export function dollarBars(bars: PriceBar[], exchange: PriceBar[]): PriceBar[] {
  const rates = new Map(exchange.map(bar => [bar.time, bar]));
  return bars.flatMap(bar => {
    const rate = rates.get(bar.time);
    return rate ? [{ ...bar, open: bar.open * rate.open, high: bar.high * rate.high,
      low: bar.low * rate.low, close: bar.close * rate.close }] : [];
  });
}

export function aggregateBars(bars: PriceBar[], seconds: number): PriceBar[] {
  const buckets = new Map<number, PriceBar>();
  for (const bar of bars) {
    const time = Math.floor(bar.time / seconds) * seconds;
    const previous = buckets.get(time);
    buckets.set(time, previous ? { ...previous, high: Math.max(previous.high, bar.high), low: Math.min(previous.low, bar.low),
      close: bar.close, volume: previous.volume + bar.volume } : { ...bar, time });
  }
  return [...buckets.values()];
}

export function indicatorPoints(bars: PriceBar[], period = 20) {
  let exponential = bars[0]?.close || 0;
  const multiplier = 2 / (period + 1);
  return bars.map((bar, index) => {
    exponential += multiplier * (bar.close - exponential);
    const window = bars.slice(Math.max(0, index - period + 1), index + 1);
    const mean = window.reduce((sum, item) => sum + item.close, 0) / window.length;
    const deviation = Math.sqrt(window.reduce((sum, item) => sum + (item.close - mean) ** 2, 0) / window.length);
    return { time: bar.time, ready: window.length === period, ma: mean, ema: exponential, upper: mean + 2 * deviation, lower: mean - 2 * deviation };
  });
}

export function chartPrecision(value: number) {
  if (!(value > 0)) return 4;
  return Math.max(2, Math.min(10, 3 - Math.floor(Math.log10(value))));
}

// Calendar candles: weeks start Monday UTC; months start on the first UTC day.
// Convert daily alpha prices to USD before grouping, preserving historical FX.
export function calendarBars(bars: PriceBar[], interval: string): PriceBar[] {
  if (interval !== "1w" && interval !== "1mo") return bars;
  const buckets = new Map<number, PriceBar>();
  for (const bar of [...bars].sort((a, b) => a.time - b.time)) {
    const date = new Date(bar.time * 1000);
    const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const time = (interval === "1mo" ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) : day - ((date.getUTCDay() + 6) % 7) * 86400000) / 1000;
    const prior = buckets.get(time);
    buckets.set(time, prior ? { ...prior, high: Math.max(prior.high, bar.high), low: Math.min(prior.low, bar.low), close: bar.close, volume: prior.volume + bar.volume } : { ...bar, time });
  }
  return [...buckets.values()];
}

// Live updates touch only the current/recent candle, never backfill stale archives.
export function withLiveCandle(candles: Candle[], spotPrice: number, timeframe: string, now = Date.now()) {
  if (!candles.length || !Number.isFinite(spotPrice) || spotPrice <= 0) return candles;
  const interval = ({ "1m": 60_000, "10m": 600_000, "1h": 3_600_000, "1d": 86_400_000 } as Record<string, number>)[timeframe] || 60_000;
  const bucketTime = Math.floor(now / interval) * interval;
  const last = candles.at(-1)!;
  const lastTime = new Date(last.time).getTime();
  if (!Number.isFinite(lastTime)) return candles;
  // Do not draw a synthetic spot candle across stale archive history.
  // That creates a misleading vertical jump while the indexer fills the gap.
  if (bucketTime - lastTime > interval * 2) return candles;
  const updated = [...candles];
  if (lastTime < bucketTime) {
    const previousClose = Number(last.close);
    updated.push({
      time: new Date(bucketTime).toISOString(),
      open: String(previousClose),
      high: String(Math.max(previousClose, spotPrice)),
      low: String(Math.min(previousClose, spotPrice)),
      close: String(spotPrice),
      volume_tao: "0",
    });
    return updated;
  }
  updated[updated.length - 1] = {
    ...last,
    high: String(Math.max(Number(last.high), spotPrice)),
    low: String(Math.min(Number(last.low), spotPrice)),
    close: String(spotPrice),
  };
  return updated;
}


// Preserve provider OHLC; extend only with validated, consecutive node buckets.
// Node volumes use TAO rather than alpha, so mixed-source callers hide volume.
export function extendChartHistory(history: Candle[], recent: Candle[], timeframe: string, now = Date.now()): Candle[] {
 const seconds = chartIntervals[timeframe === "1w" || timeframe === "1mo" ? "1d" : timeframe];
 if (!seconds || !history.length) return history;
 const step = seconds * 1000, current = Math.floor(now / step) * step;
 let last = Date.parse(history.at(-1)!.time);
 const result = [...history];
 for (const bar of priceBars(recent)) {
  const time = bar.time * 1000;
  if (time <= last) continue;
  if (time > current || time !== last + step) break;
  result.push({time:new Date(time).toISOString(),open:String(bar.open),high:String(bar.high),low:String(bar.low),close:String(bar.close),volume_tao:String(bar.volume)});
  last = time;
 }
 return result;
}
export function chartNeedsRecentHistory(history: Candle[], timeframe: string, now = Date.now()) {
 const seconds = chartIntervals[timeframe === "1w" || timeframe === "1mo" ? "1d" : timeframe];
 return !!seconds && !!history.length && Date.parse(history.at(-1)!.time) < Math.floor(now / (seconds*1000)) * seconds*1000;
}
