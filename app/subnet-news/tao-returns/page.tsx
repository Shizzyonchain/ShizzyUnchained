import type { Metadata } from "next";
import Link from "next/link";
import { withSocialMetadata } from "../../lib/social-metadata";
import { monthlyReturns } from "../../lib/monthly-returns";
import { getTaoMonthlyCandles } from "../../lib/tao-monthly-source";
import { SubnetNewsHeader } from "../subnet-news-header";
import styles from "./page.module.css";

export const revalidate = 3600;
export const metadata: Metadata = withSocialMetadata({ title: "TAO Monthly Returns | Bittensor Performance Heatmap", description: "Bittensor TAO monthly and yearly price returns, with a calendar heatmap, current-month progress and historical source notes.", alternates: { canonical: "/subnet-news/tao-returns" } }, "/subnet-news/tao-returns");
const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const color = (v: number) => v > 0 ? styles.gain : v < 0 ? styles.loss : styles.zero;
const price = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 4 });

export default async function TaoReturnsPage() {
  const source = await getTaoMonthlyCandles();
  const rows = monthlyReturns(source.candles, source.asOf);
  return <><SubnetNewsHeader /><main className={styles.page}>
    <header className={styles.heading}><p className={styles.eyebrow}>BITTENSOR · PRICE HISTORY</p><h1>TAO monthly returns</h1><p>Every month at a glance. Green is a gain, red is a loss.</p></header>
    <div className={styles.meta}><span>TAO / USDT · MEXC spot</span><span>Calendar months · UTC</span><span>Updates hourly</span><Link href="/charts/tao">TAO chart ↗</Link></div>
    {source.fallback && <p className={styles.notice}>Showing the saved snapshot from {new Date(source.asOf).toLocaleString("en-US", { timeZone: "UTC" })} UTC. The live source is temporarily unavailable.</p>}
    <div className={styles.legend}><span><i className={styles.gain} /> Positive</span><span><i className={styles.loss} /> Negative</span><span><i className={styles.current} /> In progress</span><span>† Partial history</span></div>
    <div className={styles.scroll} role="region" aria-label="TAO monthly returns table; scroll horizontally for all months" tabIndex={0}>
      <table className={styles.table}><caption>TAO price returns by calendar month and year. Current periods are unfinished; † marks partial history.</caption><thead><tr><th scope="col">Year</th>{names.map(name => <th scope="col" key={name}>{name}</th>)}<th scope="col">Year / YTD</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.year}><th scope="row">{row.year}</th>{row.months.map((cell, month) => <td key={month}>{cell ? <div tabIndex={0} className={`${styles.cell} ${color(cell.value)} ${cell.current ? styles.current : ""}`} aria-label={`${names[month]} ${row.year}: ${pct(cell.value)}${cell.current ? ", month to date" : ""}${cell.partial ? ", partial history" : ""}. Open ${price(cell.open)}, latest close ${price(cell.close)} USDT.`} title={`Open ${price(cell.open)} → ${cell.current ? "Latest" : "Close"} ${price(cell.close)} USDT${cell.partial ? ". First available month; partial history." : ""}`}><strong>{pct(cell.value)}{cell.partial && <sup>†</sup>}</strong>{cell.current && <small>MTD</small>}</div> : <div className={styles.empty} aria-label={`${names[month]} ${row.year}: no data`}>—</div>}</td>)}<td><div className={`${styles.cell} ${styles.annual} ${color(row.value)} ${row.current ? styles.current : ""}`} title="Compounded price change from the first available opening price of the year, not the sum of monthly percentages."><strong>{pct(row.value)}{row.partial && <sup>†</sup>}</strong><small>{row.current ? "YTD" : row.partial ? "PARTIAL YEAR" : "FULL YEAR"}</small></div></td></tr>)}
      </tbody></table>
    </div>
    <p className={styles.hint}>Swipe the table to see every month. Hover or focus a monthly cell for its opening and closing prices.</p>
    <section className={styles.notes}><h2>How to read this</h2><p>Monthly return = (month’s closing price ÷ month’s opening price − 1) × 100. The current month uses the latest available candle price and is marked MTD. Year / YTD compares the latest closing price with that year’s first available opening price; monthly percentages are not added together.</p><p>History begins in March 2023 on this market. The first available month and year are marked † because they may not cover the full calendar period. Blank cells mean no available history or a future month, never a zero return. This is price performance in USDT, not USD, and excludes staking rewards, fees and taxes.</p><p>Source: <a href="https://mexcdevelop.github.io/apidocs/spot_v3_en/#kline-candlestick-data" target="_blank" rel="noreferrer">MEXC public monthly spot candles ↗</a>. <a href="https://www.coinglass.com/currencies/TAO/historical-data" target="_blank" rel="noreferrer">Compare TAO historical prices on CoinGlass ↗</a>. CoinGlass’s aggregate prices can differ from this exchange’s TAO/USDT candles.</p><p>Page generated {new Date(source.asOf).toLocaleString("en-US", { timeZone: "UTC", hour12: false })} UTC. Cached prices can lag by about an hour. Historical returns do not predict future performance.</p></section>
  </main></>;
}
