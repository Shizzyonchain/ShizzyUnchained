import { withSocialMetadata } from "../lib/social-metadata";
import type { Metadata } from "next";
import { PartnerDirectory } from "./partner-directory";
import { CreatorShell } from "../creator-shell";

export const metadata: Metadata = withSocialMetadata({
  title: "Bittensor Ecosystem Partners | ShizzyUnchained",
  description: "Explore ShizzyUnchained partners for Bittensor research, staking, crypto trading, security and privacy, including BTCC with referral code SHIZZY and the AlphaChaser community offer.",
  alternates: { canonical: "/partners" },
}, "/partners");

export default function PartnersPage() {
  return <CreatorShell><PartnerDirectory /></CreatorShell>;
}
