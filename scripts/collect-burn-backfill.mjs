import {mkdir,readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const output="public/evidence/burn-index-backfill-2026-09-22--2026-10-20.json";
export function validateBurnPage(payload,kind,page,start,end,total,seen){
 const p=payload?.pagination,rows=payload?.data;
 if(!p||!Array.isArray(rows)||p.current_page!==page||!Number.isSafeInteger(p.total_items)||p.total_items<0||p.total_pages>500||p.total_items!==(total??p.total_items)||p.next_page!==(page<p.total_pages?page+1:null))throw new Error("Invalid or changing burn pagination");
 for(const row of rows){const time=Date.parse(row.timestamp)/1000;if(!row.id||seen.has(row.id)||row.pallet!==kind[0]||row.name!==kind[1]||!Number.isFinite(time)||time<start||time>end)throw new Error("Invalid or duplicate indexed burn evidence");seen.add(row.id);}
 return {rows,total:p.total_items,next:p.next_page};
}
async function main(){
 if(process.env.VERCEL_ENV!=="production"||!process.env.TAOSTATS_API_KEY){console.log("Historical burn index collection skipped outside authenticated production build");return;}
 try{const prior=JSON.parse(await readFile(output,"utf8"));if(prior.complete){console.log("Historical burn index evidence already retained");return;}}catch{}
 const start=Math.floor(Date.parse("2026-09-22T00:00:00Z")/1000),end=Math.floor(Date.parse("2026-10-20T16:23:12Z")/1000);
 const evidence={version:1,checkedAt:new Date().toISOString(),start,end,source:"TaoStats v1 indexed burn events; discovery evidence only, pending independent finalized chain verification",complete:false,streams:[],errors:[]};
 try{for(const kind of [["SubtensorModule","AlphaBurned"],["Balances","Burned"]]){
  const stream={pallet:kind[0],name:kind[1],rows:[],pages:[],complete:false};evidence.streams.push(stream);let page=1,total;const seen=new Set();
  while(page){
   const url=new URL("https://api.taostats.io/v1/events");for(const [key,value]of Object.entries({pallet:kind[0],name:kind[1],timestamp_start:String(start),timestamp_end:String(end),limit:"200",page:String(page),order_by:"timestamp",order_dir:"asc"}))url.searchParams.set(key,value);
   let payload;
   for(let attempt=0;attempt<4;attempt++){const r=await fetch(url,{headers:{Authorization:process.env.TAOSTATS_API_KEY},signal:AbortSignal.timeout(20000)});if((r.status===429||r.status>=500)&&attempt<3){await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));continue;}if(!r.ok)throw new Error(`Indexed burn source HTTP ${r.status}`);payload=await r.json();break;}
   const result=validateBurnPage(payload,kind,page,start,end,total,seen);total=result.total;stream.rows.push(...result.rows);stream.pages.push({page,count:result.rows.length,sha256:createHash("sha256").update(JSON.stringify(result.rows)).digest("hex")});page=result.next;
   console.log(`Burn discovery ${kind.join(".")}: ${stream.rows.length} / ${total} rows`);
  }
  if(stream.rows.length!==total)throw new Error("Missing indexed burn records");stream.total=total;stream.complete=true;
 }
 evidence.complete=true;
 }catch(error){evidence.errors.push(error instanceof Error?error.message:"Indexed burn discovery failed");}
 evidence.completedAt=new Date().toISOString();await mkdir("public/evidence",{recursive:true});await writeFile(output,JSON.stringify(evidence,null,2)+"\n");console.log(`Historical burn index discovery complete: ${evidence.complete}; ${evidence.streams.reduce((n,s)=>n+s.rows.length,0)} rows. No reviewed coverage changed.`);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
