import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const data=JSON.parse(readFileSync(new URL("../app/data/gamma-activity.json",import.meta.url)));
test("Gamma events retain Eastern dates, exact units and unique evidence keys",()=>{
 const keys=new Set();
 for(const e of data.events){
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(e.timestamp));
  assert.equal(e.date,date);
  assert.ok(e.block>=data.coverageStartBlock&&e.block<=data.coverageEndBlock);
  const key=`${e.block}-${e.index}`;assert.ok(!keys.has(key));keys.add(key);
  for(const field of ["amount","gamma","alpha"]){if(e.attributes[field]!==undefined)assert.ok(Number.isSafeInteger(e.attributes[field])&&e.attributes[field]>=0);}
 }
});
test("initial Gamma daily activity does not mix the UTC evening into the next Eastern day",()=>{
 const utcEvening=data.events.find(e=>e.block===9479559);assert.equal(utcEvening.date,"2026-11-10");
 const day=data.events.filter(e=>e.date==="2026-11-11");
 assert.equal(day.filter(e=>e.type==="GammaSpent").reduce((n,e)=>n+e.attributes.amount,0),2000000000);
 assert.equal(day.filter(e=>e.type==="GammaMinted").length,0);
 assert.equal(data.previousDayComplete,false);
});
