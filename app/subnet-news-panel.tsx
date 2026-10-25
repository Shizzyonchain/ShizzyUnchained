"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NewsSourceLink } from "./news-source-link";
import type { SubnetTimelineEntry } from "./lib/subnet-timeline";

type History = { entries: SubnetTimelineEntry[]; total: number; nextOffset: number | null; archiveThrough: string | null };
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
function safeSource(url: string) { return /^https?:\/\//i.test(url) || /^\/subnet-news\/\d{4}-\d{2}-\d{2}$/.test(url); }
export function SubnetNewsPanel({ netuid }: { netuid: number }) {
  const [showAll,setShowAll]=useState(false);
  const [history, setHistory] = useState<History | null>(null);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/subnets/${netuid}/news?offset=${offset}`, { signal: controller.signal }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "News unavailable.");
      if (!controller.signal.aborted) setHistory(previous => ({ ...payload, entries: offset && previous ? [...previous.entries, ...payload.entries] : payload.entries }));
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [netuid, offset, retry]);
  return <section id="subnet-recent-news" tabIndex={-1} className="subnet-recent-news" aria-labelledby={`subnet-news-${netuid}`}>
    <div className="subnet-news-heading"><div><p className="eyebrow">SN{netuid} · PUBLISHED COVERAGE</p><h2 id={`subnet-news-${netuid}`}>Recent news &amp; history</h2></div><Link href="/subnet-news">All subnet news →</Link></div>
    <p className="subnet-news-context">Updates across our daily reports, newest first. Dates are report dates.{history?.archiveThrough && ` Archive through ${dateLabel(history.archiveThrough)}.`} A subnet number can be reused by a different project; each update keeps its recorded name. Registration, deregistration and ownership stories appear when covered in our reports.</p>
    {loading && <p role="status">Loading subnet news…</p>}
    {error && <p role="alert">{error} <button onClick={() => { setError(""); setLoading(true); setRetry(value => value + 1); }}>Retry news</button></p>}
    {history?.entries.length === 0 && <p>No published updates for this subnet in the archive yet.</p>}
    <div className="subnet-news-timeline">{history?.entries.slice(0,showAll?undefined:3).map(entry => <article key={entry.id}>
      <div className="subnet-news-meta"><time dateTime={entry.date}>{dateLabel(entry.date)}</time><span>{entry.kind === "archive-name" ? "Archive name change" : `SN${netuid} · ${entry.name}`}</span><span>{entry.status}</span>{entry.rating && <span aria-label={`${entry.rating} out of 5 stars`}>{"★".repeat(entry.rating)}</span>}</div>
      <h3>{entry.headline}</h3><p>{entry.summary.length > 300 ? `${entry.summary.slice(0, 300)}…` : entry.summary}</p>
      <details><summary>Read update &amp; sources</summary>{entry.summary.length > 300 && <p>{entry.summary}</p>}<div className="subnet-news-source-links">{entry.sources.filter(source => safeSource(source.url)).map(source => <NewsSourceLink key={source.url} source={source} />)}<Link href={`/subnet-news/${entry.date}`}>Read the {dateLabel(entry.date)} report →</Link></div></details>
    </article>)}</div>
    {!showAll&&history&&history.entries.length>3&&<button className="subnet-news-more" onClick={()=>setShowAll(true)}>Show {history.entries.length-3} more updates</button>}
    {(showAll||!history||history.entries.length<=3)&&history?.nextOffset !== null && history?.nextOffset !== undefined && <button className="subnet-news-more" disabled={loading} onClick={() => { setShowAll(true); setError(""); setLoading(true); setOffset(history.nextOffset!); }}>Load older updates</button>}
  </section>;
}
