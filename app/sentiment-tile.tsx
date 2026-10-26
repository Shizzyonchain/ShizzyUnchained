"use client";

import { snapshotIsFresh, marketSnapshotHealth } from "./lib/market-snapshot";
import { useEffect, useMemo, useRef, useState } from "react";
import { assessTaoSentiment, sentimentLabel, type SentimentRow } from "./lib/tao-sentiment";
import styles from "./sentiment-tile.module.css";

export function SentimentTile({ rows, state, initialNow=0 }: { rows: SentimentRow[]; state: "loading" | "live" | "stale" | "error"; initialNow?:number }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);
  const [period, setPeriod] = useState<"1h" | "24h">("1h");
  const readings = useMemo(() => ({ "1h": assessTaoSentiment(rows, "1h", now), "24h": assessTaoSentiment(rows, "24h", now) }), [rows, now]);
  const assessment = readings[period];
  const reading = assessment.reading;
  const dialog = useRef<HTMLDialogElement>(null);
  const score = state !== "loading" && marketSnapshotHealth(rows, now).complete && reading && snapshotIsFresh(reading.updatedAt, now) ? reading.score : undefined;
  const label = score === undefined ? state === "stale" ? "Data delayed" : state === "loading" ? "Calculating…" : "Unavailable" : sentimentLabel(score);
  const tone = score === undefined ? "unavailable" : score < 45 ? "fear" : score > 55 ? "greed" : "neutral";
  return <div className={`sentiment-tile ${tone} ${styles.tile}`}>
    <div className={styles.periods} role="group" aria-label="Fear and Greed period">
      {(["1h", "24h"] as const).map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>{value.toUpperCase()}</button>)}
    </div>
    <button type="button" className="sentiment-trigger" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog" aria-label={`Subnet Fear & Greed, ${period}: ${score === undefined ? label : `${score} out of 100, ${label}`}. How this is calculated`}>
      <span className="sentiment-caption">Subnet Fear &amp; Greed <span aria-hidden="true">ⓘ</span></span>
      <span className="sentiment-reading"><strong>{score ?? "—"}<span className="sentiment-denominator">/100</span></strong><span className="sentiment-label">{label}</span></span>
      <span className="sentiment-track" aria-hidden="true">{score !== undefined && <span style={{ left: `${score}%` }} />}</span>
    </button>
    <dialog ref={dialog} className={`sentiment-dialog ${styles.modal}`} aria-labelledby="sentiment-heading" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="sentiment-dialog-head"><div><span className={styles.eyebrow}>Market conditions · Experimental</span><h2 id="sentiment-heading">Subnet Fear &amp; Greed</h2></div><button type="button" onClick={() => dialog.current?.close()} aria-label="Close sentiment explanation">✕</button></div>
      <p className={styles.intro}>A snapshot of subnet markets measured against TAO. This is not an index of TAO’s dollar price.</p>
      <div className={styles.summary}>
        <div className={styles.scoreLine}><strong>{score ?? "—"}<small>/100</small></strong><div><b>{label}</b><span>Rolling {period === "24h" ? "24 hours" : "1 hour"}</span></div></div>
        <div className="sentiment-track" aria-hidden="true">{score !== undefined && <span style={{ left: `${score}%` }} />}</div>
        <div className={styles.scale} aria-hidden="true"><span>Fear</span><span>Neutral</span><span>Greed</span></div>
      </div>
      {score === undefined && <p role="status">{assessment.reason || "Waiting for a fresh market snapshot."}</p>}
      <h3 className={styles.sectionTitle}>What goes into the score</h3>
      <div className={styles.factors}>
        {[['Breadth', '35%', 'How many subnets are rising.'], ['Momentum', '25%', 'The median subnet price move.'], ['Liquidity', '25%', 'Changes in pool TAO reserves.'], ['Directional volume', '15%', 'Activity behind the price move.']].map(([name, weight, description]) => <div key={name}><div><b>{name}</b><span>{weight}</span></div><p>{description}</p></div>)}
      </div>
      <details className={styles.method}><summary>Calculation &amp; data quality</summary>
        <p>All inputs use the selected rolling period and alpha/TAO prices. Switching USD/TAO does not change the reading. Both periods use the existing market feed; opening this panel makes no extra data request.</p>
        <ul><li><b>Breadth:</b> share of subnets rising; unchanged counts half.</li><li><b>Momentum:</b> median return; −5% to +5% maps to 0–100.</li><li><b>Liquidity:</b> median TAO-reserve change, using the same −5% to +5% scale.</li><li><b>Directional volume:</b> compares activity with the preceding equal-length period and reinforces the observed price direction. Quiet trading stays neutral. The 24H comparison requires 48 hours of history.</li></ul>
        <p>0–24 Extreme fear · 25–44 Fear · 45–55 Neutral · 56–75 Greed · 76–100 Extreme greed.</p>
        <p>Requires fresh price, liquidity and current-volume observations for at least 80% of the roster (minimum 32 subnets). A zero-trade period contributes no directional activity and does not need a volume ratio. Directional volume separately requires comparisons covering at least 80% of observed trading volume in those fresh subnets. Missing comparisons are excluded from that component only; valid price and liquidity data still count. Rows more than three minutes old or over a minute in the future are excluded. No current score is shown without enough fresh, complete inputs.</p>
      </details>
      <div className={styles.footer}><span>{reading ? `${reading.count} of ${reading.total} subnets · fresh price/liquidity · ${(reading.volumeCoverage * 100).toFixed(1)}% volume comparison coverage` : assessment.reason}</span><span>{reading ? `Snapshot ${new Date(reading.updatedAt).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}` : "No reliable snapshot available"}</span></div>
      <p className={styles.disclaimer}>Our experimental indicator, not a survey of emotions or an official index. Not a trading recommendation.</p>
    </dialog>
  </div>;
}
