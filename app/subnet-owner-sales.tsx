"use client";
import { useEffect, useState } from "react";
import { formatSalesAmount, type OwnerSales, type BurnTotal } from "./lib/owner-sales";
import styles from "./subnet-owner.module.css";
function rounded(raw:string){const n=BigInt(raw),negative=n<BigInt(0),absolute=negative?-n:n;const hundredths=(absolute+BigInt(5_000_000))/BigInt(10_000_000);return `${negative?"−":""}${(hundredths/BigInt(100)).toLocaleString("en-US")}${hundredths%BigInt(100)?`.${(hundredths%BigInt(100)).toString().padStart(2,"0").replace(/0+$/,"")}`:""}`;}
function BurnValue({value}:{value:BurnTotal}){return <><span>Burned</span><strong title={`${formatSalesAmount(value.alpha)} α`}>{!value.complete&&value.burns===0?"Not fully reviewed":`${rounded(value.alpha)} α${value.complete?"":" or more"}`}</strong><small>{value.burns} qualifying burns{!value.complete?" · partial history":""}</small></>;}
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
  const total=result?.[period],burn=result?.burns[period];
  const label=period==="day"?"Last 24 hours":period==="week"?"Last 7 days":"Last 30 days";
  return <section className={`${styles.sales} ${styles.activity}`} aria-label="Owner wallet alpha activity">
    <div className={styles.activityHead}><div><h3>Owner wallet buys, sells &amp; burns</h3><small>Currently verified owner wallet · SN{netuid}</small></div>{tabs}</div>
    {result && !error && total && burn ? <>
      <div className={styles.activityCard}>
        <div className={styles.activityNet}><span>{label}</span>{result.complete?<><b className={BigInt(total.netAlpha)>BigInt(0)?styles.buying:BigInt(total.netAlpha)<BigInt(0)?styles.selling:undefined}>{BigInt(total.netAlpha)>BigInt(0)?"Net buying":BigInt(total.netAlpha)<BigInt(0)?"Net selling":"No net buying or selling"}</b><strong title={`${formatSalesAmount(total.netAlpha)} α`}>{BigInt(total.netAlpha)>BigInt(0)?"+":""}{rounded(total.netAlpha)} α</strong><small>Bought minus sold · burns shown separately</small></>:<><b>Net unavailable · partial data</b><small>Reviewed trade totals are minimums.</small></>}</div>
        <div className={styles.activityBreakdown}>
          <div><span>Bought{!result.complete?" (at least)":""}</span><strong className={styles.buying} title={`${formatSalesAmount(total.bought.alpha)} α`}>{rounded(total.bought.alpha)} α</strong><small>{total.bought.trades} buys</small></div>
          <div><span>Sold{!result.complete?" (at least)":""}</span><strong className={styles.selling} title={`${formatSalesAmount(total.alpha)} α`}>{rounded(total.alpha)} α</strong><small>{total.trades} sales</small></div>
          <div><BurnValue value={burn}/></div>
        </div>
      </div>
      <div className={styles.activityFooter}><small>Trades ≥ 5 TAO each · burns ≥ 100 α each</small>{onViewSales&&<button type="button" onClick={onViewSales} aria-haspopup="dialog">View alpha sales →</button>}</div>
      <details><summary>Exact amounts, transactions &amp; coverage</summary><dl className={styles.exactAmounts}>
        <div><dt>Bought</dt><dd>{formatSalesAmount(total.bought.alpha)} α · {formatSalesAmount(total.bought.tao)} TAO spent · {total.bought.trades} buys</dd></div>
        <div><dt>Sold</dt><dd>{formatSalesAmount(total.alpha)} α · {formatSalesAmount(total.tao)} TAO received · {total.trades} sales</dd></div>
        <div><dt>Burned</dt><dd>{formatSalesAmount(burn.alpha)} α{!burn.complete?" or more":""} · {burn.burns} qualifying burns{!burn.complete?" · partial history":""}</dd></div>
        <div><dt>Net alpha</dt><dd>{result.complete?`${BigInt(total.netAlpha)>BigInt(0)?"+":""}${formatSalesAmount(total.netAlpha)} α`:"Unavailable · partial trading history"}</dd></div>
      </dl><p>Trades through {new Date(result.asOf).toLocaleString("en-US",{timeZone:"UTC"})} UTC.</p>
      <p>Burns through {new Date(result.burns.asOf).toLocaleString("en-US",{timeZone:"UTC"})} UTC · reviewed history starts {new Date(result.burns.historyStart).toLocaleDateString("en-US",{timeZone:"UTC"})}. Burn windows end at this separate verified cutoff; incomplete windows are marked partial.</p>
      {!result.complete&&<p>High activity: these are partial totals from the newest 2,000 indexed records per direction.</p>}</details>
    </>:<p role="status">{error?<>Owner activity temporarily unavailable. <button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry</button></>:"Loading owner activity…"}</p>}
    <details><summary>What counts?</summary><p>SN{netuid} alpha bought with or sold for TAO by the currently verified owner coldkey, counting trades worth at least 5 TAO each. Net alpha is bought minus sold; burns are separate and do not change net trading. Successful explicit alpha burns and buyback burns require at least 100 α per event. Miner emissions, recycling, automatic fee conversions and transfers are excluded. Historical burn discovery uses a paginated event index with qualifying burns independently checked on-chain. This is not a holdings change or profit figure. Cross-subnet swaps may include an alpha-to-TAO leg; TAO received does not mean it was withdrawn. Indexed data can lag. Other team wallets, former owners and exchange activity are not covered. Main figures are rounded to two decimals; exact native amounts are available above.</p></details>
  </section>;
}
