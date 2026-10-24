import { Suspense } from "react";
import data from "../data/sectors.json";
import { SiteHeader } from "../site-header";
import { withSocialMetadata } from "../lib/social-metadata";
import { SectorExplorer } from "./sector-explorer";
import styles from "./sectors.module.css";

export const metadata = withSocialMetadata({ title: "Bittensor Subnet Sectors | ShizzyUnchained", description: "Explore all 128 Bittensor subnet slots by sector: robotics, inference, security, compute, science and more. Multi-sector tags, project descriptions and subnet charts." }, "/sectors");

export default function SectorsPage() {
  const pending = data.subnets.filter(row => !row.sectors.length).length;
  const reviewedDate = new Date(data.reviewedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  return <div className={styles.page}>
    <SiteHeader hideCurrency />
    <main className={styles.main}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>THE BITTENSOR SECTOR MAP</p>
        <h1>Find your corner<br />of <span>Bittensor.</span></h1>
        <p className={styles.lead}>Robotics. Inference. Security. See who’s building what—and where the sectors overlap.</p>
        <div className={styles.stats}><span><b>128</b> subnet slots</span><span><b>{data.sectors.length}</b> sectors</span><span><b>{pending}</b> unclassified</span></div>
      </header>
      <Suspense fallback={<p>Loading sector map…</p>}><SectorExplorer sectors={data.sectors} subnets={data.subnets} /></Suspense>
      <section className={styles.method} aria-labelledby="sector-method">
        <h2 id="sector-method">How the map works</h2>
        <p>Tags describe a project’s stated work. A subnet can belong to several sectors, so sector counts overlap. They are editorial classifications—not rankings, proof of adoption or confirmation that every announced product is live.</p>
        <p>Reviewed <time dateTime={data.reviewedAt}>{reviewedDate}</time> using owner-submitted on-chain metadata at block {data.sourceBlock.toLocaleString("en-US")} and linked project repositories. All 128 slots were reviewed. Unnamed, deprecated, parked, sale and unclear identities remain visible under <strong>Unclassified</strong> when no product sector can be established. A subnet number can be reused; classifications need review when ownership, identity or purpose changes.</p>
        <a href={data.evidenceUrl} target="_blank" rel="noreferrer">View the dated metadata and source record ↗</a>
      </section>
    </main>
  </div>;
}
