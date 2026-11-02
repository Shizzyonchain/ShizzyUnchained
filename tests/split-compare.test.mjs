import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSplits, validSplit } from '../app/lib/split-compare.ts';
const a=['0','0','3320329489486196244','7563207292111677685','7563207292111677686'];
const b=['0','0','4796111237273721898','7563207292111677685','6087425544324152032'];
test('split comparison preserves full-vector totals and reports percentage-point differences',()=>{
 assert.equal(validSplit(a),true);assert.equal(validSplit(b),true);
 const rows=compareSplits(a,b);assert.equal(rows[2].difference.toFixed(2),"8.00");assert.equal(rows[3].difference,0);assert.equal(rows[4].difference.toFixed(2),"-8.00");
 assert.ok(Math.abs(rows.reduce((s,r)=>s+r.left,0)-100)<1e-9);
 assert.ok(compareSplits(b,a)[2].difference<0);assert.equal(compareSplits(a,a)[2].difference,0);
});
test('missing or invalid splits fail closed rather than zero filling',()=>{
 for(const v of [undefined,[],['0','0','0','0','0'],['-1','0','0','0','18446744073709551616'],['x','0','0','0','0']])assert.equal(compareSplits(a,v),null);
});

