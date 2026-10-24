import { collectHourlyTrades } from "../../lib/hourly-buying";
import { responseCoalescer } from "../../lib/request-protection";
import { unstable_cache } from "next/cache";
import sectors from "../../data/sectors.json";
import { buyingTotals } from "../../lib/market-signals";
const tags=sectors.subnets.map(({netuid,sectors})=>({netuid,sectors}));
const load=unstable_cache(async()=>{
 const key=process.env.TAOSTATS_API_KEY;if(!key)throw new Error("Trading source unavailable");
 const response=await fetch("https://api.taostats.io/v1/subnets/pools/aggregate?limit=200",{headers:{Authorization:key},signal:AbortSignal.timeout(7000),cache:"no-store"});
 if(!response.ok)throw new Error("Trading source unavailable");const body=await response.json();if(body.pagination?.next_page)throw new Error("Incomplete pool page");return buyingTotals(body.data);
},["market-buy-sell-v1"],{revalidate:300});
const hourlyAt=unstable_cache(async(anchor:string)=>{
 const key=process.env.TAOSTATS_API_KEY!;const signal=AbortSignal.timeout(25000);
 return collectHourlyTrades(anchor,async(page,start,end)=>{
 const url=new URL("https://api.taostats.io/v1/subnets/trades");Object.entries({limit:"200",page:String(page),timestamp_start:String(start),timestamp_end:String(end),order_by:"timestamp",order_dir:"desc"}).forEach(([k,v])=>url.searchParams.set(k,v));
 const response=await fetch(url,{headers:{Authorization:key},signal,cache:"no-store"});if(!response.ok)throw new Error("Hourly trades unavailable");return response.json();
 });
},["market-hourly-trades-by-source-v2"],{revalidate:300});
// A new aggregate timestamp selects a new hourly cache entry immediately.
const hourly=async()=>hourlyAt((await load()).asOf);
const coalesce=responseCoalescer(2,2);
export const maxDuration=60;
export async function GET(request:Request){
 const period=new URL(request.url).searchParams.get("period")||"24h";
 if(!["1h","24h"].includes(period))return Response.json({error:"Choose 1h or 24h"},{status:400});
 if(period==="1h")return coalesce("1h",async()=>{try{return Response.json({buying:await hourly()},{headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=30"}});}catch(error){console.warn("Hourly market trades unavailable",error instanceof Error?error.message:"Unknown provider failure");return Response.json({buying:null},{status:503,headers:{"Cache-Control":"no-store"}});}},1000);
let buying=null;try{buying=await load();}catch{}return Response.json({buying,sectors:sectors.sectors.map(({id,name})=>({id,name})),tags},{headers:{"Cache-Control":buying?"public, s-maxage=60, stale-while-revalidate=30":"no-store"}});}
