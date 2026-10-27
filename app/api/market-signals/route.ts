import { resilientTrading, type TradingSnapshot } from "../../lib/trading-snapshot";
import { responseCoalescer } from "../../lib/request-protection";
import { unstable_cache } from "next/cache";
import sectors from "../../data/sectors.json";
import { buyingTotals, requireFreshTrading } from "../../lib/market-signals";
import { nodeFirstTrading } from "../../lib/node-first-trading";
import { nodeTrading } from "../../lib/node-trading-source";
import { getCache } from "@vercel/functions";
const tags=sectors.subnets.map(({netuid,sectors})=>({netuid,sectors}));
const load=unstable_cache(async(anchor:number)=>{
 if(!Number.isSafeInteger(anchor))throw new Error('Invalid fallback cache window');
 const key=process.env.TAOSTATS_API_KEY;if(!key)throw new Error("Trading source unavailable");
 const response=await fetch("https://api.taostats.io/v1/subnets/pools/aggregate?limit=200",{headers:{Authorization:key},signal:AbortSignal.timeout(7000),cache:"no-store"});
 if(!response.ok)throw new Error(`Trading source HTTP ${response.status}`);const body=await response.json();if(body.pagination?.next_page)throw new Error("Incomplete pool page");return buyingTotals(body.data);
},["market-buy-sell-v2"],{revalidate:300});
// Hourly totals come only from our finalized index. Replaying a paginated
// network-wide trade window on provider failover burns the monthly allowance.
// resilientTrading retains the dated last-good hourly snapshot on an outage.
// An unavailable node must not turn every visitor into another paginated scan.
// The node collector fills history independently; preserve the dated last-good
// result while limiting provider fallback attempts to once per half hour.
const fallbackTasks=new Map<string,Promise<ReturnType<typeof buyingTotals>>>();
const fallbackRetry=new Map<string,number>();
async function primary(period:'1h'|'24h'){
 return nodeFirstTrading<TradingSnapshot>(period,()=>nodeTrading(period),async()=>{
 const existing=fallbackTasks.get(period);if(existing)return existing;
 const task=(async()=>{
  const cache=getCache({namespace:'market-provider-fallback-v2'});
  let retry=fallbackRetry.get(period);
  try{retry=(await cache.get(period) as number|undefined)??retry;}catch{}
  if(retry&&Date.now()<retry)throw new Error('Provider fallback cooling down');
  const retryAt=Date.now()+1800000;fallbackRetry.set(period,retryAt);
  try{await cache.set(period,retryAt,{ttl:1800});}catch{}
  // A new half-hour key reads fresh provider data on first failover, rather
  // than repeatedly receiving an expired stale-while-revalidate entry.
  return requireFreshTrading(await load(Math.floor(Date.now()/1800000)));
 })().finally(()=>fallbackTasks.delete(period));
 fallbackTasks.set(period,task);return task;
 });
}
const coalesce=responseCoalescer(2,2);
export const maxDuration=60;
export async function GET(request:Request){
 const period=new URL(request.url).searchParams.get("period")||"24h";
 if(!["1h","24h"].includes(period))return Response.json({error:"Choose 1h or 24h"},{status:400});
 // Operational check of the same public totals, never a forced provider call.
 // This lets us verify node readiness without consuming fallback credits.
 if(new URL(request.url).searchParams.get('source')==='node')return coalesce(`node:${period}`,async()=>{
  try{return Response.json({buying:await nodeTrading(period as '1h'|'24h')},{headers:{'Cache-Control':'public, s-maxage=30'}});}
  catch(error){return Response.json({buying:null,error:error instanceof Error?error.message:'Node trading unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
 },1000);
 if(period==="1h")return coalesce("1h",async()=>{try{return Response.json({buying:await resilientTrading("1h",()=>primary('1h'))},{headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=30"}});}catch(error){console.warn("Hourly market trades unavailable",error instanceof Error?error.message:"Unknown provider failure");return Response.json({buying:null},{status:503,headers:{"Cache-Control":"no-store"}});}},1000);
return coalesce("24h",async()=>{let buying=null;try{buying=await resilientTrading("24h",()=>primary('24h'));}catch(error){console.warn("Daily market trades unavailable",error instanceof Error?error.message:"Unknown provider failure");}return Response.json({buying,sectors:sectors.sectors.map(({id,name})=>({id,name})),tags},{headers:{"Cache-Control":buying?"public, s-maxage=60, stale-while-revalidate=30":"no-store"}});},1000);}
