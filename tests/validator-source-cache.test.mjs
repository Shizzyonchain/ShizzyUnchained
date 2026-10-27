import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedValidatorCollection, validatorSourceTtl } from '../app/lib/validator-source-cache.ts';
function fixture() {
 let time=1000000, calls=0; const data=new Map();
 const cache={async get(k){const v=data.get(k);return v&&v.until>time?v.value:undefined;},async set(k,value,{ttl}){data.set(k,{value,until:time+ttl*1000});},async delete(k){data.delete(k);}};
 const read=async page=>{calls++;return {data:[page],pagination:{current_page:page,next_page:page===2?null:2,total_items:2}};};
 return {cache,read,now:()=>time,advance:n=>time+=n,calls:()=>calls};
}
test('completed network generations share pages, then refresh as a whole after45min',async()=>{
 const f=fixture(),ttl=validatorSourceTtl('/v1/validators/yield');assert.equal(ttl,2700);
 const load=()=>cachedValidatorCollection(f.cache,'yield',ttl,f.read,f.now);
 assert.deepEqual(await load(),[1,2]);assert.equal(f.calls(),2);
 f.advance(1800001);assert.deepEqual(await load(),[1,2]);assert.equal(f.calls(),2);
 f.advance(900000);assert.deepEqual(await load(),[1,2]);assert.equal(f.calls(),4);
 assert.equal(validatorSourceTtl('/v1/subnets/metagraph'),1800);
});
test('throttled scans preserve checkpoints and cooldown without returning partial rankings',async()=>{
 const f=fixture();let fail=true;
 const read=async page=>{if(page===2&&fail)throw Error('429');return f.read(page);};
 const load=()=>cachedValidatorCollection(f.cache,'yield',2700,read,f.now);
 await assert.rejects(load(),/429/);assert.equal(f.calls(),1);
 await assert.rejects(load(),/being prepared/);assert.equal(f.calls(),1);
 f.advance(61000);fail=false;assert.deepEqual(await load(),[1,2]);assert.equal(f.calls(),2);
});
test('a growing collection is rejected rather than ranking an incomplete universe',async()=>{
 const f=fixture();await assert.rejects(cachedValidatorCollection(f.cache,'yield',2700,async page=>({...await f.read(page),pagination:{current_page:page,next_page:page===2?null:2,total_items:3}}),f.now),/coverage changed/);
});
test('different query identities cannot share rankings or bypass a busy source lease',async()=>{
 const f=fixture();await f.cache.set('source:yield:preparing',true,{ttl:120});
 await assert.rejects(cachedValidatorCollection(f.cache,'yield',2700,f.read,f.now),/being prepared/);
 assert.deepEqual(await cachedValidatorCollection(f.cache,'directory',900,f.read,f.now),[1,2]);
});
