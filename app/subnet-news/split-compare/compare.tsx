"use client";
import { useState } from "react";
import { compareSplits } from "../../lib/split-compare";
import styles from "./page.module.css";
type Change = { netuid: number; block: number; timestamp: number; extrinsic: number; name?: string; registeredAt?: number; before: string[]; after: string[] };
const pct = (v: number) => `${v.toFixed(2)}%`;
const difference = (v: number) => Math.abs(v) < 0.005 ? "0.00 pp" : `${v > 0 ? "+" : ""}${v.toFixed(2)} pp`;
export function SplitCompare({ weights, names, changes }: { weights: Record<string, string[]>; names: Record<string, string>; changes: Change[] }) {
  const ids = Object.keys(weights).sort((a, b) => Number(a) - Number(b));
  const [left, setLeft] = useState(ids.includes("92") ? "92" : ids[0]);
  const [right, setRight] = useState(ids.includes("118") ? "118" : ids.at(-1)!);
  const label = (id: string) => `SN${id}${names[id] ? ` · ${names[id]}` : " · Name not confirmed"}`;
  const rows = compareSplits(weights[left], weights[right]);
  return <>
    <div className={styles.controls}><label>Subnet A<select value={left} onChange={e => setLeft(e.target.value)}>{ids.map(id => <option key={id} value={id}>{label(id)}</option>)}</select></label><button type="button" onClick={() => { setLeft(right); setRight(left); }}>Swap A / B</button><label>Subnet B<select value={right} onChange={e => setRight(e.target.value)}>{ids.map(id => <option key={id} value={id}>{label(id)}</option>)}</select></label></div>
    <p role="status">Comparing {label(left)} with {label(right)}{left === right ? " · Same subnet selected." : "."}</p>
    {rows ? <div className={styles.scroll} role="region" aria-label="Emission allocation comparison" tabIndex={0}><table className={styles.table}><caption>Reviewed snapshot allocations. Difference is B minus A, in percentage points.</caption><thead><tr><th scope="col">Allocation</th><th scope="col">{label(left)}</th><th scope="col">{label(right)}</th><th scope="col">B − A</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{pct(row.left)}</td><td>{pct(row.right)}</td><td>{difference(row.difference)}</td></tr>)}</tbody></table></div> : <p>Comparable valid five-slot vectors are unavailable. Missing allocations are not treated as zero.</p>}
    <p className={styles.note}>A larger validator bucket does not establish a better staking yield. Root is paid its live baseline first, capped by that bucket; alpha validators share the remainder. Stake, performance, validator take and reward timing also matter.</p>
    <div className={styles.histories}>{[...new Set([left, right])].map(id => {
      const events = changes.filter(row => row.netuid === Number(id)).sort((a, b) => b.block - a.block);
      return <section key={id}><h2>{label(id)}</h2><h3>Verified event history for this slot</h3><p>Historical registration labels are retained below. Slot history can include a previous project.</p>{!events.length ? <p>No transaction-verified allocation changes in this archive for this slot. This does not establish an unchanged all-time history.</p> : events.map(event => <article key={`${event.block}-${event.extrinsic}`}><strong>{event.name || "Historical name not confirmed"}</strong><p>{new Date(event.timestamp).toISOString()} · block {event.block.toLocaleString("en-US")}</p>{event.registeredAt !== undefined && <p>Registration block {event.registeredAt.toLocaleString("en-US")}</p>}<dl>{compareSplits(event.before, event.after)?.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{pct(row.left)} → {pct(row.right)}</dd></div>)}</dl><a href={`https://taostats.io/extrinsic/${event.block}-${event.extrinsic}`} target="_blank" rel="noreferrer">Finalized transaction ↗</a><details><summary>Exact five-slot vectors</summary><p>Order: burn, recycle, owner, validators, miners.</p><pre>Before: {event.before.join(", ")}<br />After: {event.after.join(", ")}</pre></details></article>)}</section>;
    })}</div>
  </>;
}
