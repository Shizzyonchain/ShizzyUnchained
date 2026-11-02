import type { Metadata } from "next";
import Link from "next/link";
import { withSocialMetadata } from "../../lib/social-metadata";
import { recoveryMath } from "../../lib/recovery-math";
import { SubnetNewsHeader } from "../subnet-news-header";
import { RecoveryCalculator } from "./calculator";
import styles from "./page.module.css";
export const metadata: Metadata = withSocialMetadata({ title: "TAO Drawdown Recovery Calculator | Recovery Math", description: "See why a 50% price decline needs a 100% gain to recover. Enter two prices and calculate the exact recovery hurdle, without a market forecast.", alternates: { canonical: "/subnet-news/recovery-math" } }, "/subnet-news/recovery-math");
export default function RecoveryMathPage() {
  return <><SubnetNewsHeader /><main className={styles.page}><header><p className={styles.eyebrow}>BITTENSOR · PRICE ARITHMETIC</p><h1>A 50% drop needs a 100% comeback.</h1><p>Losses and recoveries use different starting points. Calculate the hurdle before reading a rebound headline.</p></header>
    <RecoveryCalculator />
    <section><h2>The recovery ladder</h2><div className={styles.scroll} role="region" aria-label="Drawdown and required recovery table" tabIndex={0}><table className={styles.table}><caption>Illustrations using a starting price of 100. No prediction of recovery.</caption><thead><tr><th scope="col">Price decline</th><th scope="col">Price remaining</th><th scope="col">Gain to return to 100</th></tr></thead><tbody>{[5, 10, 20, 30, 40, 50, 60, 70, 75, 80, 90, 95].map(drop => <tr key={drop}><th scope="row">−{drop}%</th><td>{100 - drop}</td><td>+{recoveryMath(100, 100 - drop)!.requiredGain!.toFixed(2)}%</td></tr>)}</tbody></table></div></section>
    <section className={styles.notes}><h2>How it works</h2><p>Decline = (1 − lower price ÷ reference price) × 100. Required recovery = (reference price ÷ lower price − 1) × 100. A 50% decline halves the starting value; a 50% gain from there reaches only 75% of the original value.</p><p>The reference can be any price you choose. This tool does not verify an all-time high, fetch live quotes, calculate wallet profit or loss, or assume that a prior price will return. Fees, taxes, staking rewards and changes in holdings are outside this price-only calculation. It estimates neither recovery time nor probability.</p><p>Use the same quote currency for both inputs. A TAO/USDT decline and a subnet’s alpha/TAO decline measure different things. Do not combine percentages from different quote currencies.</p><Link href="/subnet-news/tao-returns">See observed TAO monthly returns →</Link></section>
  </main></>;
}
