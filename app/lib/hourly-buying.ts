export type Trade = {id:string;timestamp:string;from_name:string;to_name:string;tao_value:string};
export type TradePage = {data:Trade[];pagination:{current_page:number;next_page:number|null;total_items:number;total_pages:number}};
export function hourlyTradeTotals(pages:TradePage[],start:number,end:number){
 if(!pages.length)throw new Error("No trade pages");const expected=pages[0].pagination.total_items;
 if(!Number.isSafeInteger(expected)||expected<0)throw new Error("Invalid count");
 const seen=new Set<string>();let buy=BigInt(0),sell=BigInt(0),trades=0;
 for(let i=0;i<pages.length;i++){const page=pages[i];if(!Array.isArray(page.data)||page.pagination.current_page!==i+1||page.pagination.total_items!==expected||page.pagination.next_page!==(i===pages.length-1?null:i+2))throw new Error("Incomplete or changing trade history");
 for(const row of page.data){const time=Date.parse(row.timestamp)/1000;if(!row.id||seen.has(row.id)||!Number.isFinite(time)||time<start||time>end||!/^\d+$/.test(row.tao_value))throw new Error("Invalid trade evidence");seen.add(row.id);
 const from=/^SN([1-9]\d*)$/.exec(row.from_name),to=/^SN([1-9]\d*)$/.exec(row.to_name);
 if(row.from_name==="TAO"&&to&&Number(to[1])<=128){buy+=BigInt(row.tao_value);trades++;}else if(row.to_name==="TAO"&&from&&Number(from[1])<=128){sell+=BigInt(row.tao_value);trades++;}
 }}if(seen.size!==expected)throw new Error("Missing trade rows");
 return {buy:Number(buy)/1e9,sell:Number(sell)/1e9,asOf:new Date(end*1000).toISOString(),windowStart:new Date(start*1000).toISOString(),count:128,trades};
}
export async function collectHourlyTrades(anchor:string,request:(page:number,start:number,end:number)=>Promise<TradePage>){
 const end=Math.floor(Date.parse(anchor)/1000),start=end-3600;
 if(!Number.isFinite(end)||Date.now()/1000-end>900||end>Date.now()/1000+60)throw new Error("Delayed trade anchor");
 const first=await request(1,start,end);const count=first.pagination?.total_pages;
 if(!Number.isInteger(count)||count<0||count>40)throw new Error("Trade window exceeds bounded collection");
 const pages=[first];for(let n=2;n<=count;n+=4){pages.push(...await Promise.all(Array.from({length:Math.min(4,count-n+1)},(_,i)=>request(n+i,start,end))));}
 return hourlyTradeTotals(pages,start,end);
}
