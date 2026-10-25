import "server-only";
import { getCache } from "@vercel/functions";
export type TradingSnapshot={buy:number;sell:number;asOf:string;count:number;trades?:number;windowStart?:string};
const memory=new Map<string,TradingSnapshot>();
export async function resilientTrading(period:string,load:()=>Promise<TradingSnapshot>){
 const cache=getCache({namespace:"shizzy-trading-verified-v1"});let previous=memory.get(period);
 try{previous=(await cache.get(period) as TradingSnapshot|undefined)??previous;}catch{}
 const age=previous?Date.now()-Date.parse(previous.asOf):Infinity;
 if(age>=-60000&&age<300000)return {...previous!,delayed:false};
 try{const next=await load();memory.set(period,next);try{await cache.set(period,next,{ttl:21600});}catch{}return {...next,delayed:false};}
 catch(error){console.warn(`Trading ${period} refresh failed`,error instanceof Error?error.message:"Source error");if(previous&&age>=-60000&&age<=21600000)return {...previous,delayed:true};throw error;}
}
