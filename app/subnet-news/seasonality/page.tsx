import type { Metadata } from "next";
import Link from "next/link";
import { withSocialMetadata } from "../../lib/social-metadata";
import { getTaoMonthlyCandles } from "../../lib/tao-monthly-source";
import { SubnetNewsHeader } from "../subnet-news-header";
import { SeasonalityExplorer } from "./explorer";
import styles from "./page.module.css";

export const revalidate = 3600;
export const metadata: Metadata = withSocialMetadata({ title: "TAO Seasonality | Historical Monthly Patterns", description: "Compare TAO calendar months by average, median and positive observations. Filter years and inspect every underlying return, with small-sample limitations.", alternates: { canonical: "/subnet-news/seasonality" } }, "/subnet-news/seasonality");

export default async function SeasonalityPage() {
  const source = await getTaoMonthlyCandles();
  return <><SubnetNewsHeader /><main className={styles.page}>
    <header><p className={styles.eyebrow}>BITTENSOR · HISTORICAL PATTERNS</p><h1>Does the month matter?</h1><p>Compare TAO’s past calendar months. Look beyond the average and see which years drive it.</p></header>
    <div className={styles.meta}><span>TAO / USDT · MEXC spot</span><span>Calendar months · UTC</span><Link href="/subnet-news/tao-returns">See the full returns heatmap →</Link></div>
    {source.fallback && <p className={styles.caution}>Live source unavailable. Using the saved snapshot from {new Date(source.asOf).toISOString()}.</p>}
    <SeasonalityExplorer candles={source.candles} asOf={source.asOf} />
    <section className={styles.notes}><h2>What these numbers mean</h2><p>Each observation is (monthly close ÷ monthly open − 1) × 100. Average is the arithmetic mean; median is the middle return, averaging the two middle values for even sample sizes. Positive months counts returns strictly above zero. Best and worst are single observed months, not possible future bounds.</p><p>The unfinished current month, future months and the first available March 2023 candle are excluded. That first candle may contain only part of a month. Missing samples stay blank, never zero. Year filters change which observations enter each calculation. No synthetic 2021 or 2022 prices are included.</p><p>These are exchange-specific TAO/USDT price returns, not USD returns or staking performance. Fees and taxes are excluded. The short history and changing market conditions make seasonal patterns unreliable as predictions.</p><p>Uses the same hourly cached <a href="https://mexcdevelop.github.io/apidocs/spot_v3_en/#kline-candlestick-data" target="_blank" rel="noreferrer">MEXC public monthly candles ↗</a> as TAO Returns. Snapshot time: {new Date(source.asOf).toISOString()}. No additional chain requests are made by this tool.</p></section>
  </main></>;
}
