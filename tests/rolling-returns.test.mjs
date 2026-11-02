import test from 'node:test';
import assert from 'node:assert/strict';
import { rollingReturns } from '../app/lib/rolling-returns.ts';
const c=(m,open=100,close=100)=>({time:Date.UTC(2024,m,1),open,close});
test('holding returns use endpoints, exclude first partial and unfinished periods',()=>{
 const rows=rollingReturns([c(0,1,999),c(1,100,200),c(2,200,100),c(3,100,150),c(4,150,900)],Date.UTC(2024,4,15),3);
 assert.equal(rows.length,1);assert.equal(rows[0].value,50);assert.equal(rows[0].start,c(1).time);assert.equal(rows[0].end,c(3).time);
});
test('missing months block windows, calendar years roll correctly, invalid inputs stay absent',()=>{
 assert.deepEqual(rollingReturns([c(0),c(1),c(3),c(4)],Date.UTC(2025,0,1),3),[]);
 const rows=rollingReturns([c(9),c(10),c(11),c(12,100,80)],Date.UTC(2025,1,1),3);
 assert.equal(rows.length,1);assert.ok(Math.abs(rows[0].value+20)<1e-9);
 assert.deepEqual(rollingReturns([c(0),c(1,0),c(2),c(3)],Date.UTC(2025,0,1),3),[]);
 assert.deepEqual(rollingReturns([c(0),c(1),c(2),c(3)],Date.UTC(2025,0,1),2),[]);
});
