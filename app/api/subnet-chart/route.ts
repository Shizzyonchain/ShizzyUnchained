import { requestGuard } from "../../lib/request-protection";
import { chartResponse } from "../../lib/chart-cache-source";
import { NextRequest, NextResponse } from "next/server";
import { aggregateBars, priceBars } from "../../lib/chart-data";
import { udfCandles } from "../../lib/taostats-candles";

const intervals: Record<string, { resolution: string; seconds: number; count: number }> = {
  "10m": { resolution: "5", seconds: 300, count: 600 },
  "1h": { resolution: "60", seconds: 3600, count: 300 },
  "1d": { resolution: "1D", seconds: 86400, count: 900 },
  "1w": { resolution: "1D", seconds: 86400, count: 900 },
  "1mo": { resolution: "1D", seconds: 86400, count: 900 },
};
async function loadUncached(request: NextRequest) {
  const interval = request.nextUrl.searchParams.get("interval") || "1h";
  const subnet = request.nextUrl.searchParams.get("netuid") || "";
  const netuid = Number(subnet);
  const config = intervals[interval];
  const beforeParam = request.nextUrl.searchParams.get("before");
  const before = beforeParam === null ? null : Number(beforeParam);
  if (before !== null && (!Number.isSafeInteger(before) || before < 1609459200 || before > Date.now() / 1000 + 86400)) return NextResponse.json({ error: "Invalid history cursor" }, { status: 400 });
  if (!/^\d{1,3}$/.test(subnet) || !Number.isInteger(netuid) || netuid < 1 || netuid > 128 || !config) return NextResponse.json({ error: "Unsupported chart query" }, { status: 400 });
  const key = process.env.TAOSTATS_API_KEY;
  if (!key) return NextResponse.json({ error: "Chart provider unavailable" }, { status: 503 });
  try {
    // Stable minute buckets share the provider response across visitors.
    const bucket = interval === "10m" ? 600 : config.seconds;
    const refreshSeconds = config.seconds >= 86400 ? 1800 : 300;
    const to = before === null ? Math.floor(Date.now() / (refreshSeconds*1000)) * refreshSeconds : Math.floor(before / bucket) * bucket;
    const count = before === null ? config.count : interval === "10m" ? 288 : interval === "1h" ? 720 : 900;
    const url = new URL("/v1/tradingview/udf/history", "https://api.taostats.io");
    for (const [name, value] of Object.entries({ symbol: `SUB-${netuid}`, resolution: config.resolution, to, from: to - config.seconds * count, countback: count })) url.searchParams.set(name, String(value));
    const response = await fetch(url, { headers: { Authorization: key }, next: { revalidate: before === null ? refreshSeconds : 86400 }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error("Provider unavailable");
    const payload = await response.json();
    if (payload.s === "no_data") return NextResponse.json({ data: [], method: "taostats-alpha", done: true, interval });
    const candles = udfCandles(payload);
    const bars = priceBars(candles);
    const usable = (interval === "10m" ? aggregateBars(bars, 600) : bars).filter(bar => before === null || bar.time < to);
    const data = usable.map(bar => [new Date(bar.time * 1000).toISOString(), String(bar.open), String(bar.high), String(bar.low), String(bar.close), String(bar.volume)]);
    const done = !usable.length || usable[0].time <= Date.UTC(2025, 1, 13) / 1000;
    return NextResponse.json({ data, done, method: "taostats-alpha", source: "TaoStats", volumeUnit: "alpha", interval }, { headers: { "Cache-Control": `public, s-maxage=${before === null ? 60 : 86400}, stale-while-revalidate=120` } });
  } catch {
    return NextResponse.json({ error: "TaoStats chart history unavailable; use node fallback." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const blocked = requestGuard(request, "research"); if (blocked) return blocked;
  const interval = request.nextUrl.searchParams.get("interval") || "1h";
  const before = request.nextUrl.searchParams.get("before");
  const subnet = request.nextUrl.searchParams.get("netuid") || "";
  if (!/^\d{1,3}$/.test(subnet) || Number(subnet) < 1 || Number(subnet) > 128 || !intervals[interval]) return loadUncached(request);
  if (before !== null && (!Number.isSafeInteger(Number(before)) || Number(before) < 1609459200 || Number(before) > Date.now() / 1000 + 86400)) return loadUncached(request);
  return chartResponse(`subnet:${Number(subnet)}:${interval}:${before === null ? "latest" : Number(before)}`, () => loadUncached(request));
}
