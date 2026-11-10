import assert from "node:assert/strict";
import test from "node:test";
import { finalizedMarketVolume, subnetDisplayName, marketVolume, tradingVolume } from "../app/lib/market-volume.ts";

test("a reset subnet counter cannot turn the network total negative or masquerade as zero", () => {
  const rows = [{ netuid: 51, volume_24h_tao: "180000" }, { netuid: 78, volume_24h_tao: "-201640.896099794" }];
  assert.deepEqual(marketVolume(rows), { total: null, available: 1, markets: 2 });
  assert.equal(rows[1].volume_24h_tao, "-201640.896099794");
});

test("valid zero is activity data, missing history is not, and Root is excluded", () => {
  assert.deepEqual(marketVolume([{ netuid: 0, volume_24h_tao: "999" }, { netuid: 1, volume_24h_tao: "0" }]), { total: 0, available: 1, markets: 1 });
  for (const value of [null, undefined, "", "NaN", Infinity, false, -1]) assert.equal(tradingVolume(value), null);
  assert.equal(marketVolume([]).total, null);
  assert.equal(marketVolume([{ netuid: 1, volume_24h_tao: "12.5" }, { netuid: 2, volume_24h_tao: 7.5 }]).total, 20);
});

test("complete finalized trade totals survive a registration reset and reject unusable windows", () => {
 const now=Date.parse("2026-11-10T07:30:00Z");
 const snapshot={buy:68766,sell:75382,count:128,asOf:new Date(now).toISOString(),windowStart:new Date(now-86400000).toISOString()};
 assert.equal(finalizedMarketVolume(snapshot,now),144148);
 assert.equal(finalizedMarketVolume({...snapshot,buy:0,sell:0},now),0);
 for(const bad of [null,{...snapshot,count:127},{...snapshot,buy:-1},{...snapshot,asOf:"invalid"},{...snapshot,windowStart:new Date(now-3600000).toISOString()}]) assert.equal(finalizedMarketVolume(bad,now),null);
 assert.equal(finalizedMarketVolume({...snapshot,delayed:true},now+1800000),144148);
 assert.equal(finalizedMarketVolume(snapshot,now+21600001),null);
 assert.equal(subnetDisplayName({netuid:78,name:"Unknown"}),"SN78");
 assert.equal(subnetDisplayName({netuid:78,name:null}),"SN78");
 assert.equal(subnetDisplayName({netuid:24,name:"MS Computer"}),"MS Computer");
});
