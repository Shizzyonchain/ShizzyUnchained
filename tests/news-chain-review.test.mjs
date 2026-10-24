import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChainReviews } from '../scripts/news-chain-review.mjs';
const report=()=>({date:'2026-10-24',coverageEnd:'2026-10-24T20:00:00Z',coverage:{gaps:[]}});
const receipt=()=>({status:'DONE',checkedAt:'2026-10-24T20:05:00Z',fromBlock:10,toBlock:20,hash:'0x'+'a'.repeat(64),throughTime:'2026-10-24T20:00:00Z',evidence:'/evidence/scan.json',gaps:[],archiveUpdated:true,newsDisposition:'No new qualifying events; prior coverage preserved.'});
const audit=()=>({chainReviews:{etao:receipt(),burns:receipt()}});
const archives={etao:{eventReview:{toBlock:20}},burns:{toBlock:20}};
test('daily publication requires both chain reviews and actual archived coverage',()=>{
 assert.doesNotThrow(()=>validateChainReviews(report(),audit(),archives));
 assert.throws(()=>validateChainReviews(report(),{}),/etao review/);
 const a=audit();delete a.chainReviews.burns;
 assert.throws(()=>validateChainReviews(report(),a,archives),/burns review/);
 assert.throws(()=>validateChainReviews(report(),audit(),{...archives,burns:{toBlock:19}}),/archive must be reconciled/);
});
test('incomplete, stale and mismatched finalized ranges cannot be DONE',()=>{
 for(const patch of [{gaps:['RPC range unavailable']},{throughTime:'2026-10-23T20:00:00Z'},{fromBlock:21},{hash:'pending'}]){
  const a=audit();Object.assign(a.chainReviews.burns,patch);
  assert.throws(()=>validateChainReviews(report(),a,archives));
 }
 const a=audit();a.chainReviews.burns.toBlock=19;
 assert.throws(()=>validateChainReviews(report(),a,archives),/same finalized cutoff/);
});
test('blocked review requires a public gap and cannot complete the daily workflow',()=>{
 const a=audit();a.chainReviews.burns={status:'BLOCKED',checkedAt:'2026-10-24T20:05:00Z',evidence:'Audit RPC failure receipt',reason:'Archive RPC unavailable',newsDisposition:'No unverified burns published'};
 assert.throws(()=>validateChainReviews(report(),a,archives),/public report/);
 const r=report();r.coverage.gaps.push('Burns review blocked: archive RPC unavailable.');
 assert.doesNotThrow(()=>validateChainReviews(r,a,archives));
 a.dailyWorkflowComplete=true;
 assert.throws(()=>validateChainReviews(r,a,archives),/cannot be a completed/);
});
test('new gate preserves editions before its introduction',()=>{
 assert.doesNotThrow(()=>validateChainReviews({date:'2026-10-23'},{}));
});
