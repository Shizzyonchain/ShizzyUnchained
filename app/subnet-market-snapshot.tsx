"use client";
import Image from "next/image";
import type { ReactNode } from "react";
import type { ScreenerRow } from "./dashboard";
import { formatSalesAmount } from "./lib/owner-sales";
import { SubnetYield } from "./subnet-yield";
import { useOwners } from "./lib/owner-data";
import { holdingForOwner } from "./lib/owner-holdings";
import { ALPHA_CAP, marketRank, nonnegative, snapshotNumbers } from "./lib/subnet-snapshot";
import { liquidationExplanation, liquidationPercent } from "./lib/liquidation";
import styles from "./subnet-market-snapshot.module.css";

const rawUnits=(value:string|undefined)=>value&&/^\d+$/.test(value)?nonnegative(Number(BigInt(value))/1e9):null;
const compact=(value:number|null)=>value===null?"—":value.toLocaleString("en-US",{notation:value>=1e6?"compact":"standard",maximumFractionDigits:value>=1e6?2:2});
const stamp=(value:string|undefined)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString("en-US",{timeZone:"UTC",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})+" UTC":"Unavailable";
function Fact({label,help,children,className=""}:{label:string;help?:string;children:ReactNode;className?:string}){
  return <div className={`${styles.fact} ${className}`}><dt>{help?<details className={styles.help}><summary>{label}</summary><p>{help}</p></details>:label}</dt><dd>{children}</dd></div>;
}
export function SubnetMarketSnapshot({row,rows,currency,taoUsd,delayed,now}:{row:ScreenerRow|undefined;rows:ScreenerRow[];currency:"usd"|"tao";taoUsd:number;delayed:boolean;now:number}){
  const {snapshot,error}=useOwners();
  if(!row)return <section id="subnet-market-snapshot" className={styles.card}><h2>Market snapshot</h2><p>Market data unavailable.</p></section>;
  const rank=marketRank(rows,row.netuid),numbers=snapshotNumbers(row),price=nonnegative(row.price_tao);
  const holding=holdingForOwner(snapshot?.holdings,row.netuid,snapshot?.owners[String(row.netuid)],now);
  const ownerAlpha=rawUnits(holding?.ownerEmissionPerDayRaw),ownerValue=price!==null&&ownerAlpha!==null?price*ownerAlpha:null;
  const lockedOwner=rawUnits(holding?.lockedAlphaRaw),lockedTotal=nonnegative(row.conviction_locked_alpha);
  const burnSnapshot=snapshot?.burns,burnTime=Date.parse(burnSnapshot?.asOf||"");
  const burn=Number.isFinite(burnTime)&&burnTime<=now+60_000?burnSnapshot?.subnets[String(row.netuid)]:undefined;
  const burned=rawUnits(burn?.alphaRaw),cap=nonnegative(row.market_cap_tao),reserve=nonnegative(row.tao_reserve);
  const money=(value:number|null,unit:"usd"|"tao"=currency,precise=false)=>{
    const n=value===null?null:unit==="usd"?(taoUsd>0?value*taoUsd:null):value;
    return n===null||!Number.isFinite(n)?"—":(unit==="usd"?"$":"τ")+n.toLocaleString("en-US",{notation:!precise&&n>=1e6?"compact":"standard",maximumFractionDigits:precise?(unit==="tao"?6:4):2});
  };
  const dual=(value:number|null,precise=false)=><>{money(value,currency,precise)}<small>{money(value,currency==="usd"?"tao":"usd",precise)}</small></>;
  const tone=(value:unknown)=>Number(value)>0?styles.up:Number(value)<0?styles.down:"";
  const payout=nonnegative(row.liquidation_price_tao);
  return <section id="subnet-market-snapshot" tabIndex={-1} className={styles.card} aria-label="Subnet market information">
    <div className={styles.heading}><h2>Market snapshot</h2><span>{delayed?"Delayed market feed":"Market feed"} · USD / TAO</span></div>
    <div className={styles.identity}>
      {row.logo_url&&/^https:\/\//.test(row.logo_url)?<Image src={row.logo_url} alt="" width={44} height={44} unoptimized className={styles.logo}/>:<span className={styles.badge}>SN{row.netuid}</span>}
      <div><h3>{row.name||"Unknown"} <span>SN{row.netuid}</span></h3>{row.description&&<p>{row.description}</p>}</div>
    </div>
    <dl className={styles.top}>
      <Fact label="Rank" help="Rank by market capitalization in TAO across available subnet rows. Ties share a rank. Missing market caps are excluded; this is not emission rank."><span className={styles.accent}>{rank?`#${rank.rank}`:"—"}</span><small>{rank?`of ${rank.count} priced subnets`:"Market cap unavailable"}</small></Fact>
      <Fact label="Market cap" help="Current alpha price multiplied by the circulating supply used by the shared market feed. This differs from pool plus outstanding alpha.">{dual(cap)}</Fact>
      <Fact label="FDV" help={`Hypothetical current spot price × the nominal ${ALPHA_CAP.toLocaleString("en-US")} alpha protocol cap. Not an exit quote, forecast or circulating market cap.`}>{dual(numbers.fdv)}</Fact>
      <Fact label="Dereg. payout" help={liquidationExplanation}>{dual(payout,true)}</Fact>
    </dl>
    <dl className={styles.activity}>
      <Fact label="Owner / day · est." help="Daily-rate estimate: finalized SubnetAlphaOutEmission × owner eTAO slot / u64::MAX × 7,200 assumed 12-second blocks. Valued at the current market quote. Not business revenue, actual last-24-hour receipts or a guaranteed payout; rates and prices can change.">{dual(ownerValue)}<small>{ownerAlpha===null?(error?"Daily data unavailable":"Awaiting daily data"):`${compact(ownerAlpha)} α / day`}</small></Fact>
      <Fact label="Volume · 24h">{dual(nonnegative(row.volume_24h_tao))}</Fact>
      <Fact label="Emission share" help="Share of network emissions, not business revenue. Color shows the 24-hour change in emission-share percentage points."><span className={tone(row.emission_change_24h)}>{row.emission_pct==null?"—":`${Number(row.emission_pct).toLocaleString("en-US",{maximumFractionDigits:4})}%`}</span><small>of network emissions</small></Fact>
      <Fact label="Staker APY · est."><SubnetYield row={row} now={now}/><small>Subnet-wide estimate</small></Fact>
    </dl>
    <dl className={styles.bottom}>
      <Fact label="Current alpha supply" help="SubnetAlphaIn + SubnetAlphaOut from the same market row: pool reserves plus outstanding alpha. Not circulating supply or the lifetime issuance counter (which can include burned amounts). The value below is a spot valuation.">{compact(numbers.supply)} α<small>{money(numbers.supply!==null&&price!==null?numbers.supply*price:null)} · spot value</small></Fact>
      <Fact label="Pool liquidity" help="TAO held in the subnet pool, valued in USD and TAO. This is the TAO side only, not two-sided TVL or an amount you can sell without slippage.">{dual(reserve)}</Fact>
      <Fact label="Verified burns · 30D" help="All wallets on this subnet, rolling 30 days ending at the separate burn-review cutoff below. Only independently qualifying events ≥100 alpha each. Excludes miner emission withholding, fees and recycling. Not lifetime burns. Partial history is a lower bound.">{burn&&!burn.complete&&burned!==null?"≥ ":""}{burned===null?"—":compact(burned)} α<small>{burn?`${burn.events} events${burn.complete?"":" · partial history"}`:"Review unavailable"}</small></Fact>
      <Fact label="Locked alpha" help="Total is the market feed’s locked alpha; Owner is the currently verified coldkey’s locked stake from the separate dated daily snapshot. Other team wallets are excluded. Different source times are shown below."><span className={styles.lock}><span>Total</span><b>{compact(lockedTotal)} α</b></span><span className={styles.lock}><span>Owner</span><b>{compact(lockedOwner)} α</b></span></Fact>
    </dl>
    <div className={styles.price}><strong>{money(price,currency,true)}</strong><span>{money(price,currency==="usd"?"tao":"usd",true)}</span><span className={tone(row.change_24h)}>{row.change_24h==null?"—":`${Number(row.change_24h)>0?"+":""}${Number(row.change_24h).toFixed(2)}%`} <small>24H · {currency.toUpperCase()}</small></span></div>
    <div className={styles.returns}>{[["10 minutes",row.change_10m],["1 hour",row.change_1h],["24 hours",row.change_24h],["7 days",row.change_7d]].map(([label,value])=><div key={label}><span>{label}</span><strong className={tone(value)}>{value==null?"—":`${Number(value)>0?"+":""}${Number(value).toFixed(2)}%`}</strong></div>)}</div>
    <details className={styles.details}><summary>More metrics &amp; staking basis</summary><dl className={styles.extra}>
      <Fact label="Circulating alpha">{compact(nonnegative(row.circulating_alpha))} α</Fact>
      <Fact label="Staked / outstanding alpha">{compact(nonnegative(row.alpha_out))} α<small>SubnetAlphaOut</small></Fact>
      <Fact label="Payout vs market price">{liquidationPercent(row.liquidation_diff_pct)}<small>only on deregistration</small></Fact>
      <Fact label="Liquidity flow · 24h">{row.liquidity_change_24h==null?"—":`${Number(row.liquidity_change_24h).toFixed(2)}%`}<small>TAO reserve change</small></Fact>
      <Fact label="Locked / outstanding">{row.conviction_locked_pct==null?"—":`${Number(row.conviction_locked_pct).toFixed(2)}%`}</Fact>
      <Fact label="Estimated staker APY"><SubnetYield row={row} now={now} detail/></Fact>
    </dl></details>
    <details className={styles.details}><summary>Sources, calculations &amp; exact amounts</summary>
      <p>Market: {stamp(row.time)}. USD conversion uses the shared TAO/USD quote. Price changes use rolling periods in the selected currency. Missing values stay unavailable; opening this card makes no chain RPC calls.</p>
      <p>Owner emission rate and locks: {stamp(holding?.asOf)}{holding?.overdue?" · daily update overdue":""}. {holding&&<>Finalized block {holding.block.toLocaleString("en-US")}. <a href={holding.evidence} target="_blank" rel="noreferrer">Snapshot evidence ↗</a></>}</p>
      <p>Burns: through {stamp(burnSnapshot?.asOf)}; reviewed history starts {stamp(burnSnapshot?.historyStart)}. {burned!==null&&<>Exact reviewed 30D total: {formatSalesAmount(burn!.alphaRaw)} α. </>}<a href={`/subnet-news/burns?subnet=${row.netuid}`}>Transactions &amp; coverage ↗</a></p>
      <p>Owner/day: {holding?.ownerEmissionPerDayRaw?`${formatSalesAmount(holding.ownerEmissionPerDayRaw)} α/day`:"Unavailable"}. Current supply: {numbers.supply?.toLocaleString("en-US",{maximumFractionDigits:9})??"Unavailable"} α. Owner locked: {lockedOwner?.toLocaleString("en-US",{maximumFractionDigits:9})??"Unavailable"} α.</p>
      <p>APY compounds recent staking rewards; APR does not. Neither includes token-price changes or represents a specific validator’s return. {liquidationExplanation}</p>
      <p><a href="https://www.bittensor.com/docs/concepts/emissions" target="_blank" rel="noreferrer">Supply and emissions ↗</a> · <a href="https://www.bittensor.com/docs/concepts/emission-weights" target="_blank" rel="noreferrer">Owner allocation methodology ↗</a></p>
    </details>
    <p className={styles.times}>Market {stamp(row.time)} · Owner {stamp(holding?.asOf)}{holding?.overdue?" · overdue":""} · Burns {stamp(burnSnapshot?.asOf)}</p>
  </section>;
}
