import test from 'node:test';
import assert from 'node:assert/strict';
import { observationIsResolved } from '../app/lib/etao.ts';

test('verified lifecycle reset clears its cached observation without creating an owner action', () => {
  const after=['0','0','18','41','41'];
  const reset={netuid:70,block:9364302,after};
  const row={netuid:70,fromBlock:9364270,toBlock:9364345,after,before:null,detectedAt:'2026-10-26T00:49:26Z'};
  assert.equal(observationIsResolved(row,[reset]),true);
  assert.equal(observationIsResolved({...row,netuid:76},[reset]),false);
  assert.equal(observationIsResolved({...row,toBlock:9364301},[reset]),false);
  assert.equal(observationIsResolved({...row,fromBlock:9364302},[reset]),false);
  assert.equal(observationIsResolved({...row,after:['0','0','33','33','34']},[reset]),false);
});
