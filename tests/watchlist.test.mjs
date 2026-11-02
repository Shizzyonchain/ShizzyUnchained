import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWatchlist } from '../app/lib/watchlist.ts';
test('local watchlist rejects corrupt, foreign and duplicate values',()=>{
 assert.deepEqual(readWatchlist('broken',[8]),[]);
 assert.deepEqual(readWatchlist('{"id":8}',[8]),[]);
 assert.deepEqual(readWatchlist('[8,8,"8",1.5,null,999,65]',[8,65]),[8,65]);
});
test('local watchlist retains user order and caps restored selections',()=>{
 const ids=Array.from({length:30},(_,i)=>i+1).reverse();
 assert.deepEqual(readWatchlist(JSON.stringify(ids),ids),ids.slice(0,20));
});
