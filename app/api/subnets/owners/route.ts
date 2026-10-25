import holdings from "../../../data/owner-holdings.json";
import { getEtaoSnapshot } from "../../../lib/etao-source";
export const dynamic = "force-dynamic";
export async function GET() {
  const { ownerSnapshot } = await getEtaoSnapshot();
  return Response.json({...ownerSnapshot,holdings}, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
}
