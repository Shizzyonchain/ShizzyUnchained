import { readFile,readdir } from 'node:fs/promises';
import { holdingForOwner } from '../app/lib/owner-holdings.ts';
import { validateHoldingsReview } from './owner-holdings-review.mjs';
const data=JSON.parse(await readFile('app/data/owner-holdings.json','utf8'));
const dates=(await readdir('content/subnet-news')).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
const latest=dates.at(-1)?.slice(0,10);
const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(data.asOf));
const p=Object.fromEntries(parts.map(p=>[p.type,p.value]));const day=`${p.year}-${p.month}-${p.day}`;
if(latest&&day<latest){
 const report=JSON.parse(await readFile(`content/subnet-news/${latest}.json`,'utf8'));
 const audit=JSON.parse(await readFile(`content/subnet-news/audits/${latest}.json`,'utf8'));
 validateHoldingsReview(day,report,audit);
 await readFile(audit.ownerHoldings.evidence,'utf8');
 console.warn(`Owner holdings refresh BLOCKED; preserving verified ${day} snapshot with public disclosure.`);
}
if(Object.keys(data.subnets).length!==128)throw new Error('Incomplete owner holdings roster');
for(let sn=1;sn<=128;sn++){
 const row=data.subnets[String(sn)];
 if(!row||!holdingForOwner(data,sn,row.address)||BigInt(row.lockedAlphaRaw)>BigInt(row.alphaRaw)||BigInt(row.unstakableAlphaRaw)>BigInt(row.alphaRaw))throw new Error(`Invalid owner holdings for SN${sn}`);
}
const proof=JSON.parse(await readFile('public'+data.evidence,'utf8'));
if(proof.snapshot.hash!==data.hash||proof.snapshot.block!==data.block||JSON.stringify(proof.snapshot.subnets)!==JSON.stringify(data.subnets))throw new Error('Holdings and saved chain evidence disagree');
if (proof.ownerEmissionRates) {
 for (const [sn, rate] of Object.entries(proof.ownerEmissionRates)) {
  const weights=rate.weights.map(BigInt), row=data.subnets[sn], max=(1n<<64n)-1n;
  if(weights.length!==5||weights.some(v=>v<0n)||weights.reduce((a,b)=>a+b,0n)+(rate.gamma||[]).reduce((a,[,w])=>a+BigInt(w),0n)!==max||rate.blocksPerDay!==7200||BigInt(rate.alphaOutEmissionRaw)<0n)throw new Error(`Invalid emission evidence for SN${sn}`);
  const daily=BigInt(rate.alphaOutEmissionRaw)*weights[2]/max*7200n;
  if(row.ownerEmissionPerDayRaw!==String(daily)||row.ownerWeightRaw!==String(weights[2])||row.alphaOutEmissionRaw!==rate.alphaOutEmissionRaw)throw new Error(`Owner/day does not match finalized evidence for SN${sn}`);
 }
 if(Object.keys(proof.ownerEmissionRates).length!==128)throw new Error('Incomplete owner emission roster');
}
console.log(`Validated 128 owner holdings at finalized block ${data.block}; ${day} Eastern.`);
