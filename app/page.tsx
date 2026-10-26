import { withSocialMetadata } from "./lib/social-metadata";
import { getTaoHistory } from "./lib/tao-history";
import type { Metadata } from "next";
import { Dashboard } from "./dashboard";
import { getInitialMarkets, getInitialTaoQuote, getInitialRenderTime } from "./lib/market-data";

export const revalidate = 15;
export const metadata: Metadata = withSocialMetadata({
  title: "Live Bittensor Subnet Prices, APY & Market Data | ShizzyUnchained",
  description: "Track live finalized Bittensor subnet prices, market caps, APY, emissions, volume, and conviction-locked alpha across Finney.",
  alternates: { canonical: "/" },
}, "/");

export default async function Home() {
  const [rows, quote, initialDollarHistory] = await Promise.all([getInitialMarkets(), getInitialTaoQuote(), getTaoHistory()]);
  const taoUsd = quote?.usd || 0;
  const subnetRows = rows.filter((row) => row.netuid !== 0);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Live Bittensor Subnet Markets",
    description: "Finalized Bittensor Finney subnet prices, market capitalization, APY, emissions, and conviction-locked alpha.",
    url: "https://shizzyunchained.com/",
    temporalCoverage: subnetRows[0]?.time,
    creator: { "@type": "Organization", name: "ShizzyUnchained", url: "https://shizzyunchained.com/" },
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: "https://shizzyunchained.com/api/backend/v1/screener",
    },
    hasPart: subnetRows.slice(0, 25).map((row, index) => ({
      "@type": "Dataset",
      position: index + 1,
      name: `${row.name || "Unknown"} (SN${row.netuid})`,
      description: `${row.symbol || `SN${row.netuid}`} price ${row.price_tao} TAO${taoUsd > 0 ? ` (${(Number(row.price_tao) * taoUsd).toFixed(4)} USD)` : ""}`,
    })),
  };

  const initialNow = await getInitialRenderTime();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <Dashboard initialNow={initialNow} appearance="monochrome" initialDollarHistory={initialDollarHistory} initialRows={rows} initialTaoUsd={quote?.usd || 0} initialTaoQuote={quote} />
    </>
  );
}
