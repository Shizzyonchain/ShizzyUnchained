import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotNumbers, marketRank, nonnegative, reviewedBurns } from '../app/lib/subnet-snapshot.ts';
test('FDV uses nominal 21M cap, supply needs both same-row reserves, missing is not zero',()=>{
 assert.deepEqual(snapshotNumbers({price_tao:'0.02537',alpha_reserve:'114454.177887491',alpha_out:'175740.234022921'}),{fdv:532770,supply:290194.411910412});
 assert.deepEqual(snapshotNumbers({price_tao:'0',alpha_reserve:'0',alpha_out:'0'}),{fdv:0,supply:0});
 assert.deepEqual(snapshotNumbers({price_tao:'',alpha_reserve:'1'}),{fdv:null,supply:null});
 for(const v of [undefined,null,'',-1,'broken',Infinity])assert.equal(nonnegative(v),null);
});
test('market-cap ranking excludes root and absent caps; equal caps share a rank',()=>{
 const rows=[{netuid:0,market_cap_tao:'999'},{netuid:51,market_cap_tao:'100'},{netuid:64,market_cap_tao:'100'},{netuid:92,market_cap_tao:'50'},{netuid:2},{netuid:3,market_cap_tao:'0'}];
 assert.deepEqual(marketRank(rows,64),{rank:1,count:4});assert.deepEqual(marketRank(rows,92),{rank:3,count:4});assert.equal(marketRank(rows,2),null);
});

test('snapshot burns require per-event minimum, current registration, complete windows and unique successful archived ids',()=>{
 const end='2026-10-25T04:00:00Z',row={id:'one',netuid:8,kind:'alpha',block:100,timestamp:'2026-10-24T04:00:00Z',amountRaw:'100000000000'};
 const archive={throughTime:end,historyStart:'2026-09-01T00:00:00Z',toBlock:200,transactions:[row,row,{...row,id:'dust',amountRaw:'99999999999'},{...row,id:'old-registration',block:1},{...row,id:'future',timestamp:'2026-10-26T00:00:00Z'},{...row,id:'recycled',kind:'recycle'},{...row,id:'tao',netuid:null,kind:'tao'},{...row,id:'expired',timestamp:'2026-09-01T00:00:00Z'},{...row,id:'buyback',kind:'buyback',amountRaw:'200000000001'}]};
 assert.deepEqual(reviewedBurns(archive,{8:{registeredAt:50}}).subnets['8'],{alphaRaw:'300000000001',events:2,complete:true});
 assert.equal(reviewedBurns({...archive,historyStart:'2026-10-24T00:00:00Z'},{8:{registeredAt:50}}).subnets['8'].complete,false);
 assert.equal(reviewedBurns(archive,{8:{registeredAt:201}}).subnets['8'].complete,false);
});
