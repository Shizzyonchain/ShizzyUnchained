import {writeFile} from 'node:fs/promises';
import {extendChartHistory,chartNeedsRecentHistory,withLiveCandle,priceBars,dollarBars,calendarBars} from '../app/lib/chart-data.ts';
const base=process.env.CHART_AUDIT_BASE||'https://shizzyunchained.com';
const out=process.argv[2]||'chart-audit.json';
const get=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`HTTP ${r.status}: ${path}`);return r.json();};
const decode=rows=>rows.map(r=>({time:String(r[0]),open:String(r[1]),high:String(r[2]),low:String(r[3]),close:String(r[4]),volume_tao:String(r[5]??0)}));
const feed=await get('/api/backend/v1/screener'), quote=await get('/api/tao-price');
const rows=Array.isArray(feed)?feed:feed.data;const now=Date.now();
const rates={};for(const interval of ['10m','1h','1d']) rates[interval]=(await get(`/api/tao-chart?interval=${interval}`)).data;
const result={checkedAt:new Date(now).toISOString(),base,quote,rows:[],gaps:[]};
const selected=process.env.CHART_AUDIT_SUBNETS?.split(',').map(Number);
const tasks=rows.filter(r=>r.netuid>0&&(!selected||selected.includes(r.netuid))).flatMap(row=>['10m','1h','1d'].map(interval=>({row,interval})));
async function worker(){while(tasks.length){const {row,interval}=tasks.shift();try{
 let original,providerError;try{original=await get(`/api/subnet-chart?netuid=${row.netuid}&interval=${interval}`);}catch(e){providerError=String(e);original=await get(`/api/backend/v1/subnets/${row.netuid}/candles?interval=${interval}&limit=180`);}
 const step=({ '10m':600000,'1h':3600000,'1d':86400000 })[interval];
 const archive=decode(original.data||[]).filter(c=>Date.parse(c.time)<=Math.floor(now/step)*step);let combined=archive;
 if(chartNeedsRecentHistory(archive,interval,now)){const n=await get(`/api/backend/v1/subnets/${row.netuid}/candles?interval=${interval}&limit=180`);combined=extendChartHistory(archive,decode(n.data||[]),interval,now);}
 const fresh=now-Date.parse(row.time)<=180000&&Date.parse(row.time)<=now+60000;
 const rendered=withLiveCandle(combined,fresh?Number(row.price_tao):0,interval,now);
 const fx=withLiveCandle(rates[interval],quote.usd,interval,now);
 const usd=dollarBars(priceBars(rendered),priceBars(fx));
 const expected=Number(row.price_tao)*quote.usd;
 const last=rendered.at(-1),lastUsd=usd.at(-1);
 const ok=fresh&&!chartNeedsRecentHistory(rendered,interval,now)&&Math.abs(Number(last?.close)-Number(row.price_tao))<1e-10&&!!lastUsd&&Math.abs(lastUsd.close-expected)<1e-8;
 const item={providerError,netuid:row.netuid,interval,status:ok?'PASS':'GAP',snapshotTime:row.time,priceTao:row.price_tao,priceUsd:expected,archiveLast:archive.at(-1)?.time,last:last?.time,chartTao:last?.close,chartUsd:lastUsd?.close,extended:combined.length>archive.length};
 if(interval==='1d')item.calendar=['1w','1mo'].map(period=>({period,close:calendarBars(usd,period).at(-1)?.close}));
 result.rows.push(item);if(!ok)result.gaps.push(item);
 }catch(e){const item={netuid:row.netuid,interval,status:'ERROR',error:String(e)};result.rows.push(item);result.gaps.push(item);}
 await writeFile(out,JSON.stringify(result,null,2));
 if(result.rows.length%32===0)console.log(`${result.rows.length}/384 checked; ${result.gaps.length} gaps`);
 await new Promise(r=>setTimeout(r,700));}}
await Promise.all([worker(),worker()]);
await writeFile(out,JSON.stringify(result,null,2));console.log(JSON.stringify({checked:result.rows.length,gaps:result.gaps.length,output:out}));

