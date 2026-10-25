import test from 'node:test';
import assert from 'node:assert/strict';
import {sumOwnerBurns,ownerSaleEvidence,sumOwnerSales,sumOwnerActivity,formatSalesAmount} from '../app/lib/owner-sales.ts';
const now=Date.parse('2026-10-23T12:00:00Z');
const row=(id,hours,extra={})=>({id,timestamp:new Date(now-hours*3600000).toISOString(),swap:{fromToken:'SN51',toToken:'TAO',fromAmount:'9007199254740993',toAmount:'5000000000',taoValue:'5000000000',...extra}});
test('owner sales use exact window boundaries, token scope, fee exclusions and deduplication',()=>{
 const rows=[row('a',24),row('b',168),row('c',169),row('d',-1),row('e',1,{feeConversion:true}),row('f',1,{fromToken:'SN64'}),row('g',1,{toToken:'SN64'}),row('h',1,{taoValue:'4999999999'}),row('a',24)];
 assert.deepEqual(sumOwnerSales(rows,51,now),{day:{alpha:'9007199254740993',tao:'5000000000',trades:1},week:{alpha:'18014398509481986',tao:'10000000000',trades:2},month:{alpha:'27021597764222979',tao:'15000000000',trades:3}});
 assert.deepEqual(sumOwnerSales([],51,now).day,{alpha:'0',tao:'0',trades:0});
 assert.equal(formatSalesAmount('9007199254740993'),'9,007,199.254740993');
});

test('owner activity compares alpha units, not TAO, and preserves signed precision',()=>{
 const sell=row('sell',1,{fromAmount:'12000000000'});
 const buy=row('buy',2,{fromToken:'TAO',toToken:'SN51',fromAmount:'6000000000',toAmount:'20000000000'});
 const earlier=row('earlier',25,{fromAmount:'20000000000'});
 const result=sumOwnerActivity([sell,buy,earlier,buy,row('fee',1,{feeConversion:true,fromToken:'TAO',toToken:'SN51'})],51,now);
 assert.equal(result.day.bought.alpha,'20000000000'); assert.equal(result.day.bought.tao,'6000000000');
 assert.equal(result.day.netAlpha,'8000000000'); assert.equal(result.week.netAlpha,'-12000000000');
 assert.equal(formatSalesAmount(result.week.netAlpha),'-12');
 assert.equal(formatSalesAmount('-1'),'-0.000000001');
});

test('owner sale evidence excludes unrelated transfers, other subnet trades, fees, dust and duplicates',()=>{const rows=[row('valid',1),row('other',1,{fromToken:'SN64'}),row('fee',1,{feeConversion:true}),row('buy',1,{fromToken:'TAO',toToken:'SN51'}),row('dust',1,{taoValue:'1'}),row('old',169),row('valid',1)];assert.deepEqual(ownerSaleEvidence(rows,51,now).map(r=>r.id),['valid','old']);});

test('30-day owner activity includes the exact boundary but excludes older trades',()=>{
 const r=sumOwnerActivity([row('month',720),row('old',721)],51,now);assert.equal(r.day.trades,0);assert.equal(r.week.trades,0);assert.equal(r.month.trades,1);assert.equal(r.month.alpha,'9007199254740993');
});
test('owner burns are exact, wallet/subnet scoped, deduplicated and thresholded per event',()=>{
 const burn=(id,hours,extra={})=>({id,netuid:51,account:'owner',kind:'alpha',amountRaw:'200000000000',timestamp:new Date(now-hours*3600000).toISOString(),...extra});
 const r=sumOwnerBurns([burn('a',24),burn('b',168,{kind:'buyback'}),burn('c',720),burn('old',721),burn('tiny',1,{amountRaw:'99000000000'}),burn('other',1,{account:'other'}),burn('subnet',1,{netuid:64}),burn('recycle',1,{kind:'recycling'}),burn('tao',1,{kind:'tao'}),burn('future',-1),burn('a',24)],51,'owner',now,new Date(now-31*86400000).toISOString());
 assert.equal(r.day.alpha,'200000000000');assert.equal(r.week.alpha,'400000000000');assert.equal(r.month.alpha,'600000000000');assert.equal(r.month.burns,3);assert.equal(r.month.complete,true);
 const partial=sumOwnerBurns([burn('a',1)],51,'owner',now,new Date(now-4*86400000).toISOString());assert.equal(partial.day.complete,true);assert.equal(partial.week.complete,false);assert.equal(partial.month.complete,false);
});

test('retained burn archive covers every owner window and retains historical verification evidence',async()=>{
 const {readFile}=await import('node:fs/promises');
 const archive=JSON.parse(await readFile(new URL('../app/data/burns.json',import.meta.url),'utf8'));
 assert.ok(Date.parse(archive.throughTime)-Date.parse(archive.historyStart)>=30*86400000);
 assert.equal(archive.historicalReview.qualifyingVerified,62);
 const proof=JSON.parse(await readFile(new URL('../public'+archive.historicalReview.evidence,import.meta.url),'utf8'));
 assert.equal(proof.sourceComplete,true);assert.deepEqual(proof.errors,[]);assert.equal(proof.events.length,62);
 for(const event of proof.events){const record=archive.transactions.find(r=>r.id===`${event.block}-${event.eventIndex}`);assert.ok(record);assert.equal(record.hash,event.hash);assert.equal(record.account,event.event.attributes[0]);assert.equal(record.amountRaw,String(event.event.attributes[2]));assert.ok(event.registeredAt<=event.block);}
 const r=sumOwnerBurns(archive.transactions,27,'unrelated',Date.parse(archive.throughTime),archive.historyStart);assert.ok(r.day.complete&&r.week.complete&&r.month.complete);
});
