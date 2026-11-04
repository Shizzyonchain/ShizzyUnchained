"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { rankValidators, type Candidate, type RankingMode } from "../lib/validator-ranking";
import { displayNumber, shortAddress } from "../lib/validator-types";
import { RecommendationLoading } from "./recommendation-loading";
import { ValidatorYieldChecks } from "./validator-yield-checks";
import { yieldCandidates, type YieldChecks } from "../lib/validator-yield-check";
import styles from "./validators.module.css";

import { limitedHistoryOptions } from "../lib/validator-current-options";

type Result = { refreshing?: boolean; preparedAt?: string; candidates: Candidate[]; collectedAt: string; netuid: number; coverage: { permitHolders: number; yieldRows: number; directoryEntries: number; hiddenChildren?: number } };
const modes: { value: RankingMode; label: string; method: string }[] = [
  { value: "balanced", label: "Balanced", method: "Yield 30% · agreement between windows 25% · participation 25% · update recency 10% · decentralization 10%." },
  { value: "yield", label: "Yield", method: "Yield 60% · agreement 20% · participation 10% · update recency 5% · decentralization 5%." },
  { value: "fees", label: "Low fees", method: "Lower take 35% · participation 20% · yield 15% · agreement 15% · decentralization 10% · update recency 5%. This preference explicitly favors lower fees." },
  { value: "decentralization", label: "Decentralization", method: "Lower subnet stake share 40% · agreement 20% · participation 20% · yield 15% · update recency 5%." },
];
const pct = (value: number | null) => value === null ? "—" : `${displayNumber(value * 100)}%`;
const evidenceTime = (value: string) => new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
function YieldValue({ row, days }: { row: Candidate; days: 7 | 30 }) {
  const value = days === 7 ? row.yield7 : row.yield30;
  const apr = days === 7 ? row.apr7 : row.apr30;
  return row.yieldBasis === "chain-net" ? <>{pct(value)} APY<small>{pct(apr ?? null)} APR</small></> : value === null ? <>—</> : <>{pct(value)} reported<small>Compounding method unconfirmed</small></>;
}

function OperatingPath({ row, compact = false }: { row: Candidate; compact?: boolean }) {
  if (row.operation !== "delegated") return <>{row.operation === "unverified" ? "Delegation not verified" : "Self-operated"}</>;
  return <div className={styles.operatingPath}><strong>Delegating parent</strong><small>Operated by:</small>{row.operators?.map(hotkey => {
    const identity = row.operatorIdentities?.find(operator => operator.hotkey === hotkey);
    return <p key={hotkey}><a href={`https://taostats.io/validators/${hotkey}`} target="_blank" rel="noreferrer">{identity?.name || shortAddress(hotkey)} ↗</a>{!compact && <small className={styles.address}>{hotkey}</small>}</p>;
  })}<small>Yield and take belong to {row.name === row.hotkey ? "this parent hotkey" : row.name}, not the operating child.</small></div>;
}

export function ValidatorFinder({ subnets }: { subnets: { netuid: number; name: string }[] }) {
  const [selection, setSelection] = useState("");
  const [mode, setMode] = useState<RankingMode>("balanced");
  const [result, setResult] = useState<Result | null>(null);
  const [yieldChecks, setYieldChecks] = useState<YieldChecks | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [request, setRequest] = useState<{ netuid: string; id: number } | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const read = async () => {
      try {
        if (document.hidden) { timer = setTimeout(read, 60000); return; }
        const response = await fetch(`/api/validators/recommendations?netuid=${request.netuid}`, { signal: controller.signal });
        const payload = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 202) {
          if (++attempts >= 24) throw new Error("This subnet is still being prepared in the background. Please try again shortly.");
          timer = setTimeout(read, 5000);
          return;
        }
        if (!response.ok) throw new Error(payload.error || "Recommendation sources unavailable.");
        setResult(payload); setNow(Date.now()); setError(""); setLoading(false);
        timer = setTimeout(read, payload.refreshing ? 5000 : 60000);
      } catch (reason) {
        if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "Recommendations unavailable."); setLoading(false); timer = setTimeout(read, 60000); }
      }
    };
    void read();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [request]);
  const yieldData = useMemo(() => yieldCandidates(result?.candidates || [], yieldChecks, result?.netuid, now), [result, yieldChecks, now]);
  const rows = useMemo(() => rankValidators(yieldData.candidates, mode, now), [yieldData, mode, now]);
  const eligible = rows.filter(row => row.score !== null);
  const limited = eligible.length ? [] : limitedHistoryOptions(rows);
  const choices = eligible.length ? eligible : limited;
  const shortlist = choices.slice(0, 3);
  const [copied, setCopied] = useState<string | null>(null);
  const picked = result ? subnets.find(s => s.netuid === result.netuid) : null;
  return <section className={styles.simpleFinder} aria-labelledby="validator-finder-title">
    <h2 id="validator-finder-title">Which subnet are you staking in?</h2>
    <form className={styles.simpleControls} onSubmit={event => { event.preventDefault(); if (!selection) return; setLoading(true); setResult(null); setYieldChecks(null); setCopied(null); setError(""); setRequest({ netuid: selection, id: Date.now() }); }}>
      <label htmlFor="validator-subnet">Choose your subnet</label>
      <div><select id="validator-subnet" required value={selection} onChange={event => setSelection(event.target.value)}><option value="">Select a subnet</option>{subnets.filter(s => s.netuid > 0).sort((a,b) => a.netuid-b.netuid).map(s => <option key={s.netuid} value={s.netuid}>SN{s.netuid} · {s.name}</option>)}</select><button type="submit" disabled={!selection || loading}>{loading ? "Checking…" : "Find my validator →"}</button></div>
    </form>
    {loading && <RecommendationLoading />}
    {error && <p className={styles.notice} role="alert">{error} {result ? "Last result remains below; freshness checks still apply." : "Try again shortly. We could not verify a current choice."}</p>}
    {result && <div aria-live="polite">
      <p className={styles.source}>SN{result.netuid} {picked?.name} {result.refreshing ? "· Refreshing in the background" : "· Source dates shown below"}</p>
      {shortlist.length > 0 && <p className={styles.source}>{shortlist.length === 3 ? "Three validator options" : `Only ${shortlist.length} ${shortlist.length === 1 ? "option meets" : "options meet"} the evidence requirements; three could not be verified.`}{limited.length > 0 ? " · Limited history" : " · Ordered by your ranking preference"}</p>}
      {shortlist.length > 0 ? shortlist.map((winner, index) => <article className={styles.primaryChoice} key={winner.hotkey} aria-label={`Validator option ${index + 1}`} >
        <p className={styles.eyebrow}>{limited.length ? "CURRENT OPTION · LIMITED HISTORY" : `OPTION ${index + 1} OF ${shortlist.length}${index === 0 ? " · TOP MATCH" : ""}`}</p>
        <h3>{winner.name === winner.hotkey ? shortAddress(winner.hotkey) : winner.name}</h3>
        <p>{limited.length ? `Active now with at least 90% participation over 7 days, but only ${pct(winner.participation30)} over 30 days. It does not meet our full recommendation standard.` : index === 0 ? "The strongest match for your preference across yield after fees, participation and current activity." : "Another qualifying option, compared using the same yield, participation and current activity checks."}</p>
        <dl className={styles.choiceFacts}><div><dt>30-day annualized yield</dt><dd><YieldValue row={winner} days={30} /></dd></div><div><dt>Validator fee</dt><dd>{pct(winner.take)}</dd></div></dl>
        <p className={styles.source}>Yield measured: <time dateTime={winner.timestamps[0]}>{evidenceTime(winner.timestamps[0])}</time>. Current activity uses separate snapshots; all required evidence must be within two hours.</p>
        {winner.operation === "delegated" && <div className={styles.choiceOperator}><OperatingPath row={winner} compact /></div>}
        <div className={styles.choiceActions}><Link href={`/validators/${winner.hotkey}`} prefetch={false}>View validator →</Link><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(winner.hotkey); setCopied(winner.hotkey); } catch { setCopied(null); } }}>{copied === winner.hotkey ? "Hotkey copied ✓" : "Copy staking hotkey"}</button></div>
        <details><summary>Staking hotkey & evidence</summary><p className={styles.address}>{winner.hotkey}</p><p>Use this parent/yield hotkey when choosing this validator. Its operating child may be different.</p><ul>{(limited.length ? winner.excluded : winner.reasons).map(reason => <li key={reason}>{reason}</li>)}</ul><p className={styles.source}>Source timestamps: {winner.timestamps.join(" · ")}</p></details>
      </article>) : <article className={styles.primaryChoice}><h3>Not enough current evidence to rank</h3><p>{rows.some(row => row.active && row.permit) ? "Active validator paths were found, but their evidence does not meet the comparison requirements below." : "A current active validator path could not be verified from the available sources."} This does not mean the subnet has no validators.</p><details open><summary>What is blocking a recommendation?</summary>{Array.from(new Set((rows.some(row => row.active && row.permit) ? rows.filter(row => row.active && row.permit) : rows).flatMap(row => row.excluded))).map(reason => <p key={reason}>{reason}</p>)}</details></article>}
      <details className={styles.simpleDetails}><summary>Ranking preferences</summary>
        <div className={styles.tabs} role="group" aria-label="Validator ranking preference">{modes.map(item => <button key={item.value} aria-pressed={mode === item.value} onClick={() => setMode(item.value)}>{item.label}</button>)}</div>
        {limited.length > 0 && <p>Limited-history options are ordered by the lower of their 7-day and 30-day reported yields, then fee. This is not the full recommendation ranking.</p>}

      </details>
      <details className={styles.simpleDetails}><summary>Data checks & excluded validators ({rows.filter(row => row.score === null).length})</summary>
        <p>Historical annualized yields are not guaranteed returns. Provider rates have an unconfirmed compounding method. Missing or stale sources never count as zero fees or good performance.</p>
        <ValidatorYieldChecks key={result.netuid} netuid={result.netuid} candidates={result.candidates} now={now} onChecks={setYieldChecks} />
        {rows.filter(row => row.score === null).map(row => <details key={row.hotkey}><summary>{row.name === row.hotkey ? shortAddress(row.hotkey) : row.name}</summary><ul>{row.excluded.map(reason => <li key={reason}>{reason}</li>)}</ul><OperatingPath row={row} /></details>)}
      </details>
    </div>}
    <p className={styles.simpleFootnote}>A data-based comparison, not a security audit. Historical yield can change.</p>
  </section>;
}
