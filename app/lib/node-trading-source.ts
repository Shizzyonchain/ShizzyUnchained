import 'server-only';
import { unstable_cache } from 'next/cache';
import { nodeTradingSnapshot } from './node-trading';
const read=unstable_cache(async(period:'1h'|'24h')=>{
 if(!process.env.BACKEND_API_URL)throw new Error('Node not configured');
 const url=new URL('/v1/market/trading',process.env.BACKEND_API_URL);url.searchParams.set('period',period);
 const response=await fetch(url,{headers:{'X-API-Key':process.env.BACKEND_API_KEY||''},signal:AbortSignal.timeout(2500),cache:'no-store'});
 if(!response.ok){const since=response.headers.get('X-Trade-History-Since');const stamp=since&&Number.isFinite(Date.parse(since))?`; history starts ${since}`:'';throw new Error(`Node trade window unavailable (HTTP ${response.status}${stamp})`);}
 return nodeTradingSnapshot(await response.json(),period);
},['node-trading-v1'],{revalidate:30});
export async function nodeTrading(period:'1h'|'24h'){return nodeTradingSnapshot(await read(period),period);}
