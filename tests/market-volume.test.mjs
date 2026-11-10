import assert from "node:assert/strict";
import test from "node:test";
import { marketVolume, tradingVolume } from "../app/lib/market-volume.ts";

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
