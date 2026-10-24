import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutBubbles, stepBubbles, poolPockets, stepPoolPockets } from '../app/lib/bubble-physics.ts';
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


test('fitting balls sink at all four corners and return intact',()=>{
 for(const [w,h] of [[1380,720],[343,1040]])for(const [corner,p] of poolPockets(w,h).entries()){
  const b={id:51,x:p.x,y:p.y,vx:0,vy:0,r:18,targetR:18};
  stepPoolPockets([b],w,h,1,0);assert.equal(b.pocket.corner,corner);
  for(let i=0;i<70;i++){stepBubbles([b],w,h,1,i,false);stepPoolPockets([b],w,h,1,i);}
  assert.equal(b.pocket,undefined);assert.equal(b.id,51);assert.equal(b.r,18);
  assert.ok(b.x>=b.r&&b.x+b.r<=w&&b.y>=b.r&&b.y+b.r<=h);
 }
});
test('oversized, held and paused balls do not sink',()=>{
 const p=poolPockets(1380,720)[0];
 const b={id:1,x:p.x+20,y:p.y+20,vx:-1,vy:-1,r:p.r+5,targetR:p.r+5};
 stepPoolPockets([b],1380,720,1,0);assert.equal(b.pocket,undefined);assert.ok(b.vx>0&&b.vy>0);
 const small={...b,r:18,targetR:18,x:p.x,y:p.y};
 stepPoolPockets([small],1380,720,1,0,true,1);assert.equal(small.pocket,undefined);
 stepPoolPockets([small],1380,720,1,0,false);assert.equal(small.pocket,undefined);
 stepPoolPockets([small],1380,720,1,0);assert.ok(small.pocket);
});
