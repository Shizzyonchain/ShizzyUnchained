import holdings from "../../../data/owner-holdings.json";
import archive from "../../../data/burns.json";
import { reviewedBurns } from "../../../lib/subnet-snapshot";
import { getEtaoSnapshot } from "../../../lib/etao-source";
export const dynamic = "force-dynamic";
// Built once per module, not per visitor or wallet. No chain/indexer calls.
const burns=reviewedBurns(archive,holdings.subnets);
export async function GET() {
  const { ownerSnapshot } = await getEtaoSnapshot();
  return Response.json({...ownerSnapshot,holdings,burns}, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
}
