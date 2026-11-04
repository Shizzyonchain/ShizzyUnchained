import { withSocialMetadata } from "../lib/social-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../site-header";
import { CreatorFooter } from "../creator-footer";
import { ValidatorFinder } from "./validator-finder";
import { getSubnetNewsBriefs } from "../lib/subnet-news";
import { OptionalDirectory } from "./optional-directory";
import styles from "./validators.module.css";

export const metadata: Metadata = withSocialMetadata({
  title: "Bittensor Validators | ShizzyUnchained",
  description: "Explore Bittensor validator stake, fees, subnet coverage, historical yield and delegation statistics.",
  alternates: { canonical: "/validators" },
}, "/validators");
export default function ValidatorsPage() {
  const subnets = (getSubnetNewsBriefs()[0]?.subnets || []).map(({ netuid, name }) => ({ netuid, name }));
  return <><div className={styles.header}><SiteHeader hideCurrency /></div><main className={`${styles.page} ${styles.simplePage}`}><header className={styles.simpleHero}><h1>Find your validator.</h1><p>Pick a subnet. Compare three validator options.</p></header><nav className={styles.viewNav} aria-label="Validator views"><span aria-current="page">Subnet staking</span><Link href="/validators/root">Compare Root staking →</Link></nav><ValidatorFinder subnets={subnets} /><div className={styles.simpleDirectory}><OptionalDirectory /></div></main><CreatorFooter /></>;
}
