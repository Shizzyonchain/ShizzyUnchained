import type { Metadata } from "next";
import Link from "next/link";
import { getSubnetNewsBriefs } from "../../lib/subnet-news";
import { indexNews, searchNews } from "../../lib/news-search";
import { withSocialMetadata } from "../../lib/social-metadata";
import { NewsSourceLink } from "../../news-source-link";
import { SubnetNewsHeader } from "../subnet-news-header";
import styles from "./page.module.css";
export const metadata: Metadata = withSocialMetadata({ title: "Search Bittensor News Archive | Shizzy Unchained", description: "Find past Bittensor stories by subnet, keyword, edition date, verification status and editorial rating, with original sources.", alternates: { canonical: "/subnet-news/search" } }, "/subnet-news/search");
type Params = { q?: string; subnet?: string; status?: string; minimum?: string; from?: string; to?: string; page?: string };
export default async function NewsSearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const input = await searchParams;
  const query = typeof input.q === "string" ? input.q.slice(0, 200) : "";
  const subnet = /^(?:[1-9]\d{0,4}|ecosystem)$/.test(input.subnet || "") ? input.subnet! : "";
  const status = ["verified", "developing", "rumor"].includes(input.status || "") ? input.status! : "";
  const minimum = /^[1-5]$/.test(input.minimum || "") ? Number(input.minimum) : 0;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(input.from || "") ? input.from! : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(input.to || "") ? input.to! : "";
  const reports = getSubnetNewsBriefs(), index = indexNews(reports);
  const matches = searchNews(index, { query, subnet, status, minimum, from, to });
  const pages = Math.max(1, Math.ceil(matches.length / 20));
  const requested = Number(input.page || 1), page = Number.isSafeInteger(requested) ? Math.min(pages, Math.max(1, requested)) : 1;
  const link = (target: number) => { const params = new URLSearchParams(); for (const [key, value] of Object.entries({ q: query, subnet, status, minimum: minimum ? String(minimum) : "", from, to, page: String(target) })) if (value) params.set(key, value); return `/subnet-news/search?${params}`; };
  const subnets = [...new Set(index.flatMap(row => row.netuid === null ? [] : [row.netuid]))].sort((a, b) => a - b);
  return <><SubnetNewsHeader /><main className={styles.page}><header><p className={styles.eyebrow}>BITTENSOR · THE NEWS ARCHIVE</p><h1>Find the story.</h1><p>Search {reports.length} dated editions without scrolling through them one by one.</p></header>
    <form action="/subnet-news/search" className={styles.filters}><label className={styles.query}>Keywords<input type="search" name="q" maxLength={200} defaultValue={query} placeholder="Project, model, launch or incident" /></label><label>Subnet<select name="subnet" defaultValue={subnet}><option value="">All subnets & ecosystem</option><option value="ecosystem">Ecosystem & highlights</option>{subnets.map(id => <option key={id} value={id}>SN{id}</option>)}</select></label><label>Verification<select name="status" defaultValue={status}><option value="">Any status</option><option value="verified">Verified</option><option value="developing">Developing</option><option value="rumor">Rumor</option></select></label><label>Minimum rating<select name="minimum" defaultValue={minimum || ""}><option value="">Any rating</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+ stars</option>)}</select></label><label>From edition<input type="date" name="from" defaultValue={from} /></label><label>Through edition<input type="date" name="to" defaultValue={to} /></label><button type="submit">Search archive</button><Link href="/subnet-news/search">Reset filters</Link></form>
    <p className={styles.note}>Dates and verification labels belong to the original edition. A past verified announcement can now be outdated. Historical project names are retained; an SN filter searches the slot across registrations. All keywords must match the story text or subnet label. Ratings describe editorial priority, not investment quality.</p>
    <h2>{matches.length.toLocaleString("en-US")} matching stories</h2>{from && to && from > to && <p>The starting edition date is after the ending date. Adjust the range.</p>}
    {!matches.length ? <p>No stories match these filters. Try fewer keywords, another date range or any verification status.</p> : <div className={styles.results}>{matches.slice((page - 1) * 20, page * 20).map(row => <article key={row.key}><div className={styles.meta}><Link href={`/subnet-news/${row.date}`}>{row.date} edition →</Link><span>{row.netuid === null ? row.name : `SN${row.netuid} · ${row.name}`}</span><span>{row.item.status}</span><span>{row.item.rating ? `${row.item.rating} / 5 stars` : "Not rated"}</span></div><h3>{row.item.headline}</h3><p>{row.item.summary}</p>{row.item.ratingReason && <p className={styles.reason}>{row.item.ratingReason}</p>}<div className={styles.sources}>{row.item.sources.map(source => <NewsSourceLink key={source.url} source={source} />)}</div></article>)}</div>}
    <nav className={styles.pagination} aria-label="Search results pages">{page > 1 && <Link href={link(page - 1)}>← Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={link(page + 1)}>Next →</Link>}</nav><p className={styles.note}>Searches published headlines and summaries, not private bookmarks, unpublished leads or source-page contents. Duplicate headlines within an edition appear once; separate editions remain separate so follow-ups are preserved. Share the page URL to retain your filters.</p>
  </main></>;
}
