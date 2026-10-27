import { test } from "node:test";
import assert from "node:assert/strict";
import { nodeFirstTrading } from "../app/lib/node-first-trading.ts";

test("healthy node serves either window without spending provider credits", async () => {
  for (const period of ["1h", "24h"]) {
    const snapshot = { period, buy: 20, sell: 10 };
    assert.equal(await nodeFirstTrading(period, async () => snapshot, async () => { throw new Error("Unexpected paid fallback"); }), snapshot);
  }
});
test("hourly outage retains failure for dated last-good handling, never replays provider trades", async () => {
  let calls = 0;
  await assert.rejects(nodeFirstTrading("1h", async () => { throw new Error("Incomplete node history"); }, async () => { calls++; return {}; }), /Incomplete node history/);
  assert.equal(calls, 0);
});
test("daily outage can use one complete aggregate backup and backup errors remain visible", async () => {
  const daily = { buy: 5, sell: 3 };
  assert.equal(await nodeFirstTrading("24h", async () => { throw new Error("Node delayed"); }, async () => daily), daily);
  await assert.rejects(nodeFirstTrading("24h", async () => { throw new Error("Node delayed"); }, async () => { throw new Error("Backup delayed"); }), /Backup delayed/);
});
