import { withSocialMetadata } from "../../lib/social-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import archive from "../../data/burns.json";
import { SubnetNewsHeader } from "../subnet-news-header";
import styles from "./page.module.css";

export const metadata: Metadata = withSocialMetadata({
  title: "On-chain Burns | Shizzy Unchained",
  description: "Verified Bittensor alpha burns, buyback burns and voluntary TAO burns, with finalized transaction evidence. Miner emissions excluded.",
  alternates: { canonical: "/subnet-news/burns" },
}, "/subnet-news/burns");
const units = (raw: string) => {
  const amount = BigInt(raw);
  const fraction = (amount % BigInt(1_000_000_000)).toString().padStart(9, "0").replace(/0+$/, "");
  return (amount / BigInt(1_000_000_000)).toLocaleString("en-US") + (fraction ? `.${fraction}` : "");
};
const utc = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "UTC", hour12: false }) + " UTC";
const short = (address: string) => `${address.slice(0, 7)}…${address.slice(-7)}`;

export default async function BurnsPage({ searchParams }: { searchParams: Promise<{ subnet?: string; date?: string; page?: string }> }) {
  const filters = await searchParams;
  const reportable = archive.transactions.filter(row => BigInt(row.amountRaw) >= BigInt("100000000000"));
  const rows = reportable.filter(row => (!filters.subnet || String(row.netuid ?? "tao") === filters.subnet) && (!filters.date || row.timestamp.slice(0, 10) === filters.date));
  const pageCount = Math.max(1, Math.ceil(rows.length / 25));
  const requestedPage = Number(filters.page || 1);
  const page = Number.isInteger(requestedPage) ? Math.max(1, Math.min(pageCount, requestedPage)) : 1;
  const visibleRows = [...rows].sort((a,b) => b.block - a.block || b.eventIndex - a.eventIndex).slice((page - 1) * 25, page * 25);
  const pageLink = (target: number) => {
    const query = new URLSearchParams();
    if (filters.subnet) query.set("subnet", filters.subnet);
    if (filters.date) query.set("date", filters.date);
    query.set("page", String(target));
    return `/subnet-news/burns?${query}`;
  };
  const groups = new Map<string, { label: string; amount: bigint; count: number }>();
  for (const row of rows) {
    const key = row.netuid === null ? "tao" : String(row.netuid);
    const current = groups.get(key) || { label: row.netuid === null ? "TAO" : `SN${row.netuid} ${row.name}`, amount: BigInt(0), count: 0 };
    current.amount += BigInt(row.amountRaw); current.count++; groups.set(key, current);
  }
  const subnetOptions = [...new Map(reportable.filter(row => row.netuid !== null).map(row => [row.netuid, row.name])).entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  const days = [...new Set(reportable.map(row => row.timestamp.slice(0, 10)))].sort().reverse();
  return <main className="news-shell"><SubnetNewsHeader /><div className={styles.page}>
    <p className={styles.eyebrow}>FINALIZED TRANSACTIONS · DAILY REVIEW</p>
    <h1>On-chain burns</h1><p className={styles.intro}>Follow tokens deliberately burned on Bittensor. Every entry has a finalized transaction behind it.</p>
    <div className={styles.scope}><strong>Minimum 100 tokens per burn</strong><p>Only individual burns of at least 100 alpha, or 100 TAO for TAO burns, are shown. Totals include qualifying transactions only. Miner emissions and recycling are excluded. Buyback totals show alpha burned; TAO spent is listed separately.</p></div>
    <details className={styles.coverage}><summary>Chain coverage · through block {archive.toBlock.toLocaleString("en-US")}</summary><p>Reviewed {utc(archive.checkedAt)}. Full-block scan {archive.fromBlock.toLocaleString("en-US")}–{archive.toBlock.toLocaleString("en-US")}, inclusive · {archive.source} · runtime {archive.runtime}.</p><p>{archive.coverageNote}</p><p>History starts {utc(archive.historyStart)}. This is a daily reviewed archive, not a live feed or an all-time burn total.</p></details>
    <form className={styles.filters} action="/subnet-news/burns"><label>Subnet<select name="subnet" defaultValue={filters.subnet || ""}><option value="">All subnets and TAO</option><option value="tao">TAO only</option>{subnetOptions.map(([netuid, name]) => <option key={netuid} value={String(netuid)}>SN{netuid} {name}</option>)}</select></label><label>UTC day<select name="date" defaultValue={filters.date || ""}><option value="">All reviewed days</option>{days.map(day => <option key={day} value={day}>{day}</option>)}</select></label><button type="submit">Apply filters</button><Link href="/subnet-news/burns">Reset</Link></form>
    <section><h2>{rows.length.toLocaleString("en-US")} verified burn events</h2><p>Amounts stay in their own token. Different subnets’ alpha is never added together.</p><div className={styles.totals}>{[...groups.entries()].map(([key, group]) => <article key={key}><h3>{group.label}</h3><strong>{units(String(group.amount))} {key === "tao" ? "TAO" : "α"}</strong><p>{group.count} burn events in this selection</p></article>)}</div></section>
    <section aria-label="Burn transaction history"><h2>Transaction history</h2>{!rows.length ? <p>No burns of at least 100 tokens match these filters. This does not describe unreviewed history.</p> : <div className={styles.history}>{visibleRows.map(row => <article key={row.id} className={styles.transaction}><div><p className={styles.kind}>{row.kind === "buyback" ? "BUYBACK + ALPHA BURN" : row.netuid === null ? "TAO BALANCE BURN" : "DIRECT ALPHA BURN"}</p><h3>{row.netuid === null ? "TAO" : `SN${row.netuid} ${row.name}`}</h3><strong className={styles.amount}>{units(row.amountRaw)} {row.netuid === null ? "TAO" : "α"} burned</strong>{row.taoSpentRaw !== null && <p>{units(row.taoSpentRaw)} TAO spent on buyback · not TAO burned</p>}<time dateTime={row.timestamp}>{utc(row.timestamp)}</time></div><div className={styles.evidence}><a href={`https://taostats.io/extrinsic/${row.block}-${row.extrinsic}`} target="_blank" rel="noreferrer">View transaction ↗</a><details><summary>Chain evidence</summary><dl><dt>Block</dt><dd>{row.block.toLocaleString("en-US")}</dd><dt>Event</dt><dd>{row.eventIndex} · {row.eventName}</dd><dt>Account</dt><dd><a href={`https://taostats.io/account/${row.account}`} target="_blank" rel="noreferrer" title={row.account}>{short(row.account)} ↗</a></dd><dt>Block hash</dt><dd>{row.hash}</dd><dt>Execution</dt><dd>Finalized · successful</dd></dl></details></div></article>)}</div>}<nav className={styles.pagination} aria-label="Burn history pages">{page > 1 && <Link href={pageLink(page - 1)}>← Newer</Link>}<span>Page {page} of {pageCount}</span>{page < pageCount && <Link href={pageLink(page + 1)}>Older →</Link>}</nav></section>
    <section className={styles.coverage}><h2>How to read this</h2><p>A direct alpha burn removes held alpha. A buyback burn uses TAO to acquire alpha and then burns it; the TAO remains in the subnet pool. A voluntary TAO balance burn reduces TAO issuance. None of these guarantees a price increase.</p><p>Registration recycling, token transfers, fees, announced buybacks and miner-emission allocations are not counted as executed transaction burns. Cumulative burn-counter changes alone are not sufficient evidence.</p><a href="https://www.bittensor.com/code/pallets/subtensor/src/staking/recycle_alpha.rs" target="_blank" rel="noreferrer">Burn and recycling implementation ↗</a></section>
  </div></main>;
}
