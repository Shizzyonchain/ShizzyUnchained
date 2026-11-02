import test from 'node:test';
import assert from 'node:assert/strict';
import { taoSeasonality } from '../app/lib/tao-seasonality.ts';
const c=(year,month,close)=>({time:Date.UTC(year,month,1),open:100,close});
test('seasonality excludes initial partial candle, current and future periods',()=>{
 const rows=taoSeasonality([c(2023,2,1000),c(2024,2,120),c(2025,2,90),c(2026,2,500),c(2027,2,800)],Date.UTC(2026,2,12),2023,2027);
 assert.equal(rows[2].n,2);assert.deepEqual(rows[2].samples.map(s=>s.year),[2024,2025]);
 assert.ok(Math.abs(rows[2].average-5)<1e-10);assert.ok(Math.abs(rows[2].median-5)<1e-10);assert.equal(rows[2].positive,1);
 assert.equal(rows[0].average,null);assert.equal(rows[0].best,null);
});
test('filters, zero returns, odd median and outlier influence remain inspectable',()=>{
 const candles=[c(2022,1,100),c(2023,0,100),c(2024,0,110),c(2025,0,300)];
 const row=taoSeasonality(candles,Date.UTC(2026,0,1),2023,2025)[0];
 assert.equal(row.n,3);assert.equal(row.positive,2);assert.ok(Math.abs(row.median-10)<1e-10);assert.ok(Math.abs(row.average-70)<1e-10);
 const filtered=taoSeasonality(candles,Date.UTC(2026,0,1),2023,2023)[0];assert.equal(filtered.average,0);assert.equal(filtered.positive,0);
 assert.equal(taoSeasonality(candles,Date.UTC(2026,0,1),2028,2029)[0].median,null);
});
