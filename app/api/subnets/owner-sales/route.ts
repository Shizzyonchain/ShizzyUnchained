import { NextRequest } from "next/server";
import { getEtaoSnapshot } from "../../../lib/etao-source";
import { requestGuard, responseCoalescer } from "../../../lib/request-protection";
import { swapRows, validWalletAddress, type WalletActivity } from "../../../lib/wallet-activity";
import { ownerSaleEvidence, sumOwnerActivity } from "../../../lib/owner-sales";
const coalesce = responseCoalescer(256, 8);
export async function GET(request: NextRequest) {
  const blocked = requestGuard(request, "activity"); if (blocked) return blocked;
  const netuid = Number(request.nextUrl.searchParams.get("netuid"));
  if (!Number.isInteger(netuid) || netuid < 1 || netuid > 65535) return Response.json({ error: "Invalid subnet" }, { status: 400 });
  const snapshot = await getEtaoSnapshot();
  const address = snapshot.ownerSnapshot.owners[String(netuid)];
  if (!address || !validWalletAddress(address) || Date.now() - Date.parse(snapshot.ownerSnapshot.checkedAt) > 30 * 60_000) return Response.json({ error: "A fresh verified owner wallet is unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  // Fixed five-minute boundaries let all visitors reuse identical upstream requests.
  const end = Math.floor(Date.now() / 300_000) * 300;
  return coalesce(`${netuid}:${address}:${end}`, async () => {
    const key = process.env.TAOSTATS_API_KEY;
    if (!key) return Response.json({ error: "Owner sales temporarily unavailable" }, { status: 503 });
    try {
      const load = async (buy: boolean) => {
        const rows: WalletActivity[] = [];
        let complete = false;
        const signal = AbortSignal.timeout(15_000);
        for (let page = 1; page <= 10; page++) {
          const url = new URL("https://api.taostats.io/v1/subnets/trades");
          const params = { coldkey: address, from_name: buy ? "TAO" : `SN${netuid}`, to_name: buy ? `SN${netuid}` : "TAO", timestamp_start: String(end - 604800), timestamp_end: String(end), tao_value_min: "5000000000", limit: "200", page: String(page), order_by: "timestamp", order_dir: "desc" };
          Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
          const response = await fetch(url, { headers: { Authorization: key }, next: { revalidate: 300 }, signal });
          if (!response.ok) throw new Error("Trade provider unavailable");
          const payload = await response.json();
          if (payload.pagination?.current_page !== page) throw new Error("Invalid sales pagination");
          rows.push(...swapRows(payload.data, "trades", address));
          const next = payload.pagination.next_page;
          if (next == null) { complete = true; break; }
          if (next !== page + 1) throw new Error("Invalid sales continuation");
        }
        return { rows, complete };
      };
      const [sales, buys] = await Promise.all([load(false), load(true)]);
      const complete = sales.complete && buys.complete;
      return Response.json({ netuid, address, asOf: new Date(end * 1000).toISOString(), ownerCheckedAt: snapshot.ownerSnapshot.checkedAt, complete, sales: ownerSaleEvidence(sales.rows, netuid, end * 1000), ...sumOwnerActivity([...sales.rows, ...buys.rows], netuid, end * 1000) }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } });
    } catch { return Response.json({ error: "Owner sales could not be verified. Please retry shortly." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } }); }
  }, 60_000);
}
