import test from 'node:test';
import assert from 'node:assert/strict';
import {holdingForOwner,displayHolding} from '../app/lib/owner-holdings.ts';
const now=Date.parse('2026-10-25T02:00:00Z');
const row={address:'owner',registeredAt:1,alphaRaw:'9007199254740993',lockedAlphaRaw:'1000000000',unstakableAlphaRaw:'9007198254740993',freeTaoRaw:'217058340',frozenTaoRaw:'0',rootTaoRaw:'1000000000'};
const snapshot={block:9357000,hash:'0x123',asOf:new Date(now).toISOString(),source:'Finalized',evidence:'/evidence/test.json',subnets:{64:row}};
test('owner holdings remain wallet/subnet scoped with explicit dated freshness',()=>{
 assert.equal(holdingForOwner(snapshot,64,'owner',now).alphaRaw,row.alphaRaw);
 assert.equal(holdingForOwner(snapshot,64,'another-owner',now),null);
 assert.equal(holdingForOwner(snapshot,51,'owner',now),null);
 assert.equal(holdingForOwner(snapshot,64,undefined,now),null);
 assert.equal(holdingForOwner(snapshot,64,'owner',now-120000),null);
 assert.equal(holdingForOwner(snapshot,64,'owner',now+37*3600000).overdue,true);
 assert.equal(holdingForOwner({...snapshot,subnets:{64:{...row,alphaRaw:'invalid'}}},64,'owner',now),null);
 assert.equal(displayHolding('217058340'),'0.22');assert.equal(displayHolding('0'),'0');assert.equal(displayHolding('685444757179017'),'685,444.76');
});
