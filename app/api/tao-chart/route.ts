import { requestGuard } from "../../lib/request-protection";
import { chartResponse } from "../../lib/chart-cache-source";
import { NextRequest, NextResponse } from "next/server";
import { aggregateBars, chartIntervals, priceBars, taoPriceCandles } from "../../lib/chart-data";

export const revalidate = 60;

async function dailyTaoHistory(interval: string) {
  const key = process.env.TAOSTATS_API_KEY;
  if (!key) throw new Error("Price provider unavailable");
  // Load only the visible recent range; older history is paged on demand.
  const end = Math.floor(Date.now() / 86400000) * 86400 + 86400;
  const count = interval === "1d" ? 200 : interval === "1w" ? 1000 : 1800;
  const start = Math.max(Date.UTC(2021, 0, 1) / 1000, end - count * 86400);
  const span = 200 * 86400;
  const windows = Array.from({ length: Math.ceil((end - start) / span) }, (_, index) => ({
    from: start + index * span, to: Math.min(end, start + (index + 1) * span),
  }));
  const data = [];
  for (let index = 0; index < windows.length; index += 4) {
    const pages = await Promise.all(windows.slice(index, index + 4).map(async ({ from, to }) => {
      const url = new URL("https://api.taostats.io/v1/price/ohlc");
      for (const [name, value] of Object.entries({ asset: "TAO", period: "1d", timestamp_start: from, timestamp_end: to, limit: 200 })) url.searchParams.set(name, String(value));
      const response = await fetch(url, { headers: { Authorization: key }, next: { revalidate: to === end ? 1800 : 86400 }, signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error("Price history unavailable");
      return taoPriceCandles(await response.json());
    }));
    data.push(...pages.flat());
  }
  if (!data.length) throw new Error("No price history");
  return data.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

type CoinbaseCandle = [number, number, number, number, number, number];
const granularities: Record<string, number> = { "1m": 60, "10m": 300, "1h": 3600, "1d": 86400, "1w": 86400, "1mo": 86400 };

async function earlierPriceHistory(before: number, interval: string) {
  const key = process.env.TAOSTATS_API_KEY;
  if (!key) throw new Error("Price history provider unavailable");
  const minute = interval === "10m" || interval === "1m";
  const seconds = minute ? 60 : interval === "1h" ? 3600 : 86400;
  const period = minute ? "1m" : interval === "1h" ? "1h" : "1d";
  const end = Math.floor(before / (interval === "10m" ? 600 : seconds)) * (interval === "10m" ? 600 : seconds);
  const start = Math.max(Date.UTC(2021, 0, 1) / 1000, end - (minute ? 86400 : period === "1h" ? 30 * 86400 : 900 * 86400));
  const windows = Array.from({ length: Math.ceil((end - start) / (200 * seconds)) }, (_, i) => ({ from: start + i * 200 * seconds, to: Math.min(end, start + (i + 1) * 200 * seconds) }));
  const data = [];
  for (let i = 0; i < windows.length; i += 3) {
    const pages = await Promise.all(windows.slice(i, i + 3).map(async window => {
      const url = new URL("https://api.taostats.io/v1/price/ohlc");
      for (const [name, value] of Object.entries({ asset: "TAO", period, timestamp_start: window.from, timestamp_end: window.to, limit: 200 })) url.searchParams.set(name, String(value));
      const response = await fetch(url, { headers: { Authorization: key }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error("Earlier price history unavailable");
      return taoPriceCandles(await response.json());
    }));
    data.push(...pages.flat());
  }
  const bars = priceBars(data).filter(bar => bar.time < end);
  return (interval === "10m" ? aggregateBars(bars, 600) : bars).map(bar => ({ time: new Date(bar.time * 1000).toISOString(), open: String(bar.open), high: String(bar.high), low: String(bar.low), close: String(bar.close) }));
}

async function loadUncached(request: NextRequest) {
  const interval = request.nextUrl.searchParams.get("interval") || "1h";
  const granularity = granularities[interval];
  if (!granularity) return NextResponse.json({ error: "Unsupported interval" }, { status: 400 });
  const beforeParam = request.nextUrl.searchParams.get("before");
  if (beforeParam !== null) {
    const before = Number(beforeParam);
    if (!Number.isSafeInteger(before) || before < 1609459200 || before > Date.now() / 1000 + 86400) return NextResponse.json({ error: "Invalid history cursor" }, { status: 400 });
    try {
      const data = await earlierPriceHistory(before, interval);
      return NextResponse.json({ data, done: !data.length, source: "TaoStats", method: "taostats-price", interval }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=300" } });
    } catch { return NextResponse.json({ error: "Earlier TAO price history unavailable" }, { status: 503 }); }
  }
  const long = interval === "1d" || interval === "1w" || interval === "1mo";
  if (long) {
    try {
      const data = await dailyTaoHistory(interval);
      return NextResponse.json({ data, source: "TaoStats", interval, method: "taostats-price" }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
    } catch {
      // Keep the exchange chart usable when longer price history is unavailable.
    }
  }
  try {
    const end = Math.floor(Date.now() / 86400000) * 86400000 + 86400000;
    const pageCount = long ? 3 : interval === "10m" ? 3 : 1;
    const windowSeconds = 299 * granularity;
    const boundary = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
    const pages: CoinbaseCandle[][] = [];
    // Bounded concurrency respects the public exchange rate limit. Fixed older
    // windows stay cached; visitors only refresh the short, current window.
    for (let offset = 0; offset < pageCount; offset += 3) {
      const batch = await Promise.all(Array.from({ length: Math.min(3, pageCount - offset) }, async (_, slot) => {
      const index = offset + slot;
      const url = new URL("https://api.exchange.coinbase.com/products/TAO-USD/candles");
      url.searchParams.set("granularity", String(granularity));
      if (long) { url.searchParams.set("start", new Date(end - (index + 1) * 299 * 86400000).toISOString()); url.searchParams.set("end", new Date(end - index * 299 * 86400000).toISOString()); }
      else if (pageCount > 1) {
        url.searchParams.set("start", new Date((boundary - index * windowSeconds) * 1000).toISOString());
        url.searchParams.set("end", new Date((index === 0 ? Math.floor(Date.now() / 60000) * 60 : boundary - (index - 1) * windowSeconds) * 1000).toISOString());
      }
      const response = await fetch(url, { headers: { "User-Agent": "ShizzyUnchained/1.0" }, next: { revalidate: !long && index > 0 ? 86400 : 60 }, signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error("Exchange history unavailable");
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("Invalid candle response");
      return rows as CoinbaseCandle[];
      }));
      pages.push(...batch);
    }
    const raw = pages.flat();
    const normalized = raw.filter(c => Array.isArray(c) && c.length >= 6).sort((a, b) => a[0] - b[0]).map(c => ({
      time: new Date(c[0] * 1000).toISOString(), low: String(c[1]), high: String(c[2]),
      open: String(c[3]), close: String(c[4]), volume_tao: String(c[5]),
    }));
    // Use UTC bucket boundaries, not adjacent pairs: missing 5-minute trades
    // must not join two unrelated buckets or shift the 10-minute timestamps.
    const bars = priceBars(normalized);
    const aggregated = interval === "10m" ? aggregateBars(bars, chartIntervals[interval]) : bars;
    const data = aggregated.slice(-(long ? 900 : interval === "10m" ? 2600 : interval === "1h" ? 5200 : 180)).map(bar => ({ time: new Date(bar.time * 1000).toISOString(),
      open: String(bar.open), high: String(bar.high), low: String(bar.low), close: String(bar.close), volume_tao: String(bar.volume) }));
    return NextResponse.json({ data, source: "coinbase", interval, method: "exchange" }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    return NextResponse.json({ error: "TAO chart unavailable" }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const blocked = requestGuard(request, "research"); if (blocked) return blocked;
  const interval = request.nextUrl.searchParams.get("interval") || "1h";
  const before = request.nextUrl.searchParams.get("before");
  if (!granularities[interval]) return loadUncached(request);
  if (before !== null && (!Number.isSafeInteger(Number(before)) || Number(before) < 1609459200 || Number(before) > Date.now() / 1000 + 86400)) return loadUncached(request);
  return chartResponse(`tao:${interval}:${before === null ? "latest" : Number(before)}`, () => loadUncached(request));
}
