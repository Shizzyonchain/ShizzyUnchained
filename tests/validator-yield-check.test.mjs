import test from 'node:test';
import assert from 'node:assert/strict';
import { currentYieldCheck, yieldCandidates, yieldSnapshotKey, thirtyDayRewardGrowth } from '../app/lib/validator-yield-check.ts';
test('only the exact fresh provider snapshot can carry a current chain check', () => {
  const timestamp = '2026-10-16T12:00:00Z';
  const check = { providerBlock: 100, providerTimestamp: timestamp };
  const now = Date.parse(timestamp)+3600000;
  assert.equal(currentYieldCheck(check,100,timestamp,now),check);
  assert.equal(currentYieldCheck(check,101,timestamp,now),undefined);
  assert.equal(currentYieldCheck(check,100,timestamp,now+7200000),undefined);
  assert.equal(currentYieldCheck(check,100,timestamp,now-7200000),undefined);
  assert.equal(currentYieldCheck(check,100,'invalid',now),undefined);
});
test('chain rankings never mix provider rates with calculated APY, and need exact fresh snapshots', () => {
  const timestamp='2026-10-16T12:00:00Z', now=Date.parse(timestamp)+60000;
  const candidates=['a','b','c'].map(hotkey=>({hotkey,yieldBlock:100,timestamps:[timestamp],yieldBasis:'nominator-net',yield7:.3,yield30:.3}));
  const window={status:'basis-review',chainApy:.4,chainApr:.34};
  const checks={netuid:64,state:'ready',result:{methodVersion:4,rows:['a','b'].map(hotkey=>({hotkey,providerBlock:100,providerTimestamp:timestamp,seven:window,thirty:window}))}};
  const selected=yieldCandidates(candidates,checks,64,now);
  assert.equal(selected.source,'chain');
  assert.equal(selected.candidates[0].yield7,.4);
  assert.equal(selected.candidates[0].apr7,.34);
  assert.equal(selected.candidates[2].yield7,null);
  assert.equal(selected.candidates[2].yieldBasis,'unknown');
  assert.equal(yieldCandidates(candidates,checks,51,now).source,'provider');
  assert.equal(yieldCandidates(candidates,checks,64,now+7200000).source,'provider');
  assert.equal(yieldCandidates(candidates,{...checks,result:{...checks.result,methodVersion:2}},64,now).source,'provider');
});

test('continuous node checks restart only when yield evidence changes', () => {
  const rows = [{ hotkey: 'a', yieldBlock: 100, timestamps: ['2026-10-19T17:00:00Z'], name: 'Old label' }, { hotkey: 'b', yieldBlock: 100, timestamps: ['2026-10-19T17:00:00Z'] }];
  const original = yieldSnapshotKey(rows);
  assert.equal(yieldSnapshotKey([...rows].reverse()), original);
  assert.equal(yieldSnapshotKey([{ ...rows[0], name: 'New label' }, rows[1]]), original);
  assert.notEqual(yieldSnapshotKey([{ ...rows[0], yieldBlock: 101 }, rows[1]]), original);
  assert.notEqual(yieldSnapshotKey([{ ...rows[0], timestamps: ['2026-10-19T18:00:00Z'] }, rows[1]]), original);
});

test('30-day reward display reverses chain annualization without inventing provider compounding', () => {
  const growth = .031;
  assert.ok(Math.abs(thirtyDayRewardGrowth({ yieldBasis: 'chain-net', yield30: Math.expm1(Math.log1p(growth) * 365 / 30) }) - growth) < 1e-12);
  assert.equal(thirtyDayRewardGrowth({ yieldBasis: 'nominator-net', yield30: .45 }), null);
  for (const yield30 of [null, NaN, Infinity, -1]) assert.equal(thirtyDayRewardGrowth({ yieldBasis: 'chain-net', yield30 }), null);
  assert.equal(thirtyDayRewardGrowth({ yieldBasis: 'chain-net', yield30: 0 }), 0);
});
