import assert from "node:assert/strict";
import test from "node:test";
import { rankValidators } from "../app/lib/validator-ranking.ts";

const now = Date.parse("2026-10-16T16:00:00Z");
const base = {
  yieldBasis: "nominator-net", hotkey: "steady", name: "Steady", take: .09, yield7: .3, yield30: .3,
  participation7: 1, participation30: 1, active: true, permit: true,
  updated: 5, cutoff: 500, stakeShare: .1, dividends: .1,
  registered: "2025-01-01", timestamps: Array(4).fill("2026-10-16T15:50:00Z"),
};
test("a short yield spike cannot outrank consistent operation on balanced mode", () => {
  const spike = { ...base, hotkey: "spike", yield7: 8, yield30: .25 };
  assert.equal(rankValidators([spike, base], "balanced", now)[0].hotkey, "steady");
});
test("missing participation, inactive permits and stale evidence cannot win", () => {
  const bad = [
    { ...base, hotkey: "unknown", participation30: null },
    { ...base, hotkey: "inactive", active: false },
    { ...base, hotkey: "no-permit", permit: false },
    { ...base, hotkey: "stale", timestamps: Array(4).fill("2026-10-15T15:50:00Z") },
    { ...base, hotkey: "future", timestamps: Array(4).fill("2026-10-17T15:50:00Z") },
    { ...base, hotkey: "unproven", registered: "2026-10-15" },
    { ...base, hotkey: "expired-update", updated: 501 },
  ];
  const rows = rankValidators([...bad, base], "balanced", now);
  assert.equal(rows[0].hotkey, "steady");
  assert.ok(rows.slice(1).every(row => row.score === null && row.excluded.length));
});
test("preference changes favor low fees or lower concentration without disabling eligibility", () => {
  const cheap = { ...base, hotkey: "cheap", take: 0, stakeShare: .4 };
  const small = { ...base, hotkey: "small", take: .18, stakeShare: .01 };
  assert.equal(rankValidators([cheap, small], "fees", now)[0].hotkey, "cheap");
  assert.equal(rankValidators([cheap, small], "decentralization", now)[0].hotkey, "small");
  assert.deepEqual(rankValidators([cheap, small], "balanced", now), rankValidators([small, cheap], "balanced", now));
});
test("zero yield, nonfinite numbers and missing parameters do not become favorable defaults", () => {
  for (const overrides of [{ yield30: 0 }, { yield7: NaN }, { take: null }, { stakeShare: Infinity }, { cutoff: null }]) {
    assert.equal(rankValidators([{ ...base, ...overrides }], "balanced", now)[0].score, null);
  }
});

test("net nominator yield is not reduced by take a second time", () => {
  const higherNet = { ...base, hotkey: "higher-net", take: .18, yield7: .32, yield30: .32 };
  const zeroFee = { ...base, hotkey: "zero-fee", take: 0, yield7: .30, yield30: .30 };
  const rows = rankValidators([zeroFee, higherNet], "yield", now);
  assert.equal(rows[0].hotkey, "higher-net");
  assert.equal(rows[0].yield7, .32);
  assert.equal(rows[0].yield30, .32);
});
test("unknown or gross yield basis cannot enter recommendations", () => {
  for (const yieldBasis of ["unknown", "gross", undefined]) {
    const row = rankValidators([{ ...base, yieldBasis, yield7: 99 }], "yield", now)[0];
    assert.equal(row.score, null);
    assert.ok(row.excluded.includes("Yield after validator take could not be established"));
  }
});

test("delegated paths require every operating snapshot to be fresh and the parent own yield", () => {
  const parent = { ...base, operation: "delegated", timestamps: [...base.timestamps, "2026-10-16T15:50:00Z"] };
  assert.notEqual(rankValidators([parent], "balanced", now)[0].score, null);
  assert.equal(rankValidators([{ ...parent, timestamps: [...base.timestamps, "2026-10-15T15:50:00Z"] }], "balanced", now)[0].score, null);
  assert.equal(rankValidators([{ ...parent, yield30: null }], "balanced", now)[0].score, null);
});

test("hourly historical yield does not invalidate fresh operational evidence", () => {
  // Production SN2: yield18:28:48, directory19:13:12, parameters19:27:36,
  // delegation19:30:06 and operator19:05:24. All operational sources agree.
  const checked = Date.parse("2026-11-04T19:35:00Z");
  const row = { ...base, operation: "delegated", timestamps: ["2026-11-04T18:28:48Z", "2026-11-04T19:13:12Z", "2026-11-04T19:27:36Z", "2026-11-04T19:30:06Z", "2026-11-04T19:05:24Z"] };
  assert.notEqual(rankValidators([row], "balanced", checked)[0].score, null);
  for (const index of [0, 1, 2, 3, 4]) {
    const timestamps = [...row.timestamps]; timestamps[index] = "2026-11-04T17:34:59Z";
    assert.equal(rankValidators([{ ...row, timestamps }], "balanced", checked)[0].score, null);
  }
  const timestamps = [...row.timestamps]; timestamps[1] = "2026-11-04T18:29:00Z";
  assert.ok(rankValidators([{ ...row, timestamps }], "balanced", checked)[0].excluded.includes("Operational source snapshots are more than an hour apart"));
});
