import { unstable_cache } from "next/cache";
import sectors from "../../data/sectors.json";
import { buyingTotals } from "../../lib/market-signals";
const tags=sectors.subnets.map(({netuid,sectors})=>({netuid,sectors}));
const load=unstable_cache(async()=>{
 const key=process.env.TAOSTATS_API_KEY;if(!key)throw new Error("Trading source unavailable");
 const response=await fetch("https://api.taostats.io/v1/subnets/pools/aggregate?limit=200",{headers:{Authorization:key},signal:AbortSignal.timeout(7000),cache:"no-store"});
 if(!response.ok)throw new Error("Trading source unavailable");const body=await response.json();if(body.pagination?.next_page)throw new Error("Incomplete pool page");return buyingTotals(body.data);
},["market-buy-sell-v1"],{revalidate:300});
export async function GET(){let buying=null;try{buying=await load();}catch{}return Response.json({buying,sectors:sectors.sectors.map(({id,name})=>({id,name})),tags},{headers:{"Cache-Control":"public, s-maxage=300, stale-while-revalidate=60"}});}
