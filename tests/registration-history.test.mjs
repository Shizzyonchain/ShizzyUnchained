import test from "node:test";
import assert from "node:assert/strict";
import {registrationHistory} from "../app/lib/registration-history.ts";
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
