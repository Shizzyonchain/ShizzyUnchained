import { matchesSubnetQuery } from "./subnet-search";
import { poolPockets, type BubbleBody } from "./bubble-physics";

type Label = { id:number; name:string; change:number; changeLabel:string };
const sheet=(size:number)=>{const c=document.createElement("canvas");c.width=size;c.height=size;return c;};
/** Bake lighting/text once; each animation frame only composites cached bitmaps. */
export function createBallPainter(canvas:HTMLCanvasElement, items:Label[]) {
  const ctx=canvas.getContext("2d",{alpha:false,desynchronized:true});
  const skins=new Map<string,HTMLCanvasElement>(),labels=new Map<string,HTMLCanvasElement>();
  let rows=new Map(items.map(item=>[item.id,item]));
  for(const [key,colors] of Object.entries({gain:["#53d2a0","#107b51","#002519"],loss:["#ed8299","#992e47","#290814"],flat:["#b5c0ce","#5b687c","#121b29"]})) {
    const c=sheet(192),g=c.getContext("2d")!;
    g.shadowColor="#000c";g.shadowBlur=8;g.shadowOffsetX=3;g.shadowOffsetY=9;
    const shade=g.createRadialGradient(70,65,3,102,102,79);shade.addColorStop(0,colors[0]);shade.addColorStop(.42,colors[1]);shade.addColorStop(1,colors[2]);
    g.fillStyle=shade;g.beginPath();g.arc(96,96,72,0,Math.PI*2);g.fill();g.shadowColor="transparent";
    const shine=g.createRadialGradient(73,65,1,73,65,29);shine.addColorStop(0,"#ffffffa8");shine.addColorStop(.3,"#ffffff38");shine.addColorStop(1,"#ffffff00");g.fillStyle=shine;g.beginPath();g.arc(73,65,29,0,Math.PI*2);g.fill();skins.set(key,c);
  }
  const stripe=sheet(128),sc=stripe.getContext("2d")!;
  sc.strokeStyle="#ffffff24";sc.lineWidth=4;sc.beginPath();sc.ellipse(64,64,26,56,-.4,0,Math.PI*2);sc.closePath();sc.stroke();
  const label=(item:Label,small:boolean)=>{
    const key=`${item.id}:${small}`;let image=labels.get(key);if(image)return image;
    image=sheet(192);const g=image.getContext("2d")!;g.drawImage(skins.get(item.change>.005?"gain":item.change<-.005?"loss":"flat")!,0,0);g.setTransform(1.125,0,0,1.125,24,24);g.textAlign="center";g.fillStyle="#fff";g.shadowColor="#000";g.shadowBlur=3;
    if(!small){g.font="500 13px Arial";let name=item.name;while(g.measureText(name).width>104&&name.length>2)name=name.slice(0,-2);if(name!==item.name)name+="…";g.fillText(name,64,42);}
    g.font=`700 ${small?35:30}px monospace`;g.fillText(`SN${item.id}`,64,small?76:75);
    if(!small){g.font="700 14px monospace";g.fillText(item.changeLabel,64,94);}labels.set(key,image);return image;
  };
  let width=0,height=0,dpr=1;
  const cloth=sheet(1);
  return {
    update(items:Label[]){const next=new Map(items.map(item=>[item.id,item]));for(const [id,item] of rows){const n=next.get(id);if(!n||n.name!==item.name||n.changeLabel!==item.changeLabel||(n.change>.005?1:n.change<-.005?-1:0)!==(item.change>.005?1:item.change<-.005?-1:0)){labels.delete(`${id}:true`);labels.delete(`${id}:false`);}}rows=next;},
    resize(w:number,h:number){width=w;height=h;dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);
      cloth.width=canvas.width;cloth.height=canvas.height;const g=cloth.getContext("2d")!;g.setTransform(dpr,0,0,dpr,0,0);
      const shade=g.createRadialGradient(w*.5,h*.3,0,w*.5,h*.3,Math.max(w,h));shade.addColorStop(0,"#171919");shade.addColorStop(1,"#070808");g.fillStyle=shade;g.fillRect(0,0,w,h);
      for(const pocket of poolPockets(w,h)){g.shadowColor="#ffffff25";g.shadowBlur=4;g.fillStyle="#000";g.beginPath();g.arc(pocket.x,pocket.y,pocket.r,0,Math.PI*2);g.fill();}},
    paint(bodies:BubbleBody[],query:string,focused:number|null){
      if(!ctx||width<1||height<1)return;ctx.drawImage(cloth,0,0,width,height);
      for(const body of bodies){const item=rows.get(body.id);if(!item)continue;
        const scale=body.pocket?Math.max(.02,1-body.pocket.progress):body.returning?1-body.returning*.35:1;
        const r=body.r*scale,diameter=r*2;
        ctx.globalAlpha=(!query.trim()||matchesSubnetQuery({name:item.name,netuid:item.id},query)?1:.18)*(body.pocket?1-body.pocket.progress*.8:body.returning?1-body.returning:1);
        ctx.drawImage(label(item,body.r<18),body.x-r*4/3,body.y-r*4/3,diameter*4/3,diameter*4/3);
        ctx.save();ctx.translate(body.x,body.y);ctx.rotate(((body.rollY??0)+(body.rollX??0)) * Math.PI/180);ctx.drawImage(stripe,-r,-r,diameter,diameter);ctx.restore();

        if(focused===body.id){ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(body.x,body.y,r+3,0,Math.PI*2);ctx.stroke();}
      }ctx.globalAlpha=1;
    }
  };
}
