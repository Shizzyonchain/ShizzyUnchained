"use client";
import { useEffect, useState } from "react";
import { formatSalesAmount, type OwnerSales, type BurnTotal } from "./lib/owner-sales";
import styles from "./subnet-owner.module.css";
function BurnValue({value}:{value:BurnTotal}){return <><small>Burned · verified transactions</small><strong>{!value.complete&&value.burns===0?"Not fully reviewed":`${formatSalesAmount(value.alpha)} α${value.complete?"":" or more"}`}</strong><small>{value.burns} qualifying burns{!value.complete?" · partial history":""}</small></>;}
export function OwnerSalesSummary({ netuid, salesOnly = false, ownerAddress, onViewSales }: { netuid: number; salesOnly?: boolean; ownerAddress?: string; onViewSales?: () => void }) {
  const [result, setResult] = useState<OwnerSales | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [period,setPeriod]=useState<"day"|"week"|"month">("day");
  const tabs=<div className={styles.periodTabs} role="group" aria-label="Owner activity period">{([["day","24H"],["week","7D"],["month","30D"]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={period===value} onClick={()=>setPeriod(value)}>{label}</button>)}</div>;
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => fetch(`/api/subnets/owner-sales?netuid=${netuid}&v=4`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Unavailable");
      const data = await response.json() as OwnerSales;
      if (data.netuid !== netuid || (ownerAddress && data.address !== ownerAddress) || !data.day?.bought || !data.week?.bought || !data.month?.bought || !data.burns?.month || !Number.isFinite(Date.parse(data.asOf))) throw new Error("Invalid summary");
      if (!controller.signal.aborted) { setResult(data); setError(false); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    refresh(); const timer = setInterval(refresh, 300_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [netuid, attempt, ownerAddress]);
  if (salesOnly) return <section className={styles.sales} aria-label="Subnet owner alpha sales">
    <p className={styles.salesIntro}>SN{netuid} alpha sold for TAO by this owner wallet. Trades worth at least 5 TAO each.</p>
    {result && !error ? <>
      {tabs}<div className={styles.salesGrid}>{([["Last 24 hours",result.day,"day"],["Last 7 days",result.week,"week"],["Last 30 days",result.month,"month"]] as const).map(([label,total,key])=><div className={period===key?styles.activePeriod:undefined} key={label}><span>{label}</span><strong>{formatSalesAmount(total.alpha)} α sold{!result.complete?" or more":""}</strong><small>{formatSalesAmount(total.tao)} TAO received · {total.trades} sales</small>{total.trades===0&&<small>{result.complete?"No qualifying sales found":"No qualifying sales in the reviewed records"}</small>}</div>)}</div>
      <h3 className={styles.salesEvidenceHeading}>Recent sales · last 30 days</h3>
      {result.sales===undefined?<p>Individual sale evidence is temporarily unavailable.</p>:!result.sales.length?<p>No qualifying SN{netuid} alpha sales found{!result.complete?" in the reviewed records":" in this window"}.</p>:<div className={styles.saleRows}>{result.sales.map(row=><article key={row.id}><div><strong>{formatSalesAmount(row.swap!.fromAmount)} α sold</strong><small>{new Date(row.timestamp).toLocaleString("en-US",{timeZone:"UTC"})} UTC</small></div><div><strong>{formatSalesAmount(row.swap!.toAmount)} TAO received</strong><a href={`https://taostats.io/extrinsic/${row.extrinsic}`} target="_blank" rel="noopener noreferrer">View transaction ↗</a></div></article>)}</div>}
      <small>Trades through {new Date(result.asOf).toLocaleString("en-US",{timeZone:"UTC"})} UTC · latest {result.sales?.length||0} qualifying sales shown.</small>
      {!result.complete&&<p>Partial history: totals are minimums. Only the newest 2,000 indexed records per direction were reviewed.</p>}
    </>:<p role="status">{error?<>Owner sales temporarily unavailable. <button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry</button></>:"Checking owner alpha sales…"}</p>}
    <details><summary>Coverage &amp; limits</summary><p>Only SN{netuid} alpha sold for TAO by the currently verified owner coldkey. Automatic fee conversions are excluded. The 5-TAO minimum applies to each trade. Other wallets and exchange activity are not covered. A sale is not necessarily a withdrawal; its TAO may fund another subnet. This shows trading activity, not the owner’s intention or a complete change in holdings.</p></details>
  </section>;
  return <section className={styles.sales} aria-label="Owner wallet alpha activity">
    <h3>Owner wallet buys, sells & burns</h3><small>Trades ≥ 5 TAO each · transaction burns ≥ 100 α each</small>
    {result && !error ? <>
      {tabs}<div className={styles.salesGrid}>{([ ["Last 24 hours", result.day,"day"], ["Last 7 days", result.week,"week"], ["Last 30 days",result.month,"month"] ] as const).map(([label, total,key]) => <div className={period===key?styles.activePeriod:undefined} key={label}><span>{label}</span>
        <small>Bought{!result.complete ? " (at least)" : ""}</small><strong>{formatSalesAmount(total.bought.alpha)} α</strong><small>{formatSalesAmount(total.bought.tao)} TAO spent · {total.bought.trades} buys</small>
        <small>Sold{!result.complete ? " (at least)" : ""}</small><strong>{formatSalesAmount(total.alpha)} α</strong><small>{formatSalesAmount(total.tao)} TAO received · {total.trades} sales</small>
        <BurnValue value={result.burns[key]}/>
        <div className={styles.net}>{result.complete ? <><b>{BigInt(total.netAlpha) > BigInt(0) ? "Net buying" : BigInt(total.netAlpha) < BigInt(0) ? "Net selling" : "Balanced"}</b><strong>{BigInt(total.netAlpha) > BigInt(0) ? "+" : ""}{formatSalesAmount(total.netAlpha)} α</strong></> : <b>Net unavailable · partial data</b>}</div>
      </div>)}</div>
      <small>Trades through {new Date(result.asOf).toLocaleString("en-US", { timeZone: "UTC" })} UTC · {onViewSales&&<button type="button" onClick={onViewSales} aria-haspopup="dialog">View alpha sales →</button>}</small>
      <small>Burns through {new Date(result.burns.asOf).toLocaleString("en-US",{timeZone:"UTC"})} UTC · reviewed history starts {new Date(result.burns.historyStart).toLocaleDateString("en-US",{timeZone:"UTC"})}. Burn windows end at this separate verified cutoff; incomplete windows are marked partial.</small>
      {!result.complete && <p>High activity: these are partial totals from the newest 2,000 indexed records per direction.</p>}
    </> : <p role="status">{error ? <>Owner activity temporarily unavailable. <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button></> : "Loading owner activity…"}</p>}
    <details><summary>What counts?</summary><p>SN{netuid} alpha bought with or sold for TAO by the currently verified owner coldkey, counting trades worth at least 5 TAO each. Net alpha is bought minus sold; burns are shown separately and do not change the net trading figure. Burns include only successful explicit alpha burns or buyback burns attributed to this wallet in our finalized event archive, at least 100 α per event. Miner-emission burns and recycling are excluded. Earlier burn history is not fully backfilled. This is not a holdings change or profit figure. Automatic alpha fee conversions and transfers are excluded. Cross-subnet swaps may include an alpha-to-TAO leg; TAO received does not mean it was withdrawn. Indexed data can lag. Other team wallets, former owners and exchange activity are not covered.</p></details>
  </section>;
}
