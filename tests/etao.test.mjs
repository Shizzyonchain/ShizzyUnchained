import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeEmission,decodeGammaEmission,emissionPercent} from '../app/lib/etao.ts';
import fs from 'node:fs';
const seed=JSON.parse(fs.readFileSync(new URL('../app/data/etao.json',import.meta.url)));
test('SCALE emission vectors preserve u64 precision and reject incomplete totals',()=>{
 const weights=seed.weights['122'];const bytes=Buffer.alloc(41);bytes[0]=20;weights.forEach((v,i)=>bytes.writeBigUInt64LE(BigInt(v),1+i*8));
 assert.deepEqual(decodeEmission('0x'+bytes.toString('hex')),weights);
 assert.equal(emissionPercent(weights[4]),'64.00%');
 bytes.writeBigUInt64LE(0n,17);assert.throws(()=>decodeEmission(bytes.toString('hex')));
 assert.throws(()=>decodeEmission('0x00'));
});
test('audited history contains unique transactions with reconciled before and after vectors',()=>{
 assert.ok(seed.changes.length >= 9);
 assert.equal(new Set(seed.changes.map(r=>`${r.block}-${r.extrinsic}-${r.netuid}`)).size,seed.changes.length);
 for(const row of seed.changes)for(const w of [row.before,row.after])assert.equal(w.reduce((s,v)=>s+BigInt(v),0n),18446744073709551615n);
 assert.ok(seed.changes.every(r=>r.netuid!==74));
 assert.equal(Object.keys(seed.weights).length,128);
});


test('Gamma allocations reconcile separately with the five base weights',()=>{
 const gamma=decodeGammaEmission('0x043300cccccccccccccc0c');
 assert.deepEqual(gamma,[{netuid:51,weight:'922337203685477580'}]);
 const weights=['0','0','3320413933267719290','7563165070220916162','6640827866535438583'];
 const bytes=Buffer.alloc(41);bytes[0]=20;weights.forEach((v,i)=>bytes.writeBigUInt64LE(BigInt(v),1+i*8));
 assert.deepEqual(decodeEmission('0x'+bytes.toString('hex'),gamma),weights);
 assert.throws(()=>decodeEmission('0x'+bytes.toString('hex')));
 assert.throws(()=>decodeEmission('0x'+bytes.toString('hex'),[{netuid:51,weight:'1'}]));
 assert.deepEqual(decodeGammaEmission('0x00'),[]);
 for(const invalid of ['0x043300','0x00ff','0x01','0xzz','0x083300cccccccccccccc0c3300cccccccccccccc0c'])assert.throws(()=>decodeGammaEmission(invalid));
});
