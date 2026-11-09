"use client";
import { useState } from "react";
import styles from "./page.module.css";
const pct = (value: string) => `${(Number(value) / 18446744073709551615 * 100).toFixed(2)}%`;
export function EmissionDirectory({ weights, names }: { weights: Record<string,string[]>; names: Record<string,string> }) {
  const [search,setSearch] = useState("");
  const rows = Object.entries(weights).sort((a,b)=>Number(a[0])-Number(b[0])).filter(([id])=>`SN${id} ${names[id] || ""}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <><label className={styles.search}>Find a subnet<input type="search" placeholder="Subnet number or verified name" value={search} onChange={event=>setSearch(event.target.value)} /></label><p role="status">{rows.length} subnets shown. Names are shown where confirmed in this audit; an omitted name does not mean the subnet is unnamed.</p><div className={styles.directory}>{rows.map(([id,w])=><article key={id}><h3>SN{id}{names[id] ? ` · ${names[id]}` : ""}</h3><dl>{["Burn","Recycle","Owner","Validators","Miners"].map((label,i)=><div key={label}><dt>{label}</dt><dd>{pct(w[i])}</dd></div>)}</dl></article>)}</div></>;
}
