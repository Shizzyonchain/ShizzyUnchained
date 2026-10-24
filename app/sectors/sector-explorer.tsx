"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import styles from "./sectors.module.css";

type Sector = { id: string; name: string; description: string };
type Subnet = { netuid: number; name: string; summary: string; sectors: string[]; source: string; basis: string; reviewNote: string; identityStatus: string };

export function SectorExplorer({ sectors, subnets }: { sectors: Sector[]; subnets: Subnet[] }) {
  const params = useSearchParams();
  const [choice, setSelected] = useState<string|null>(null);
  const requested = params.get("sector");
  const selected = choice ?? (sectors.some(s => s.id === requested) ? requested! : "all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(24);
  const results = useRef<HTMLElement>(null);
  const sector = sectors.find(item => item.id === selected);
  const pending = subnets.filter(row => !row.sectors.length).length;
  const needle = query.trim().toLowerCase();
  const matches = subnets.filter(row => (selected === "all" || selected === "review" ? selected === "all" || !row.sectors.length : row.sectors.includes(selected)) && (!needle || [`sn${row.netuid}`, String(row.netuid), row.name, row.summary, ...row.sectors.map(id => sectors.find(item => item.id === id)?.name || "")].join(" ").toLowerCase().includes(needle)));
  const select = (id: string) => { setSelected(id); setLimit(24); results.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); };
  const reset = () => { setQuery(""); select("all"); };

  return <>
    <section className={styles.filters} aria-label="Choose a sector">
      <div className={styles.filterTop}><h2>Choose a sector</h2><p>One subnet. More than one lane.</p></div>
      <div className={styles.quickFilters}>
        <button type="button" aria-pressed={selected === "all"} onClick={() => select("all")}>All subnets <b>{subnets.length}</b></button>
        <button type="button" aria-pressed={selected === "review"} onClick={() => select("review")}>Unclassified <b>{pending}</b></button>
      </div>
      <div className={styles.sectorGrid}>{sectors.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => select(item.id)}><span>{item.name}</span><b>{subnets.filter(row => row.sectors.includes(item.id)).length}</b></button>)}</div>
    </section>
    <section ref={results} className={styles.results} style={{ scrollMarginTop: 110 }} aria-labelledby="sector-results-title">
      <div className={styles.resultHeader}><div><p className={styles.eyebrow}>EXPLORE THE NETWORK</p><h2 id="sector-results-title">{sector?.name || (selected === "review" ? "Unclassified" : "All subnets")}</h2><p>{sector?.description || (selected === "review" ? "Reviewed slots whose current identity or source material does not establish a product sector." : "Browse every subnet slot, or narrow the map to what interests you.")}</p></div>
        <div className={styles.search}><label htmlFor="sector-search">Find a subnet</label><div><input id="sector-search" type="search" placeholder="Name, SN number or topic" value={query} onChange={event => { setQuery(event.target.value); setLimit(24); }} />{query && <button type="button" onClick={() => { setQuery(""); setLimit(24); }}>Clear search</button>}</div></div>
      </div>
      <p className={styles.count} role="status">{matches.length} {matches.length === 1 ? "subnet" : "subnets"} found{matches.length > limit ? ` · showing ${limit}` : ""}</p>
      {!matches.length ? <div className={styles.empty}><h3>No matches in this view</h3><p>Try another name or SN number, or reset the sector and search.</p><button type="button" onClick={reset}>Show all subnets</button></div> : <div className={styles.subnetGrid}>{matches.slice(0, limit).map(row => <article key={row.netuid} className={styles.card}>
        <div className={styles.cardHeading}><span className={styles.sn}>SN{row.netuid}</span><h3><Link href={`/charts/${row.netuid}`} prefetch={false}>{row.name}</Link></h3></div>
        <p className={styles.summary}>{row.summary}</p>
        <div className={styles.tags} aria-label={`SN${row.netuid} sector tags`}>{row.sectors.length ? row.sectors.map(id => <button type="button" key={id} onClick={() => select(id)}>{sectors.find(item => item.id === id)?.name}</button>) : <span>Unclassified · {({ unidentified: "No project identified", deprecated: "Deprecated label", parked: "Parked label", "for-sale": "Sale label", "unclear-purpose": "Purpose unclear" } as Record<string, string>)[row.identityStatus] || "Purpose unclear"}</span>}</div>
        <details className={styles.why}><summary>{row.sectors.length ? "Why these tags?" : "Review outcome"}</summary><p>{row.reviewNote}</p><p>Basis: {row.basis}.</p>{row.source && <a href={row.source} target="_blank" rel="noopener noreferrer">Project source ↗</a>}</details>
        <Link className={styles.chartLink} href={`/charts/${row.netuid}`} prefetch={false}>Chart &amp; subnet details <span aria-hidden="true">↗</span></Link>
      </article>)}</div>}
      {matches.length > limit && <button className={styles.more} type="button" onClick={() => setLimit(value => value + 24)}>Show {Math.min(24, matches.length - limit)} more subnets ↓</button>}
    </section>
  </>;
}
