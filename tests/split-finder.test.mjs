import test from 'node:test';
import assert from 'node:assert/strict';
import { findSplits } from '../app/lib/split-finder.ts';
const total=18446744073709551615n;
const vector=n=>['0','0',String(total-n),'0',String(n)];
test('allocation thresholds use exact raw values instead of rounded display',()=>{
 const weights={1:vector(total/2n),2:vector(total/2n+1n),3:['0','0','0','0','1']};
 assert.deepEqual(findSplits(weights,{},4,50,100).map(r=>r.id),[2]);
 assert.deepEqual(findSplits(weights,{},4,0,50).map(r=>r.id),[1]);
 assert.deepEqual(findSplits(weights,{},4,60,50),[]);
});
test('screener sorts deterministically and preserves missing identity labels',()=>{
 const weights={8:vector(total),2:vector(total),3:vector(0n)};
 assert.deepEqual(findSplits(weights,{},4,0,100,'',true).map(r=>r.id),[3,2,8]);
 assert.equal(findSplits(weights,{8:'Vanta'},4,0,100,'vanta')[0].id,8);
 assert.equal(findSplits(weights,{},4,0,100,'SN3')[0].name,'Name not confirmed');
});
