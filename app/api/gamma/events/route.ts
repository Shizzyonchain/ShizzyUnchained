import { NextRequest, NextResponse } from "next/server";
import { requestGuard, responseCoalescer } from "../../../lib/request-protection";

const load = responseCoalescer(128, 4);
const names = new Set(["GammaMinted", "GammaEmissionMinted", "GammaSpent", "SubnetGammaEnabledSet", "SubnetGammaEmissionSet", "GammaMoved", "GammaClosed", "GammaServiceSet", "GammaServiceRemoved"]);
export async function GET(request: NextRequest) {
  const blocked = requestGuard(request, "research"); if (blocked) return blocked;
  const query = request.nextUrl.searchParams;
  const name = query.get("name") || "GammaSpent";
  const start = Number(query.get("from")); const end = Number(query.get("to")); const page = Number(query.get("page") || 1);
  if (!names.has(name) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 9476686 || end < start || end - start > 100000 || !Number.isSafeInteger(page) || page < 1 || page > 1000) return NextResponse.json({ error: "Invalid Gamma event range" }, { status: 400 });
  const key = process.env.TAOSTATS_API_KEY;
  if (!key) return NextResponse.json({ error: "Gamma event provider unavailable" }, { status: 503 });
  return load(`${name}:${start}:${end}:${page}`, async () => {
    const url = new URL("https://api.taostats.io/v1/events");
    for (const [k, value] of Object.entries({ network: "finney", pallet: "SubtensorModule", name, block_start: start, block_end: end, page, limit: 200 })) url.searchParams.set(k, String(value));
    try {
      const response = await fetch(url, { headers: { Authorization: key }, next: { revalidate: 300 }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) return NextResponse.json({ error: "Gamma event provider unavailable" }, { status: 502 });
      const body = await response.json();
      return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } });
    } catch { return NextResponse.json({ error: "Gamma event provider unavailable" }, { status: 502 }); }
  }, 300000);
}
