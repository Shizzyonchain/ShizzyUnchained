import type { Metadata } from "next";
import archive from "../../data/etao.json";
import { getSubnetNewsBriefs } from "../../lib/subnet-news";
import { indexNews } from "../../lib/news-search";
import { withSocialMetadata } from "../../lib/social-metadata";
import { SubnetNewsHeader } from "../subnet-news-header";
import { Watchlist } from "./watchlist";
import styles from "./page.module.css";
export const metadata: Metadata = withSocialMetadata({ title: "Your Subnet News Watchlist | Shizzy Unchained", description: "Keep a browser-local list of subnet slots and catch up on their latest published stories.", alternates: { canonical: "/subnet-news/watchlist" } }, "/subnet-news/watchlist");
export default function WatchlistPage() {
  const rows = indexNews(getSubnetNewsBriefs());
  const options = Object.entries(archive.names).map(([id, name]) => ({ id: Number(id), name, stories: rows.filter(row => row.netuid === Number(id)).slice(0, 3).map(row => ({ key: row.key, date: row.date, name: row.name, headline: row.item.headline, status: row.item.status })) })).sort((a, b) => a.id - b.id);
  return <><SubnetNewsHeader /><main className={styles.page}><header><p>BITTENSOR · YOUR READING LIST</p><h1>Your subnets. One catch-up.</h1><p>Save up to 20 subnet slots and see their three most recent published stories.</p></header><Watchlist options={options} /><section className={styles.note}><h2>What this list follows</h2><p>Selections stay in this browser’s local storage. No account, wallet connection or server-synced portfolio is created. Clearing browser data removes the list. Other people using this browser profile can see it.</p><p>This follows subnet numbers across registrations, not a permanent project identity. Picker names come from the reviewed archive at {new Date(archive.chainTime).toISOString()}; story names and verification labels belong to their original editions. Check current identity before acting on historical coverage. No story does not mean no activity. This is a reading aid, not an investment ranking, notification service or real-time price feed.</p></section></main></>;
}

