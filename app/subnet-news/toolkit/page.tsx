import type { Metadata } from "next";
import Link from "next/link";
import { withSocialMetadata } from "../../lib/social-metadata";
import { SubnetNewsHeader } from "../subnet-news-header";
import styles from "./page.module.css";

export const metadata: Metadata = withSocialMetadata({
  title: "Bittensor Toolkit | TAO Research Tools | Shizzy Unchained",
  description: "Find the right Bittensor research tool: Gamma services, TAO returns, allocation changes, verified burns and news search.",
}, "/subnet-news/toolkit");

const groups = [
  { id: "prices", title: "Put price moves in context", description: "Start with the question, then inspect the underlying observations.", tools: [
    { href: "tao-returns", title: "TAO Returns", question: "How has TAO performed month by month?", detail: "Scan the monthly return calendar and year totals.", limit: "MEXC TAO/USDT candles. The current month is unfinished." },
  ] },
  { id: "chain", title: "Check what changed on chain", description: "Keep allocation rules, actual burns and investment performance separate.", tools: [
    { href: "gamma", title: "Gamma", question: "Which subnets accept Gamma, and for what?", detail: "Explore providers, payment flows, published terms and verified on-chain activity.", limit: "Enabled status, service listings and actual usage are reported separately." },
    { href: "etao", title: "eTAO Changes", question: "Which subnet allocation splits changed?", detail: "Review recorded five-slot allocation changes and their event evidence.", limit: "Read each archive's finalized cutoff and coverage notes. Allocations are not APY." },
    { href: "burns", title: "Transaction Burns", question: "Which qualifying token burns were verified?", detail: "Inspect recorded burn transactions, amounts and coverage.", limit: "At least 100 native tokens per individual event. Fees and recycling are excluded." },
  ] },
  { id: "follow", title: "Follow the projects you care about", description: "Come back to the evidence without starting your research from scratch.", tools: [
    { href: "search", title: "News Search", question: "Have we covered this project or development before?", detail: "Search the published news archive and follow the dated coverage.", limit: "Searches our published archive, not all of X or the wider web." },
  ] },
];

export default function ToolkitPage() {
  return <><SubnetNewsHeader /><main className={styles.page}>
    <header className={styles.hero}><p className={styles.eyebrow}>SHIZZY UNCHAINED · BITTENSOR TOOLKIT</p><h1>A better question. A clearer view.</h1><p>Five tools for understanding TAO, checking subnet changes and keeping up with the projects you follow. Choose the question you want to answer.</p>
      <nav aria-label="Toolkit categories" className={styles.categories}>{groups.map(group => <a key={group.id} href={`#${group.id}`}>{group.title} ↓</a>)}</nav>
    </header>
    {groups.map(group => <section key={group.id} id={group.id} className={styles.group} aria-labelledby={`${group.id}-title`}><header><h2 id={`${group.id}-title`}>{group.title}</h2><p>{group.description}</p></header><div className={styles.grid}>{group.tools.map(tool => <article key={tool.href} className={styles.card}><p className={styles.question}>{tool.question}</p><h3><Link href={`/subnet-news/${tool.href}`}>{tool.title} →</Link></h3><p>{tool.detail}</p><p className={styles.limit}>{tool.limit}</p></article>)}</div></section>)}
    <section className={styles.more}><h2>Keep researching</h2><p>Pair the tools with sourced daily coverage and conversations with the builders.</p><div><Link href="/subnet-news">Read the daily news →</Link><Link href="/video">Watch builder interviews →</Link><Link href="/sectors">Explore subnet sectors →</Link></div></section>
    <p className={styles.note}>Each tool explains its data source, calculation and limitations. Check the timestamp on the tool you use. Missing data is not zero, and historical results are not a promise of future returns.</p>
  </main></>;
}
