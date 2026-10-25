"use client";
import { useEffect, useRef, useState } from "react";
import { OwnerSalesSummary } from "./subnet-owner-sales";
import styles from "./subnet-owner.module.css";
type Owners = { checkedAt: string; block: number; owners: Record<string, string> };
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
  return <section id="subnet-owner-activity" tabIndex={-1} className={styles.owner} aria-label="Subnet owner research">
    <p className={styles.label}>Owner wallet <span>Subnet owner coldkey</span></p>
    {valid && snapshot ? <><div className={styles.actions}><button type="button" className={styles.walletSalesLink} onClick={showSales} aria-label={`View SN${netuid} owner alpha sales`} aria-haspopup="dialog"><code>{valid}</code> →</button><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(valid); setCopyState("Copied"); } catch { setCopyState("Copy unavailable—select the address"); } }}>Copy address</button></div><small>{stale || error ? "Last verified owner · " : "Chain verified · "}block {snapshot.block.toLocaleString("en-US")} · {new Date(snapshot.checkedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC</small></> : <p>{error ? "Owner wallet temporarily unavailable" : snapshot ? "No verified owner wallet available" : "Loading owner wallet…"}</p>}
    <OwnerSalesSummary key={netuid} netuid={netuid} onViewSales={showSales} />
    <dialog ref={dialog} className={`sentiment-dialog ${styles.ownerDialog}`} aria-labelledby={`owner-sales-title-${netuid}`} onClose={()=>setOpened(false)} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
      <div className={styles.ownerDialogHead}><div><small>SN{netuid} · current owner wallet</small><h2 id={`owner-sales-title-${netuid}`}>Owner alpha sales</h2></div><button type="button" onClick={()=>dialog.current?.close()} aria-label="Close owner alpha sales">Close ✕</button></div>
      {valid&&<code className={styles.ownerAddress}>{valid}</code>}
      {opened&&valid&&<OwnerSalesSummary netuid={netuid} salesOnly ownerAddress={valid}/>}
    </dialog>
    <span className={styles.status} role="status">{copyState}</span>
  </section>;
}
