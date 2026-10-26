import { chartPageTitle } from "../../lib/seo";
import { withSocialMetadata } from "../../lib/social-metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dashboard } from "../../dashboard";
import { getInitialMarkets, getInitialTaoQuote, getInitialRenderTime } from "../../lib/market-data";
import { getTaoHistory } from "../../lib/tao-history";

export const revalidate = 15;

function chartAsset(asset: string): number | "tao" {
  if (asset === "tao") return "tao";
  if (!/^[1-9]\d{0,2}$/.test(asset) || Number(asset) > 128) notFound();
  return Number(asset);
}

export async function generateMetadata({ params }: { params: Promise<{ asset: string }> }): Promise<Metadata> {
  const { asset } = await params;
  const selected = chartAsset(asset);
  const rows = selected === "tao" ? [] : await getInitialMarkets();
  const title = chartPageTitle(selected, rows.find(row => row.netuid === selected)?.name);
  return withSocialMetadata({ title: `${title} | ShizzyUnchained`, description: `${title}: explore historical prices, indicators, drawings and Bittensor market information in USD and TAO.`, alternates: { canonical: `/charts/${asset}` } }, `/charts/${asset}`);
}

export default async function ChartPage({ params, searchParams }: { params: Promise<{ asset: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { asset } = await params;
  const selected = chartAsset(asset);
  const query = await searchParams;
  const currency = query.currency === "tao" && selected !== "tao" ? "tao" : "usd";
  const interval = typeof query.interval === "string" && ["10m", "1h", "1d", "1w", "1mo"].includes(query.interval) ? query.interval : "1d";
  const [rows, quote, history] = await Promise.all([getInitialMarkets(), getInitialTaoQuote(), getTaoHistory()]);
  const initialNow = await getInitialRenderTime();
  return <Dashboard initialNow={initialNow} key={asset} initialChart={selected} initialCurrency={currency} initialInterval={interval} initialRows={rows} initialTaoUsd={quote?.usd || 0} initialTaoQuote={quote} initialDollarHistory={history} />;
}
