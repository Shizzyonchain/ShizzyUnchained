import { withSocialMetadata } from "../lib/social-metadata";
import { getTaoHistory } from "../lib/tao-history";
import type { Metadata } from "next";
import { Dashboard } from "../dashboard";
import { getInitialMarkets, getInitialTaoQuote } from "../lib/market-data";

export const metadata: Metadata = withSocialMetadata({
  title: "Live Bittensor Conviction Activity | ShizzyUnchained",
  description: "Track finalized Bittensor conviction locks, unlocks, stake moves, and subnet activity on Finney.",
  alternates: { canonical: "/activity" },
}, "/activity");

export default async function ActivityPage() {
  const [initialRows, quote, initialDollarHistory] = await Promise.all([getInitialMarkets(), getInitialTaoQuote(), getTaoHistory()]);
  return <Dashboard initialNow={Date.now()} initialDollarHistory={initialDollarHistory} initialView="activity" initialRows={initialRows} initialTaoUsd={quote?.usd || 0} initialTaoQuote={quote} />;
}
