import test from 'node:test';
import assert from 'node:assert/strict';
import {indexNews,searchNews} from '../app/lib/news-search.ts';
const item=(headline,status='verified',rating=3)=>({headline,summary:'A model for café researchers.',status,rating,sources:[],importance:'medium'});
const story=item('New model ships');
const reports=[{date:'2026-11-01',subnets:[{netuid:8,name:'Historical Name',updates:[story,item('Incident update','developing',2)]}],ecosystem:[item('Protocol release','verified',4)],highlights:[story]},{date:'2026-10-31',subnets:[{netuid:8,name:'Earlier Name',updates:[story]}],ecosystem:[],highlights:[]}];
test('news index deduplicates edition highlights while preserving older follow-ups and labels',()=>{
 const rows=indexNews(reports);assert.equal(rows.length,4);assert.equal(rows[0].date,'2026-11-01');assert.equal(rows.at(-1).name,'Earlier Name');
 assert.equal(searchNews(rows,{subnet:'8'}).length,3);assert.equal(searchNews(rows,{subnet:'ecosystem'}).length,1);
});
test('combined literal keyword, status, rating and edition range filters respect missing values',()=>{
 const rows=indexNews(reports);
 assert.equal(searchNews(rows,{query:'SN8 cafe',status:'verified',minimum:3,from:'2026-11-01',to:'2026-11-01'}).length,1);
 assert.equal(searchNews(rows,{query:'model absent'}).length,0);assert.equal(searchNews(rows,{status:'developing',minimum:3}).length,0);
 assert.equal(searchNews(rows,{from:'2026-11-02',to:'2026-10-01'}).length,0);
});
