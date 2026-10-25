"use client";
import { useEffect, useRef, useState } from "react";
import { OwnerSalesSummary } from "./subnet-owner-sales";
import { holdingForOwner, displayHolding, type OwnerHoldings } from "./lib/owner-holdings";
import { formatSalesAmount } from "./lib/owner-sales";
import styles from "./subnet-owner.module.css";
type Owners = { checkedAt: string; block: number; owners: Record<string, string>; holdings?:OwnerHoldings };
let cached: Owners | null = null;
let pending: Promise<Owners> | null = null;
async function loadOwners() {
  if (cached && Date.now() - Date.parse(cached.checkedAt) < 15 * 60_000) return cached;
  if (!pending) pending = fetch("/api/subnets/owners", { signal: AbortSignal.timeout(8000) }).then(async response => {
    if (!response.ok) throw new Error("Owner data unavailable");
    const data = await response.json() as Owners;
    if (!data.owners || !Number.isInteger(data.block) || !Number.isFinite(Date.parse(data.checkedAt))) throw new Error("Invalid owner data");
    cached = data; return data;
  }).finally(() => { pending = null; });
  return pending;
}
export function SubnetOwner({ netuid }: { netuid: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened,setOpened] = useState(false);
  const showSales = () => { setOpened(true); dialog.current?.showModal(); };
  const [snapshot, setSnapshot] = useState<Owners | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState(false);
  const [copyState, setCopyState] = useState("");
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { loadOwners().then(data => { if (!cancelled) { setSnapshot(data); setStale(Date.now() - Date.parse(data.checkedAt) > 30 * 60_000); setError(false); } }).catch(() => { if (!cancelled) setError(true); }); };
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [netuid]);
  const address = snapshot?.owners[String(netuid)];
  const valid = address && /^[1-9A-HJ-NP-Za-km-z]{46,50}$/.test(address) ? address : null;
  const holding=holdingForOwner(snapshot?.holdings,netuid,valid||undefined);
  return <section id="subnet-owner-activity" tabIndex={-1} className={styles.owner} aria-label="Subnet owner research">
    <p className={styles.label}>Owner wallet</p>
    {valid && snapshot ? <><div className={styles.actions}><button type="button" className={styles.walletSalesLink} onClick={showSales} aria-label={`View SN${netuid} owner alpha sales`} aria-haspopup="dialog"><code title={valid}>{valid.slice(0,7)}…{valid.slice(-7)}</code> →</button><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(valid); setCopyState("Copied"); } catch { setCopyState("Copy unavailable—select the address"); } }}>Copy address</button></div><details className={styles.walletVerification}><summary>Full address &amp; chain verification</summary><small>Subnet owner coldkey</small><code>{valid}</code><small>{stale || error ? "Last verified owner · " : "Chain verified · "}block {snapshot.block.toLocaleString("en-US")} · {new Date(snapshot.checkedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC</small></details></> : <p>{error ? "Owner wallet temporarily unavailable" : snapshot ? "No verified owner wallet available" : "Loading owner wallet…"}</p>}
    <section className={styles.holdings} aria-label="Owner wallet holdings"><div className={styles.holdingsHeading}><h3>Owner holdings</h3><small>Daily chain snapshot</small></div>
      {holding?<><dl className={styles.holdingsGrid}><div><dt>SN{netuid} alpha held</dt><dd title={`${formatSalesAmount(holding.alphaRaw)} α`}>{displayHolding(holding.alphaRaw)} α</dd><small>Total on this subnet · includes locked stake</small></div><div><dt>Free TAO balance</dt><dd title={`${formatSalesAmount(holding.freeTaoRaw)} TAO`}>{displayHolding(holding.freeTaoRaw)} TAO</dd><small>Wallet balance · excludes staked TAO</small></div></dl>
      <p className={styles.holdingsTime}>As of {new Date(holding.asOf).toLocaleString("en-US",{timeZone:"UTC"})} UTC{holding.overdue?" · daily update overdue":" · refreshed with daily news"}</p>
      <details className={styles.walletVerification}><summary>Exact balances &amp; snapshot evidence</summary><p>SN{netuid} alpha: {formatSalesAmount(holding.alphaRaw)} α. Locked: {formatSalesAmount(holding.lockedAlphaRaw)} α. Available to unstake: {formatSalesAmount(holding.unstakableAlphaRaw)} α.</p><p>Free TAO: {formatSalesAmount(holding.freeTaoRaw)} TAO. Frozen TAO: {formatSalesAmount(holding.frozenTaoRaw)} TAO. Root-staked TAO: {formatSalesAmount(holding.rootTaoRaw)} TAO.</p><p>Free balance is not a spending quote: freezes, fees and account requirements can restrict spending. Alpha holdings are summed across this coldkey’s hotkeys on this subnet. Other subnets’ alpha, team wallets, custody/exchange balances and EVM-held tokens are excluded. These are dated holdings, not a live balance, sale or profit figure.</p><small>Finalized block {holding.block.toLocaleString("en-US")} · {holding.hash}</small><a href={holding.evidence} target="_blank" rel="noreferrer">Saved chain evidence ↗</a></details></>:<p className={styles.holdingsTime}>{snapshot?.holdings?"No daily holdings snapshot matches the currently verified owner. Awaiting refresh.":"Daily owner holdings snapshot unavailable."}</p>}
    </section>
    <OwnerSalesSummary key={netuid} netuid={netuid} onViewSales={showSales} />
    <dialog ref={dialog} className={`sentiment-dialog ${styles.ownerDialog}`} aria-labelledby={`owner-sales-title-${netuid}`} onClose={()=>setOpened(false)} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
      <div className={styles.ownerDialogHead}><div><small>SN{netuid} · current owner wallet</small><h2 id={`owner-sales-title-${netuid}`}>Owner alpha sales</h2></div><button type="button" onClick={()=>dialog.current?.close()} aria-label="Close owner alpha sales">Close ✕</button></div>
      {valid&&<code className={styles.ownerAddress}>{valid}</code>}
      {opened&&valid&&<OwnerSalesSummary netuid={netuid} salesOnly ownerAddress={valid}/>}
    </dialog>
    <span className={styles.status} role="status">{copyState}</span>
  </section>;
}
