export type OwnerHolding={address:string;registeredAt:number;alphaRaw:string;lockedAlphaRaw:string;unstakableAlphaRaw:string;freeTaoRaw:string;frozenTaoRaw:string;rootTaoRaw:string};
export type OwnerHoldings={block:number;hash:string;asOf:string;source:string;evidence:string;subnets:Record<string,OwnerHolding>};
/** Old wallet snapshots must never follow a subnet to a different owner. */
export function holdingForOwner(snapshot:OwnerHoldings|undefined,netuid:number,address:string|undefined,now=Date.now()){
 const value=snapshot?.subnets[String(netuid)],time=Date.parse(snapshot?.asOf||'');
 if(!snapshot||!address||value?.address!==address||!Number.isFinite(time)||time>now+60000||!Number.isInteger(snapshot.block)||snapshot.block<=0)return null;
 if(![value.alphaRaw,value.lockedAlphaRaw,value.unstakableAlphaRaw,value.freeTaoRaw,value.frozenTaoRaw,value.rootTaoRaw].every(v=>/^\d+$/.test(v)))return null;
 return {...value,asOf:snapshot.asOf,block:snapshot.block,hash:snapshot.hash,evidence:snapshot.evidence,overdue:now-time>36*3600000};
}
export function displayHolding(raw:string){return (Number(BigInt(raw))/1e9).toLocaleString('en-US',{maximumFractionDigits:2});}
