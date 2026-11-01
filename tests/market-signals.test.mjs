import {sectorPriceRows} from "../app/lib/currency-returns.ts";
import {test} from "node:test";
import assert from "node:assert/strict";
import {buyingTotals,requireFreshTrading,sectorHeat,volumeAlerts,freshSignalRows} from "../app/lib/market-signals.ts";
const now=Date.now(),time=new Date(now).toISOString();
test("buy/sell aggregates exclude Root, convert rao once and reject incomplete or delayed coverage",()=>{const rows=Array.from({length:128},(_,i)=>({netuid:i+1,timestamp:time,tao_buy_volume_24_hr:"2000000000",tao_sell_volume_24_hr:"1000000000"}));assert.equal(buyingTotals([...rows,{netuid:0}],now).buy,256);assert.equal(buyingTotals(rows,now).sell,128);assert.throws(()=>buyingTotals(rows.slice(1),now));assert.throws(()=>buyingTotals(rows.map(r=>({...r,timestamp:"2020-01-01"})),now));assert.throws(()=>buyingTotals(rows.map(r=>({...r,tao_buy_volume_24_hr:null})),now));});
test("sector heat uses an equal-weight average, requires coverage and excludes unknown rather than zero-filling",()=>{const tags=[1,2,3].map(netuid=>({netuid,sectors:["compute"]})),sectors=[{id:"compute",name:"Compute"}];const rows=[{netuid:1,change_1h:"-2"},{netuid:2,change_1h:"1"},{netuid:3,change_1h:"80"}];assert.equal(sectorHeat(rows,sectors,tags,"1h")[0].value,79/3);assert.deepEqual(sectorHeat(rows.slice(1),sectors,tags,"1h"),[]);});
test("alerts require a real 2x comparison and 10 TAO, with stale and duplicate rows excluded",()=>{const rows=[{netuid:1,time,volume_1h_tao:"20",volume_acceleration_1h:"2"},{netuid:2,time,volume_1h_tao:"9",volume_acceleration_1h:"100"},{netuid:3,time,volume_1h_tao:"90",volume_acceleration_1h:""},{netuid:4,time:"2020-01-01",volume_1h_tao:"1000",volume_acceleration_1h:"30"}];assert.deepEqual(volumeAlerts(freshSignalRows([...rows,rows[0]],now),"1h").map(r=>r.netuid),[1]);});

test("expired cached trading totals and future snapshots are rejected at serving time",()=>{
 const snapshot={buy:12,sell:8,asOf:new Date(now-900000).toISOString()};assert.equal(requireFreshTrading(snapshot,now),snapshot);
 assert.throws(()=>requireFreshTrading(snapshot,now+1));assert.throws(()=>requireFreshTrading({...snapshot,asOf:new Date(now+60001).toISOString()},now));assert.throws(()=>requireFreshTrading({...snapshot,asOf:"invalid"},now));
});

test("sector returns use current price pairs, never the older cached percentage fields",()=>{
 const rows=sectorPriceRows([{netuid:117,time,price_tao:.00525531,price_1h_tao:.005308603,time_1h:new Date(now-3600000).toISOString(),change_1h:'-1.483120888866619'}]);
 assert.ok(Math.abs(Number(rows[0].change_1h)-(-1.0038987658334997))<1e-9);
});
test("fresh current prices cannot disguise missing or stale sector comparison anchors",()=>{
 for(const time_1h of [undefined,'invalid',new Date(now-7200000).toISOString(),new Date(now-3000000).toISOString()]){
  const [row]=sectorPriceRows([{netuid:1,time,price_tao:'2',price_1h_tao:'1',time_1h,change_1h:'100'}]);
  assert.equal(row.change_1h,undefined);
 }
});

test("24-hour sector returns share the price calculation and exclude insufficient valid coverage",()=>{
 const sectors=[{id:'compute',name:'Compute'}],tags=[1,2,3].map(netuid=>({netuid,sectors:['compute']}));
 const rows=sectorPriceRows(tags.map(({netuid})=>({netuid,time,price_tao:'1.1',price_24h_tao:'1',time_24h:new Date(now-86400000).toISOString(),change_24h:'-80'})));
 assert.ok(Math.abs(sectorHeat(rows,sectors,tags,'24h')[0].value-10)<1e-9);
 const missing=sectorPriceRows(rows.map(row=>({...row,time_24h:row.netuid===1?'':row.time_24h})));
 assert.deepEqual(sectorHeat(missing,sectors,tags,'24h'),[]);
});
