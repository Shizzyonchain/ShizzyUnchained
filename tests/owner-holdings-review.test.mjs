import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHoldingsReview} from '../scripts/owner-holdings-review.mjs';
const report={date:'2026-11-16',coverageStart:'2026-11-15T17:00:00Z',coverage:{gaps:['Owner-holdings refresh blocked; last verified snapshot retained.']}};
const audit={date:report.date,dailyWorkflowComplete:false,ownerHoldings:{status:'BLOCKED',checkedAt:'2026-11-16T15:00:00Z',reason:'Runtime schema unreviewed',evidence:'content/subnet-news/audits/holdings-failure.json'}};
test('current holdings require no fallback; disclosed collection failure preserves last good data',()=>{
 assert.doesNotThrow(()=>validateHoldingsReview('2026-11-16',report,undefined));
 assert.doesNotThrow(()=>validateHoldingsReview('2026-11-15',report,audit));
});
test('stale holdings cannot silently pass or claim complete workflow',()=>{
 for(const invalid of [undefined,{...audit,date:'2026-11-15'},{...audit,dailyWorkflowComplete:true},{...audit,ownerHoldings:{...audit.ownerHoldings,status:'DONE'}},{...audit,ownerHoldings:{...audit.ownerHoldings,evidence:''}},{...audit,ownerHoldings:{...audit.ownerHoldings,checkedAt:'2026-11-14T00:00:00Z'}}]) assert.throws(()=>validateHoldingsReview('2026-11-15',report,invalid));
 assert.throws(()=>validateHoldingsReview('2026-11-15',{...report,coverage:{gaps:[]}},audit));
});
