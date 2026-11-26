import test from "node:test";
import assert from "node:assert/strict";
import {registrationHistory,registrationCandles} from "../app/lib/registration-history.ts";
import {readFileSync} from 'node:fs';

test('published SN7 registration prevents old returns, mixed candles and inherited sectors',()=>{
 const registry=JSON.parse(readFileSync(new URL('../app/data/market-registrations.json',import.meta.url)));
 const sectors=JSON.parse(readFileSync(new URL('../app/data/sectors.json',import.meta.url)));
 const row={netuid:7,time:'2026-11-23T16:00:00Z',time_24h:'2026-11-22T16:00:00Z',price_24h_tao:1,change_24h:107.94,time_1h:'2026-11-23T15:00:00Z',price_1h_tao:2};
 assert.equal(registrationHistory(row,registry).change_24h,undefined);
 assert.equal(registrationHistory(row,registry).price_1h_tao,2);
 const candles=['2026-11-22T00:00:00Z','2026-11-23T08:00:00Z','2026-11-23T09:00:00Z'].map(time=>({time}));
 assert.deepEqual(registrationCandles(candles,7,registry),[candles[2]]);
 assert.equal(registrationCandles(candles,51,registry),candles);
 assert.deepEqual(sectors.subnets.find(row=>row.netuid===7).sectors,[]);
});
test("new registrations retain their own price history but cannot inherit old occupant returns",()=>{
 const registry={78:{time:"2026-11-09T20:47:12Z",block:9471124,evidence:"/evidence/2026-11-09-monitor-1644-lifecycle.json"}};
 const row={netuid:78,time:"2026-11-10T07:30:00Z",time_1h:"2026-11-10T06:30:00Z",price_1h_tao:1,change_1h:2,time_24h:"2026-11-09T07:30:00Z",price_24h_tao:0.1,change_24h:457,volume_24h_tao:100};
 const result=registrationHistory(row,registry);
 assert.equal(result.change_1h,2);
 assert.equal(result.price_1h_tao,1);
 assert.equal(result.change_24h,undefined);
 assert.equal(result.price_24h_tao,undefined);
 assert.equal(result.volume_24h_tao,undefined);
 assert.equal(row.change_24h,457);
 assert.equal(registrationHistory({...row,netuid:51},registry).change_24h,457);
});

test('SN129 excludes its partial first daily candle and retains post-registration hourly bars',()=>{
 const registry=JSON.parse(readFileSync(new URL('../app/data/market-registrations.json',import.meta.url)));
 const daily=[{time:'2026-11-25T19:00:00-05:00'},{time:'2026-11-27T00:00:00Z'}];
 assert.deepEqual(registrationCandles(daily,129,registry),[daily[1]]);
 const hourly=[{time:'2026-11-26T03:00:00Z'},{time:'2026-11-26T04:00:00Z'}];
 assert.deepEqual(registrationCandles(hourly,129,registry),[hourly[1]]);
});
