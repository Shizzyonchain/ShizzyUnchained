import type { Metadata } from "next";
import Link from "next/link";
import archive from "../../data/etao.json";
import { withSocialMetadata } from "../../lib/social-metadata";
import { SubnetNewsHeader } from "../subnet-news-header";
import { SplitCompare } from "./compare";
import styles from "./page.module.css";
export const metadata: Metadata = withSocialMetadata({ title: "Compare Bittensor Emission Splits | eTAO", description: "Compare two subnet alpha-emission allocations side by side, inspect percentage-point differences and follow verified historical changes.", alternates: { canonical: "/subnet-news/split-compare" } }, "/subnet-news/split-compare");
export default function SplitComparePage() {
  return <><SubnetNewsHeader /><main className={styles.page}><header><p className={styles.eyebrow}>BITTENSOR · ALLOCATION RESEARCH</p><h1>Where do the emissions go?</h1><p>Put two subnet splits side by side. See what owners, validators and miners receive before comparing headline yields.</p></header>
    <div className={styles.note}><strong>Reviewed snapshot, not a live feed</strong><p>Finalized block {archive.block.toLocaleString("en-US")} · chain time {new Date(archive.chainTime).toISOString()} · reviewed {archive.checkedAt}. Newer background observations may exist on the <Link href="/subnet-news/etao">eTAO page →</Link>.</p><p>Event review through block {archive.eventReview.toBlock.toLocaleString("en-US")}. {archive.eventReview.historyLimit}</p></div>
    <SplitCompare weights={archive.weights} names={archive.names} changes={archive.changes} />
    <section className={styles.note}><h2>Compare allocations, not investment quality</h2><p>All five slots divide a subnet’s alpha emissions and total 100% before display rounding. They do not describe that subnet’s network emission share, token price, revenue or APY. Differences use percentage points, not relative growth percentages. Burn/recycle allocations are separate from executed transaction burns.</p><p>Only transaction-verified changes from the permanent archive appear in the history. Pending snapshot observations are excluded. No historical state is interpolated across registration changes or missing review periods. Equal snapshots cannot rule out intervening changes that were reversed.</p><p>Historical yields may still include the prior split. Names identify the reviewed snapshot; historical events retain their recorded names and registration blocks where available.</p><a href="https://www.bittensor.com/docs/guides/etao" target="_blank" rel="noreferrer">Official eTAO methodology ↗</a></section>
  </main></>;
}
