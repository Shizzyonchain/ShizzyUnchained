import "server-only";
import snapshot from "../data/tao-monthly-candles.json";
import { parseMonthCandles } from "./monthly-returns";

export async function getTaoMonthlyCandles() {
  try {
    const response = await fetch("https://api.mexc.com/api/v3/klines?symbol=TAOUSDT&interval=1M&limit=1000", { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error("Monthly source unavailable");
    const candles = parseMonthCandles(await response.json());
    const now = new Date(), current = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    if (candles.length < snapshot.candles.length || candles.at(-1)!.time < current) throw new Error("Incomplete monthly history");
    return { candles, asOf: Date.now(), fallback: false };
  } catch {
    return { candles: parseMonthCandles(snapshot.candles), asOf: Date.parse(snapshot.fetchedAt), fallback: true };
  }
}
