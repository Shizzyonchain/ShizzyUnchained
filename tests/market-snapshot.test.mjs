import assert from 'node:assert/strict';
import test from 'node:test';
import { latestSnapshotTime, snapshotIsFresh, persistMarketSnapshot, marketSnapshotHealth } from '../app/lib/market-snapshot.ts';

test('stale snapshots recover on actual new data, and age out without new data', () => {
  const now = Date.parse('2026-10-18T22:00:00Z');
  const old = latestSnapshotTime([{time:'invalid'}, {time:'2026-10-18T21:55:00Z'}]);
  assert.equal(snapshotIsFresh(old, now), false);
  const fresh = latestSnapshotTime([{time:'2026-10-18T21:55:00Z'}, {time:'2026-10-18T21:59:00Z'}]);
  assert.equal(snapshotIsFresh(fresh, now), true);
  assert.equal(snapshotIsFresh(fresh, now + 180_000), false);
  assert.equal(snapshotIsFresh(latestSnapshotTime([]), now), false);
});

test('full or unavailable browser storage cannot reject a live snapshot', () => {
  const rows = [{time:'2026-10-18T21:59:00Z', netuid:58}];
  for (const storage of [
    () => { throw new Error('SecurityError'); },
    () => ({setItem() { throw new Error('QuotaExceededError'); }}),
  ]) assert.equal(persistMarketSnapshot(rows, storage), false);
  let stored;
  assert.equal(persistMarketSnapshot(rows, () => ({setItem(key, value) { stored={key, value}; }})), true);
  assert.equal(stored.key, 'shizzy:screener');
  assert.deepEqual(JSON.parse(stored.value).data, rows);
});

test('live means complete current rows, not merely one new timestamp',()=>{
 const now=Date.now();const rows=Array.from({length:128},(_,i)=>({netuid:i+1,time:new Date(now-30000).toISOString()}));
 assert.equal(marketSnapshotHealth(rows,now).fresh,true);
 assert.equal(marketSnapshotHealth(rows.slice(0,127),now).fresh,false);
 rows[0].time=new Date(now-240000).toISOString();assert.equal(marketSnapshotHealth(rows,now).stale,1);assert.equal(marketSnapshotHealth(rows,now).fresh,false);
 rows[0].time=new Date(now+86400000).toISOString();assert.equal(marketSnapshotHealth(rows,now).fresh,false);assert.equal(snapshotIsFresh(now+86400000,now),false);
 rows[0]={...rows[1]};assert.equal(marketSnapshotHealth(rows,now).complete,false);
});

test('expanded roster stays fresh while holes and duplicate subnet slots fail',()=>{
 const now=Date.parse('2026-11-26T14:00:00Z');
 const rows=Array.from({length:129},(_,i)=>({netuid:i+1,time:new Date(now).toISOString()}));
 assert.equal(marketSnapshotHealth(rows,now).fresh,true);
 assert.equal(marketSnapshotHealth(rows.filter(row=>row.netuid!==70),now).complete,false);
 assert.equal(marketSnapshotHealth([...rows.slice(0,-1),rows[0]],now).complete,false);
});
