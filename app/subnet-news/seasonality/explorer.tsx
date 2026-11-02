"use client";
import { useState } from "react";
import type { MonthCandle } from "../../lib/monthly-returns";
import { taoSeasonality } from "../../lib/tao-seasonality";
import styles from "./page.module.css";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pct = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
const tone = (value: number | null) => value === null || value === 0 ? undefined : value > 0 ? styles.up : styles.down;

export function SeasonalityExplorer({ candles, asOf }: { candles: MonthCandle[]; asOf: number }) {
  const years = [...new Set(candles.map(c => new Date(c.time).getUTCFullYear()))].sort((a, b) => a - b);
  const [from, setFrom] = useState(years[0]), [to, setTo] = useState(years.at(-1)!);
  const rows = taoSeasonality(candles, asOf, from, to);
  const count = rows.reduce((sum, row) => sum + row.n, 0);
  return <>
    <div className={styles.controls}>
      <label>From year<select value={from} onChange={e => { const year = Number(e.target.value); setFrom(year); if (year > to) setTo(year); }}>{years.map(year => <option key={year}>{year}</option>)}</select></label>
      <label>Through year<select value={to} onChange={e => { const year = Number(e.target.value); setTo(year); if (year < from) setFrom(year); }}>{years.map(year => <option key={year}>{year}</option>)}</select></label>
      <button type="button" onClick={() => { setFrom(years[0]); setTo(years.at(-1)!); }}>Reset range</button>
      <p role="status">{count} completed monthly observations · {from}–{to}</p>
    </div>
    <p className={styles.caution}>Small samples, not a forecast. Each month has only {Math.min(...rows.map(r => r.n))}–{Math.max(...rows.map(r => r.n))} observations in this range. One unusual year can dominate the average.</p>
    <div className={styles.scroll} role="region" aria-label="TAO seasonality table; scroll horizontally" tabIndex={0}>
      <table className={styles.table}><caption>Completed calendar-month returns in the selected years. Positive means strictly above zero.</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Samples</th><th scope="col">Average</th><th scope="col">Median</th><th scope="col">Positive months</th><th scope="col">Best</th><th scope="col">Worst</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.month}><th scope="row">{months[row.month]}</th><td>{row.n}</td><td className={tone(row.average)}>{pct(row.average)}</td><td className={tone(row.median)}>{pct(row.median)}</td><td>{row.n ? `${row.positive} / ${row.n} (${Math.round(row.positive / row.n * 100)}%)` : "—"}</td><td className={tone(row.best)}>{pct(row.best)}</td><td className={tone(row.worst)}>{pct(row.worst)}</td></tr>)}</tbody>
      </table>
    </div>
    <section className={styles.samples}><h2>Inspect the underlying years</h2><p>Open a month to see every observation used in its summary.</p>
      {rows.map(row => <details key={row.month}><summary>{months[row.month]} · {row.n} observations</summary>{row.n ? <ul>{row.samples.map(sample => <li key={sample.year}>{sample.year}<strong className={tone(sample.value)}>{pct(sample.value)}</strong></li>)}</ul> : <p>No completed full-month observations in this range.</p>}</details>)}
    </section>
  </>;
}
