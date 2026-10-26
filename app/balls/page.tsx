import { withSocialMetadata } from "../lib/social-metadata";
import { getTaoHistory } from "../lib/tao-history";
import type { Metadata } from "next";
import { Dashboard } from "../dashboard";
import { getInitialMarkets, getInitialTaoQuote } from "../lib/market-data";

export const metadata: Metadata = withSocialMetadata({
  title: "Balls | Bittensor Subnet Market Map | ShizzyUnchained",
  description: "Explore all 128 Bittensor subnets as interactive 3D balls. Drag, toss, search and compare live subnet market moves.",
  alternates: { canonical: "/balls" },
}, "/balls");

export default async function BallsPage() {
  const [initialRows, quote, initialDollarHistory] = await Promise.all([getInitialMarkets(), getInitialTaoQuote(), getTaoHistory()]);
  return <Dashboard initialNow={Date.now()} initialDollarHistory={initialDollarHistory} initialView="bubbles" initialRows={initialRows} initialTaoUsd={quote?.usd || 0} initialTaoQuote={quote} />;
}
