import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryMath } from '../app/lib/recovery-math.ts';
test('recoveries use the lower denominator, not the original decline percentage',()=>{
 assert.deepEqual(recoveryMath(100,50),{drop:50,requiredGain:100,gap:50});
 assert.equal(recoveryMath(400,100).requiredGain,300);
 assert.equal(recoveryMath(100,100).requiredGain,0);
 assert.equal(recoveryMath(100,0).requiredGain,null);
 const r=recoveryMath(250,200);assert.ok(Math.abs(r.drop-20)<1e-10);assert.equal(r.requiredGain,25);
});
test('invalid or reversed references are rejected; decimal quotes preserve scale',()=>{
 for(const [a,b] of [[0,0],[-1,1],[100,-1],[100,101],[NaN,50],[100,Infinity],[1e308,1e-308]])assert.equal(recoveryMath(a,b),null);
 assert.equal(recoveryMath(.004,.002).requiredGain,100);
});
