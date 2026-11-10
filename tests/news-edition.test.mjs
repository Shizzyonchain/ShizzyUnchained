import test from 'node:test';
import assert from 'node:assert/strict';
import { rankEdition } from '../app/lib/news-edition.ts';
import { validateEditorialOrder } from '../app/lib/news-editorial-order.mjs';
test('edition preserves distinct reporting and merges only exact desk repeats',()=>{
 const a={headline:'One headline',summary:'Original',rating:4,sources:[]};
 const b={...a,summary:'Different evidence'};
 const rows=rankEdition({highlights:[a],ecosystem:[b],subnets:[{netuid:51,name:'Lium',updates:[a]}]});
 assert.equal(rows.length,2); assert.equal(rows[0].context,'SN51 · Lium'); assert.equal(rows[1].item.summary,'Different evidence');
});
test('edition ranks priority without dropping short updates',()=>{
 const rows=rankEdition({highlights:[{headline:'Brief',rating:1},{headline:'Lead',rating:5}],ecosystem:[],subnets:[]});
 assert.deepEqual(rows.map(row=>row.item.headline),['Lead','Brief']);
});

test('reviewed lead overrides ecosystem insertion order without changing stars',()=>{
 const research={headline:'Fund research',rating:4,status:'verified',priceAction:{change24hPct:5}};
 const gamma={headline:'Gamma service adoption',rating:4,status:'verified'};
 const brief={date:'2026-11-10',highlights:[],ecosystem:[research],subnets:[{netuid:58,name:'Attune',updates:[gamma]}],storyOrder:[gamma.headline,research.headline]};
 const rows=rankEdition(brief);
 assert.deepEqual(rows.map(row=>row.item.headline),brief.storyOrder);
 assert.equal(rows[0].context,'SN58 · Attune');
 assert.equal(rows[0].item.rating,4);
});

test('new editions reject missing, stale, incomplete or duplicated editorial orders',()=>{
 const a={headline:'A',rating:4,status:'verified'};
 const b={headline:'B',rating:3,status:'developing'};
 const brief={date:'2026-11-10',highlights:[a,b],ecosystem:[],subnets:[]};
 assert.throws(()=>validateEditorialOrder(brief),/explicit storyOrder/);
 for(const storyOrder of [['A'],['A','A'],['A','Missing']]) assert.throws(()=>validateEditorialOrder({...brief,storyOrder}));
 assert.throws(()=>validateEditorialOrder({...brief,storyOrder:['B','A']}),/verified main story/);
 assert.equal(validateEditorialOrder({...brief,storyOrder:['A','B']}).size,2);
 const minor={headline:'Minor',rating:2,status:'verified'};
 assert.throws(()=>validateEditorialOrder({...brief,highlights:[a,b,minor],storyOrder:['A','Minor','B']}),/minor briefs must follow/);
});
