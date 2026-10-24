"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { freshSignalRows, sectorHeat, volumeAlerts, type SignalRow } from "./lib/market-signals";
import styles from "./market-signals.module.css";
type Payload={buying:{buy:number;sell:number;asOf:string;count:number}|null;sectors:{id:string;name:string}[];tags:{netuid:number;sectors:string[]}[]};
const amount=(n:number)=>n.toLocaleString("en-US",{maximumFractionDigits:0});
const percent=(n:number)=>`${n>0?"+":""}${n.toFixed(2)}%`;
export function MarketSignals({rows}:{rows:SignalRow[]}){
 const [payload,setPayload]=useState<Payload|null>(null),[period,setPeriod]=useState<"1h"|"24h">("1h"),[now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const controller=new AbortController();async function refresh(){setNow(Date.now());try{const r=await fetch("/api/market-signals",{signal:controller.signal});if(r.ok)setPayload(await r.json());}catch{}}void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},60000);return()=>{controller.abort();clearInterval(timer);};},[]);
 const fresh=useMemo(()=>freshSignalRows(rows,now),[rows,now]);
 const heat=useMemo(()=>sectorHeat(fresh,payload?.sectors||[],payload?.tags||[],period),[fresh,payload,period]);
 const alerts=useMemo(()=>volumeAlerts(fresh,period),[fresh,period]);
 const buying=payload?.buying&&now-Date.parse(payload.buying.asOf)<=900000&&Date.parse(payload.buying.asOf)<=now+60000?payload.buying:null;
 const total=buying?buying.buy+buying.sell:0,share=buying&&total>0?buying.buy/total*100:null;
 const warm=heat.filter(s=>s.value>0).slice(0,3),cool=heat.filter(s=>s.value<0).slice(-3).reverse();
 return <section className={styles.grid} aria-label="Market signals">
 <article className={styles.card}><header><h2>Buyers vs Sellers</h2><span>24H</span></header><p className={styles.lead}>{share===null?(buying?"No recorded trades":"Trading data unavailable"):`${share.toFixed(0)}% buy volume`}</p>
 {buying&&share!==null&&<><div className={styles.bar} role="img" aria-label={`${share.toFixed(1)} percent buy volume, ${(100-share).toFixed(1)} percent sell volume`}><i style={{width:`${share}%`}}/></div><div className={styles.totals}><span>Buys <b className={styles.up}>{amount(buying.buy)} TAO</b></span><span>Sells <b className={styles.down}>{amount(buying.sell)} TAO</b></span></div><p className={styles.note}>Net {buying.buy>=buying.sell?"+":""}{amount(buying.buy-buying.sell)} TAO · {buying.count} subnets</p></>}
 <details><summary>How to read it</summary><p>Indexed alpha trade volume, measured in TAO over the latest rolling 24 hours. Root is excluded. This compares amounts traded, not unique people or reserve changes.</p><p>Example: 60 TAO bought and 40 TAO sold = 60% buy volume. It does not guarantee rising prices.</p><p>TaoStats{buying?` · snapshot ${new Date(buying.asOf).toLocaleTimeString("en-GB",{timeZone:"UTC"})} UTC`:" · waiting for a complete recent snapshot"}.</p></details></article>
 <article className={styles.card}><header><h2>Sector Heat</h2><div className={styles.periods} role="group" aria-label="Market signal period">{(["1h","24h"] as const).map(p=><button type="button" key={p} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{p.toUpperCase()}</button>)}</div></header><p className={styles.note}>Median alpha / TAO move · {period.toUpperCase()}</p>
 <div className={styles.heat}>{[["Warming",warm],["Cooling",cool]].map(([label,items])=><div key={label as string}><h3>{label as string}</h3>{(items as typeof heat).length?(items as typeof heat).map(s=><Link prefetch={false} key={s.id} href={`/sectors?sector=${s.id}`}><span>{s.name}</span><b className={s.value>0?styles.up:styles.down}>{percent(s.value)}</b></Link>):<p className={styles.note}>{fresh.length?"None with enough coverage":"Waiting for fresh data"}</p>}</div>)}</div>
 <details><summary>How to read it</summary><p>The middle return in each sector, with equal weight per subnet. At least two members and 80% coverage are required. Tags overlap, so a subnet may appear in more than one sector.</p><p>Example: returns of −2%, +1%, +8% give a median of +1%. This measures token prices, not product adoption.</p></details></article>
 <article className={styles.card}><header><h2>Volume Alerts</h2><span>{period.toUpperCase()}</span></header><p className={styles.note}>At least 2× the previous {period==="1h"?"hour":"24 hours"}</p><div className={styles.alerts}>{alerts.length?alerts.map(a=><Link prefetch={false} href={`/charts/${a.netuid}`} key={a.netuid}><span><b>{a.name}</b><small>SN{a.netuid} · {amount(a.volume)} TAO</small></span><strong>{a.ratio.toFixed(1)}×</strong></Link>):<p>{fresh.length?"No unusual volume right now":"Waiting for fresh data"}</p>}</div><details><summary>How to read it</summary><p>Top three volume increases versus the preceding equal-length period, with at least 10 TAO traded. Missing comparisons and delayed rows are excluded.</p><p>Example: 20 TAO after a 10-TAO hour = 2×. More activity can include both buying and selling.</p></details></article>
 </section>;
}
