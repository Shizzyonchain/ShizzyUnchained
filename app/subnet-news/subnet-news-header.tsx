"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteHeader } from "../site-header";
import styles from "./tools-nav.module.css";

export function SubnetNewsHeader() {
  const pathname = usePathname();
  const etaoActive = pathname === "/subnet-news/etao" || pathname.startsWith("/subnet-news/etao/");
  const burnsActive = pathname === "/subnet-news/burns";
  const returnsActive = pathname === "/subnet-news/tao-returns";
  const seasonalityActive = pathname === "/subnet-news/seasonality";
  const compareActive = pathname === "/subnet-news/split-compare";
  const recoveryActive = pathname === "/subnet-news/recovery-math";
  const searchActive = pathname === "/subnet-news/search";
  const watchlistActive = pathname === "/subnet-news/watchlist";
  const holdingActive = pathname === "/subnet-news/holding-periods";
  const finderActive = pathname === "/subnet-news/split-finder";
  const tabs = [
    { href: "/subnet-news", label: "Daily news", active: !etaoActive && !burnsActive && !returnsActive && !seasonalityActive && !compareActive && !recoveryActive && !searchActive && !watchlistActive && !holdingActive && !finderActive },
    { href: "/subnet-news/etao", label: "eTAO Changes →", active: etaoActive },
    { href: "/subnet-news/burns", label: "Burns →", active: burnsActive },
    { href: "/subnet-news/tao-returns", label: "TAO Returns →", active: returnsActive },
    { href: "/subnet-news/holding-periods", label: "Holding Returns →", active: holdingActive },
    { href: "/subnet-news/seasonality", label: "Seasonality →", active: seasonalityActive },
    { href: "/subnet-news/split-finder", label: "Split Finder →", active: finderActive },
    { href: "/subnet-news/split-compare", label: "Split Compare →", active: compareActive },
    { href: "/subnet-news/recovery-math", label: "Recovery Math →", active: recoveryActive },
    { href: "/subnet-news/watchlist", label: "Watchlist →", active: watchlistActive },
    { href: "/subnet-news/search", label: "News Search →", active: searchActive },
  ];
  return <><SiteHeader /><nav aria-label="Subnet news tools" className={styles.nav}>
    {tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={tab.active ? "page" : undefined} style={{ padding: "12px 18px", border: `1px solid ${tab.active ? "#fff" : "#444"}`, background: tab.active ? "#fff" : "#000", color: tab.active ? "#000" : "#fff", fontWeight: 700, textDecoration: "none" }}>{tab.label}</Link>)}
  </nav></>;
}



