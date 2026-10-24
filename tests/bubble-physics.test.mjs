import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutBubbles, stepBubbles } from '../app/lib/bubble-physics.ts';
const shapes=Array.from({length:128},(_,i)=>({id:i+1,size:i===69?152:52+(i%7)*3}));
test('128 bubbles pack within desktop and phone bounds without intersections',()=>{
 for(const [w,h] of [[1380,720],[343,1040]]){
  const bodies=layoutBubbles(shapes,w,h);
  assert.equal(bodies.length,128);
  for(const b of bodies){assert.ok(Number.isFinite(b.x+b.y+b.r));assert.ok(b.x>=b.r&&b.x+b.r<=w);assert.ok(b.y>=b.r&&b.y+b.r<=h);}
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
   const a=bodies[i],b=bodies[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r-1,`${w}px: ${a.id}/${b.id} overlap`);
  }
 }
});
test('dragged body pushes neighbors while remaining pinned; release rebounds stay bounded',()=>{
 const a={id:1,x:80,y:80,vx:0,vy:0,r:25,targetR:25},b={...a,id:2,x:90,vx:-2};
 stepBubbles([a,b],300,200,1,0,false,1);assert.equal(a.x,80);assert.ok(b.x>90);
 for(let i=0;i<500;i++)stepBubbles([a,b],300,200,2,i*32,true);
 for(const row of [a,b])assert.ok(Number.isFinite(row.x+row.y+row.vx+row.vy)&&row.x>=row.r&&row.x+row.r<=300);
});
test('refresh retains positions, resizing stays bounded and repacking changes the layout',()=>{
 const initial=layoutBubbles(shapes,1380,720);const before=initial.map(b=>b.x);
 const refresh=layoutBubbles(shapes,1380,720,initial);assert.deepEqual(refresh.map(b=>b.x),before);
 const repack=layoutBubbles(shapes,1380,720,[],1);assert.notDeepEqual(repack.map(b=>b.x),before);
 const resized=layoutBubbles(shapes,343,1040,initial);for(let i=0;i<200;i++)stepBubbles(resized,343,1040,1,0,false);
 assert.ok(resized.every(b=>Number.isFinite(b.x+b.y)&&b.x>=b.r&&b.x+b.r<=343));
});
test('one invalid size cannot poison the whole market layout',()=>{
 const rows=layoutBubbles([{id:1,size:NaN},{id:2,size:0},{id:3,size:Infinity}],343,1040);
 assert.ok(rows.every(b=>Number.isFinite(b.x+b.y+b.r)&&b.r>=15));
});
