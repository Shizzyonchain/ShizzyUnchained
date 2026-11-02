"use client";
import { useState } from "react";
import { recoveryMath } from "../../lib/recovery-math";
import styles from "./page.module.css";
const percent = (v: number) => `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const price = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 6 });
export function RecoveryCalculator() {
  const [reference, setReference] = useState("100"), [current, setCurrent] = useState("50");
  const result = reference.trim() && current.trim() ? recoveryMath(Number(reference), Number(current)) : null;
  return <>
    <div className={styles.inputs}><label>Reference price<input inputMode="decimal" type="number" min="0" step="any" value={reference} onChange={e => setReference(e.target.value)} /></label><label>Lower price<input inputMode="decimal" type="number" min="0" step="any" value={current} onChange={e => setCurrent(e.target.value)} /></label><button type="button" onClick={() => { setReference("100"); setCurrent("50"); }}>Reset example</button></div>
    <p className={styles.hint}>Enter two prices in the same currency, such as TAO/USDT. These are your inputs, not live market quotes. Defaults are an illustrative 100 → 50.</p>
    <div role="status" aria-live="polite">{result ? <>
      <div className={styles.metrics}><article><h2>Price decline</h2><strong>{percent(result.drop)}</strong><p>Below the reference price</p></article><article><h2>Gain needed to return</h2><strong>{result.requiredGain === null ? "No finite gain" : `+${percent(result.requiredGain)}`}</strong><p>Measured from the lower price</p></article><article><h2>Price gap</h2><strong>{price(result.gap)}</strong><p>In the same quote-currency units</p></article></div>
      <p className={styles.explanation}>{result.requiredGain === null ? "At a zero price, percentage recovery is undefined because its starting denominator is zero." : result.drop === 0 ? "The prices are equal. No gain is needed to return to the reference." : `A move from ${price(Number(reference))} to ${price(Number(current))} is a ${percent(result.drop)} decline. Returning from ${price(Number(current))} to ${price(Number(reference))} requires a ${percent(result.requiredGain)} gain because the starting price is now smaller.`}</p>
    </> : <p className={styles.explanation}>Enter a positive reference price and a lower price from zero up to that reference. Both fields must contain finite numbers.</p>}</div>
    <section><h2>Try a drawdown</h2><p>These buttons load examples on a reference price of 100.</p><div className={styles.presets}>{[10, 20, 30, 50, 75, 90].map(drop => <button key={drop} type="button" onClick={() => { setReference("100"); setCurrent(String(100 - drop)); }}>{drop}% decline</button>)}</div></section>
  </>;
}
