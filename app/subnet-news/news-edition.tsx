import Link from "next/link";
import { NewsSourceLink } from "../news-source-link";
import { formatBriefDate, type SubnetNewsBrief } from "../lib/subnet-news";
import { rankEdition } from "../lib/news-edition";
import { NewsItem } from "./news-item";
import { SubnetNewsHeader } from "./subnet-news-header";
import { LivestreamBanner } from "../livestream-banner";
import { MembershipPromo } from "../membership-promo";
import { EditionSelect } from "./edition-select";
import { ConferenceCard } from "./conference-card";
import styles from "./news-edition.module.css";
export function NewsEdition({brief,briefs}:{brief:SubnetNewsBrief;briefs:SubnetNewsBrief[]}){
  const date=brief.date;
  const showPromotions = date >= "2026-09-07";
  const isLatestBrief = date === briefs[0]?.date;

  const updatedSubnets = brief.subnets.filter((subnet) => subnet.updates.length > 0);
  const quietSubnets = brief.subnets.filter((subnet) => subnet.updates.length === 0);
  const scoredFormat = [...brief.highlights, ...brief.ecosystem, ...updatedSubnets.flatMap((subnet) => subnet.updates)].some((item) => item.rating !== undefined);
  const rankedNews = rankEdition(brief);
  const conciseEdition = date >= "2026-10-21";
  const mainNews = conciseEdition ? rankedNews.filter(({ item }) => (item.rating ?? 0) >= 3) : rankedNews;
  const shortUpdates = conciseEdition ? rankedNews.filter(({ item }) => (item.rating ?? 0) < 3) : [];
  const lead = mainNews.find(({item})=>item.status === "verified") ?? mainNews[0] ?? rankedNews[0];
  const remaining = mainNews.filter(entry=>entry!==lead);
  const quickBriefs = shortUpdates.filter(entry=>entry!==lead);
  const editions=briefs.map(item=>({date:item.date,label:formatBriefDate(item.date)}));
  const sectionNumber = (base: number) => String(base + (brief.upcomingUnlocks.length ? 1 : 0)).padStart(2, "0");

  return (
    <main className={`news-shell news-report-shell ${styles.paper}`}>
      <SubnetNewsHeader />
      <article className={`news-report ${styles.edition}`} aria-label={`News edition ${brief.date}`}>
        <header className={styles.masthead}>
          <div className={styles.topline}>
            <div className={styles.publication}><p>Bittensor Daily News</p><span>{isLatestBrief ? "Latest edition" : "From the archive"}</span></div>
            <EditionSelect editions={editions} current={date}/>
          </div>
          <div className={styles.dateline}><time dateTime={date}>{formatBriefDate(date)}</time><span>{updatedSubnets.length} subnets with updates · {brief.subnets.length} in coverage roster</span><Link href={`/subnet-news/${date}`} prefetch={false}>Edition permalink ↗</Link>{!isLatestBrief&&<Link href="/subnet-news">Read the latest →</Link>}</div>
          {!scoredFormat && <h1 className={styles.legacyHeadline}>{brief.title}</h1>}
          {brief.correctedAt&&<p className={styles.correction}><b>Correction · </b><time dateTime={brief.correctedAt}>{new Date(brief.correctedAt).toISOString().replace("T"," ").replace(".000Z"," UTC")}</time> · {brief.correctionNote}</p>}
        </header>

        {scoredFormat ? (
          <>
          {lead&&<section className={styles.lead} aria-label="Main story"><NewsItem item={lead.item} context={lead.context} rank={rankedNews.indexOf(lead)+1} headingLevel={1}/></section>}
          {remaining.length>0&&<section className={styles.desk} aria-labelledby="more-news"><div className={styles.sectionLabel}><h2 id="more-news">Around Bittensor</h2><span>{remaining.length} more stories</span></div><div className={styles.stories}>{remaining.map(entry=><NewsItem key={JSON.stringify(entry.item)} item={entry.item} context={entry.context} rank={rankedNews.indexOf(entry)+1}/>)}</div></section>}
          {quickBriefs.length>0&&<section className={styles.briefs} aria-labelledby="quick-briefs"><div className={styles.sectionLabel}><h2 id="quick-briefs">Quick briefs &amp; watchlist</h2><span>{quickBriefs.length} updates</span></div><p className={styles.editorNote}>Smaller developments and early plans. Verification labels distinguish confirmed information from developing claims.</p><div className={styles.stories}>{quickBriefs.map(entry=><NewsItem key={JSON.stringify(entry.item)} item={entry.item} context={entry.context} rank={rankedNews.indexOf(entry)+1}/>)}</div></section>}
          <p className={styles.editorNote}>Stars indicate editorial priority, not investment quality. Routine competition updates receive at most three stars. Shizzy videos receive three; substantive non-video Shizzy coverage receives at least four. Scheduled events remain plans.</p>
          </>
        ) : brief.highlights.length > 0 && (
          <section className="news-report-section" aria-labelledby="top-signals">
            <div className="news-section-head"><span>01</span><div><p className="eyebrow">What matters first</p><h2 id="top-signals">Top signals</h2></div></div>
            <div className="news-report-grid">{brief.highlights.map((item) => <NewsItem key={item.headline} item={item} />)}</div>
          </section>
        )}

        {brief.upcomingUnlocks.length > 0 && (
          <section className="news-report-section" aria-labelledby="unlock-watch">
            <div className="news-section-head"><span>02</span><div><p className="eyebrow">Forward calendar</p><h2 id="unlock-watch">Unlock watch</h2></div></div>
            <p className="unlock-explainer">Conviction unlocks are not always one-day token cliffs. When a lock switches to decaying mode, alpha releases progressively on the chain unlock curve. Dates and amounts below show the best public schedule available and carry an explicit confidence label.</p>
            <div className="unlock-grid">
              {brief.upcomingUnlocks
                .toSorted((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
                .map((unlock) => (
                  <article className="unlock-card" key={`${unlock.netuid}-${unlock.scheduledFor}-${unlock.amountAlpha}`}>
                    <header><time dateTime={unlock.scheduledFor}>{formatBriefDate(unlock.scheduledFor)}</time><span className={`unlock-status status-${unlock.status}`}>{unlock.status}</span></header>
                    <div className="unlock-identity"><span>SN{unlock.netuid}</span><h3>{unlock.name}</h3></div>
                    <strong>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(unlock.amountAlpha)} α</strong>
                    <small>{unlock.releaseType === "conviction-decay" ? "Continuous conviction decay" : unlock.releaseType === "cliff" ? "Scheduled cliff release" : "Release mechanics unconfirmed"}</small>
                    <p>{unlock.summary}</p>
                    <div className="news-sources">{unlock.sources.map((source) => <NewsSourceLink key={source.url} source={source} />)}</div>
                  </article>
                ))}
            </div>
          </section>
        )}

        {!scoredFormat && <section className="news-report-section" aria-labelledby="subnet-desk">
          <div className="news-section-head"><span>{sectionNumber(2)}</span><div><p className="eyebrow">Organized by SN#</p><h2 id="subnet-desk">Subnet desk</h2></div></div>
          {updatedSubnets.length ? (
            <div className="subnet-news-list">
              {updatedSubnets.map((subnet) => (
                <section key={subnet.netuid} className="subnet-news-group">
                  <header><span>SN{subnet.netuid}</span><h3>{subnet.name}</h3></header>
                  <div>{subnet.updates.map((item) => <NewsItem key={item.headline} item={item} />)}</div>
                </section>
              ))}
            </div>
          ) : <p className="news-empty-copy">No subnet-specific updates met the publication threshold in this coverage window.</p>}
          {quietSubnets.length > 0 && <p className="quiet-subnets"><strong>No published update:</strong> {quietSubnets.map((subnet) => `SN${subnet.netuid}`).join(", ")}. See coverage notes for source-access gaps.</p>}
        </section>}

        {!scoredFormat && brief.ecosystem.length > 0 && (
          <section className="news-report-section" aria-labelledby="ecosystem-desk">
            <div className="news-section-head"><span>{sectionNumber(3)}</span><div><p className="eyebrow">Beyond one subnet</p><h2 id="ecosystem-desk">Ecosystem desk</h2></div></div>
            <div className="news-report-grid">{brief.ecosystem.map((item) => <NewsItem key={item.headline} item={item} />)}</div>
          </section>
        )}

        {showPromotions && isLatestBrief && <LivestreamBanner />}
        {showPromotions && <MembershipPromo />}

        <details className={styles.coverage}><summary>Sources &amp; coverage notes</summary><section className="news-report-section coverage-section" aria-labelledby="coverage-notes">
          <div className="news-section-head"><span>{sectionNumber(4)}</span><div><p className="eyebrow">Audit trail</p><h2 id="coverage-notes">Coverage notes</h2></div></div>
          <p className={styles.dek}>{brief.summary}</p>
          <p className={styles.window}>Coverage: {new Date(brief.coverageStart).toLocaleString("en-US",{timeZone:"America/New_York",dateStyle:"medium",timeStyle:"short"})} – {new Date(brief.coverageEnd).toLocaleString("en-US",{timeZone:"America/New_York",dateStyle:"medium",timeStyle:"short"})} ET</p>
          <div className="coverage-grid">
            <div><h3>Searched</h3><ul>{brief.coverage.searched.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><h3>Public-data gaps</h3>{brief.coverage.gaps.length ? <ul>{brief.coverage.gaps.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No material gaps were identified.</p>}</div>
          </div>
        </section></details>
        <details className={styles.archive}><summary>Browse all {briefs.length} editions</summary><nav aria-label="All news editions">{briefs.map(edition=><Link prefetch={false} href={`/subnet-news/${edition.date}`} key={edition.date}><time dateTime={edition.date}>{formatBriefDate(edition.date)}</time><span>{edition.title}</span></Link>)}</nav><ConferenceCard/></details>
      </article>
      <footer className="news-footer"><span>SHIZZYUNCHAINED</span><p>Information only · Not financial advice</p><b>Subnet News</b></footer>
    </main>
  );
}
