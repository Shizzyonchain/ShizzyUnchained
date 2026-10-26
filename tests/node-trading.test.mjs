import test from 'node:test';import assert from 'node:assert/strict';
import {nodeTradingSnapshot} from '../app/lib/node-trading.ts';
test('node trading cannot substitute 24h totals for 1h or accept missing/old coverage',()=>{
 const now=Date.now(),row={methodVersion:2,buy:12,sell:9,count:128,asOf:new Date(now).toISOString(),windowStart:new Date(now-3600000).toISOString(),fromBlock:1,toBlock:300,source:'node'};
 assert.equal(nodeTradingSnapshot(row,'1h',now).buy,12);
 assert.throws(()=>nodeTradingSnapshot(row,'24h',now));
 assert.throws(()=>nodeTradingSnapshot({...row,buy:null},'1h',now));
 assert.throws(()=>nodeTradingSnapshot(row,'1h',now+1000000));
 assert.throws(()=>nodeTradingSnapshot({...row,toBlock:0},'1h',now));
});
