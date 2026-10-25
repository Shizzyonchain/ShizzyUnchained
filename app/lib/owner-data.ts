"use client";
import { useEffect, useState } from "react";
import type { OwnerHoldings } from "./owner-holdings";
export type BurnSnapshot={asOf:string;historyStart:string;subnets:Record<string,{alphaRaw:string;events:number;complete:boolean}>};
export type Owners={checkedAt:string;block:number;owners:Record<string,string>;holdings?:OwnerHoldings;burns?:BurnSnapshot};
let cached:Owners|null=null;
let pending:Promise<Owners>|null=null;
async function loadOwners(){
  if(cached&&Date.now()-Date.parse(cached.checkedAt)<15*60_000)return cached;
  if(!pending)pending=fetch("/api/subnets/owners",{signal:AbortSignal.timeout(8000)}).then(async r=>{
    if(!r.ok)throw new Error("Owner data unavailable");
    const data=await r.json() as Owners;
    if(!data.owners||!Number.isInteger(data.block)||!Number.isFinite(Date.parse(data.checkedAt)))throw new Error("Invalid owner data");
    cached=data;return data;
  }).finally(()=>{pending=null;});
  return pending;
}
/** Both visible research sections share one coalesced request and last-good data. */
export function useOwners(){
  const [snapshot,setSnapshot]=useState<Owners|null>(null),[error,setError]=useState(false);
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    let cancelled=false;
    const refresh=()=>{loadOwners().then(data=>{if(!cancelled){setSnapshot(data);setNow(Date.now());setError(false);}}).catch(()=>{if(!cancelled){setNow(Date.now());setError(true);}});};
    refresh();const timer=setInterval(refresh,60_000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[]);
  return {snapshot,error,now};
}
