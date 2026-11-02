"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteHeader } from "../site-header";

export function SubnetNewsHeader() {
  const pathname = usePathname();
  const etaoActive = pathname === "/subnet-news/etao" || pathname.startsWith("/subnet-news/etao/");
  const burnsActive = pathname === "/subnet-news/burns";
  const returnsActive = pathname === "/subnet-news/tao-returns";
  const seasonalityActive = pathname === "/subnet-news/seasonality";
  const tabs = [
    { href: "/subnet-news", label: "Daily news", active: !etaoActive && !burnsActive && !returnsActive && !seasonalityActive },
    { href: "/subnet-news/etao", label: "eTAO Changes →", active: etaoActive },
    { href: "/subnet-news/burns", label: "Burns →", active: burnsActive },
    { href: "/subnet-news/tao-returns", label: "TAO Returns →", active: returnsActive },
    { href: "/subnet-news/seasonality", label: "Seasonality →", active: seasonalityActive },
  ];
  return <><SiteHeader /><nav aria-label="Subnet news tools" style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "16px 24px", overflowX: "auto" }}>
    {tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={tab.active ? "page" : undefined} style={{ padding: "12px 18px", border: `1px solid ${tab.active ? "#fff" : "#444"}`, background: tab.active ? "#fff" : "#000", color: tab.active ? "#000" : "#fff", fontWeight: 700, textDecoration: "none" }}>{tab.label}</Link>)}
  </nav></>;
}
