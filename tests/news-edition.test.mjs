import test from 'node:test';
import assert from 'node:assert/strict';
import { rankEdition } from '../app/lib/news-edition.ts';
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
