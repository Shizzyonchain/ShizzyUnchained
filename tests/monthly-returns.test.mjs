import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMonthCandles, monthlyReturns} from '../app/lib/monthly-returns.ts';
const c=(year,month,open,close)=>[Date.UTC(year,month,1),String(open),'0','0',String(close)];
test('monthly calendar leaves unavailable and future months blank and marks partial / current periods',()=>{
 const rows=monthlyReturns(parseMonthCandles([c(2025,10,100,110),c(2025,11,110,99),c(2026,0,99,198)]),Date.UTC(2026,0,15));
 assert.equal(rows[0].months[0].value,100);assert.equal(rows[0].months[1],null);assert.equal(rows[0].current,true);assert.equal(rows[0].partial,false);
 assert.equal(rows[1].months[0],null);assert.equal(rows[1].months[10].partial,true);assert.ok(Math.abs(rows[1].value+1)<1e-9);assert.equal(rows[1].partial,true);
});
test('invalid, duplicate and gapped candles fail instead of fabricating returns',()=>{
 for(const raw of [[c(2026,0,0,1)],[c(2026,0,1,2),c(2026,0,1,2)],[c(2026,0,1,2),c(2026,2,2,3)]])assert.throws(()=>parseMonthCandles(raw));
});
