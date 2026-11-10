import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../app/data/sectors.json',import.meta.url),'utf8'));

test('sector directory contains every subnet slot exactly once and only known multi-sector tags',()=>{
 assert.equal(data.subnets.length,128);
 assert.deepEqual(data.subnets.map(row=>row.netuid).sort((a,b)=>a-b),Array.from({length:128},(_,i)=>i+1));
 const ids=new Set(data.sectors.map(sector=>sector.id));assert.equal(ids.size,data.sectors.length);
 for(const row of data.subnets){
  assert.ok(row.name&&row.summary&&row.basis);
  assert.equal(new Set(row.sectors).size,row.sectors.length);
  for(const id of row.sectors)assert.ok(ids.has(id));
  if(row.source)assert.ok(['https:','http:'].includes(new URL(row.source).protocol));
  if(!row.sectors.length)assert.equal(row.reviewStatus,'unclassified');
  assert.ok(row.reviewNote && Number.isFinite(Date.parse(row.reviewedAt)));
 }
 assert.ok(data.subnets.some(row=>row.sectors.length>1));
});

test('directory classifications have dated source evidence and no inherited classification for Unknown',()=>{
 assert.ok(Number.isFinite(Date.parse(data.reviewedAt))&&data.sourceBlock>0);
 const evidence=JSON.parse(fs.readFileSync(new URL(`../public${data.evidenceUrl}`,import.meta.url),'utf8'));
 assert.equal((evidence.rows || evidence.outcomes).length,128);assert.equal(evidence.block,data.sourceBlock);
 for(const row of data.subnets.filter(row=>row.name==='Unknown'))assert.deepEqual(row.sectors,[]);
 assert.ok(data.subnets.filter(row=>!row.sectors.length).every(row=>row.summary));
});

test("review corrections follow current products rather than legacy descriptions",()=>{
 const tags=n=>data.subnets.find(row=>row.netuid===n).sectors;
 // The current ms.computer website is still coming soon; Quasar's old product
 // classification must not silently describe the renamed team's current product.
 assert.equal(data.subnets.find(row=>row.netuid===24).name,"ms.computer");
 assert.deepEqual(tags(24),[]);
 assert.equal(data.subnets.find(row=>row.netuid===24).source,"https://ms.computer/");
 assert.ok(tags(74).includes("software")&&!tags(74).includes("agents"));
 assert.ok(tags(96).includes("inference")&&!tags(96).includes("training"));
 // Registration 9447220 replaced Thirty Spokes without a successor identity.
 assert.equal(data.subnets.find(row=>row.netuid===99).name,"Unknown");
 assert.deepEqual(tags(99),[]);
 assert.ok(tags(104).includes("inference")&&!tags(104).includes("forecasting"));
 assert.ok(tags(94).includes("training")&&tags(94).includes("agents"));
 assert.equal(data.subnets.find(row=>row.netuid===29).basis,"Owner-submitted on-chain description");
});
