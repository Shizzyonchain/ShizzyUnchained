import test from 'node:test';
import assert from 'node:assert/strict';
import {exchangeHistoryWindows} from '../app/lib/exchange-history-window.ts';
test('hourly FX includes the morning before its fixed-window rollover',()=>{
 const now=Date.parse('2026-11-23T19:24:00Z');
 const windows=exchangeHistoryWindows('1h',now);
 for(const hour of [9,10,11,12,18]){
  const stamp=Date.parse(`2026-11-23T${String(hour).padStart(2,'0')}:00:00Z`)/1000;
  assert.ok(windows.some(w=>w.start<=stamp&&w.end>=stamp));
 }
});
test('a newly opened window retains prior hourly and minute coverage',()=>{
 for(const [interval,step]of [['1h',3600],['1m',60],['10m',300]]){
  const now=299*step*1000*100;
  const windows=exchangeHistoryWindows(interval,now);
  assert.equal(windows[0].start,now/1000);
  assert.ok(Math.min(...windows.map(w=>w.start))<=now/1000-299*step);
  for(const w of windows)assert.ok(w.end-w.start<=299*step);
 }
});
