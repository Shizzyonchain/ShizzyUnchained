"use client";
import { useMemo, useState } from "react";
import styles from "./page.module.css";
type Row = {id:number;name:string;service:string;registered:boolean;minted:number;spent:number;description:string;workflow:string;terms:string;source:string};
const number = (value:number) => value.toLocaleString("en-US", {maximumFractionDigits:2,minimumFractionDigits:2});
export default function GammaDirectory({rows}:{rows:Row[]}) {
 const [query,setQuery]=useState("");
 const [sort,setSort]=useState("minted");
 const [registered,setRegistered]=useState(false);
 const shown=useMemo(()=>rows.filter(r=>(!registered||r.registered)&&`${r.name} SN${r.id} ${r.service}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==="spent"?b.spent-a.spent:sort==="name"?a.name.localeCompare(b.name):b.minted-a.minted),[rows,query,sort,registered]);
 return <section className={styles.directory} aria-labelledby="directory-heading"><div className={styles.directoryHeading}><div><p className={styles.kicker}>THE SUBNETS</p><h2 id="directory-heading">Who accepts Gamma?</h2></div><span>{rows.length} enabled in this snapshot</span></div>
 <div className={styles.controls}><label>Find a subnet<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, SN or service" type="search"/></label><label>Sort by<select value={sort} onChange={e=>setSort(e.target.value)}><option value="minted">Most credits created</option><option value="spent">Most credits used</option><option value="name">Subnet name</option></select></label><label className={styles.checkbox}><input type="checkbox" checked={registered} onChange={e=>setRegistered(e.target.checked)}/> Service registered only</label></div>
 <p className={styles.note}>{shown.length} subnets · Amounts in Gamma · Reviewed interval only</p>
 <div className={styles.directoryRows}>{shown.map(r=><details className={styles.subnetRow} key={r.id}><summary><span className={styles.subnetIcon}>{r.id}</span><span className={styles.subnetName}><strong>{r.name}</strong><small>SN{r.id} · {r.registered?r.service:"No service registered"}</small><span className={r.registered?styles.ready:styles.pending}>{r.registered?"Service registered":"Enabled only"}</span></span><span className={styles.amount}><strong>{number(r.minted)}</strong><small>created</small></span><span className={styles.amount}><strong>{number(r.spent)}</strong><small>used</small></span><span className={styles.expand} aria-hidden="true">+</span></summary><div className={styles.rowDetails}><h3>What can you use it for?</h3><p>{r.description}</p><h3>How you use it</h3><p>{r.workflow}</p><h3>Prices and conditions</h3><p>{r.terms}</p><p>Remaining credit: not verified. Activity can include internal tests. A registered service does not establish paying customers.</p><a href={r.source}>Provider source ↗</a><a href={`#sn${r.id}`}>Chain evidence and identities ↓</a></div></details>)}</div>{!shown.length&&<p role="status">No subnets match. Try a different name or turn off the service filter.</p>}
 </section>;
}
