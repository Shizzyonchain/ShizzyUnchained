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
  const searchActive = pathname === "/subnet-news/search";
  const toolkitActive = pathname === "/subnet-news/toolkit";
  const tabs = [
    { href: "/subnet-news", label: "Daily news", active: pathname === "/subnet-news" || /^\/subnet-news\/\d{4}-\d{2}-\d{2}$/.test(pathname) },
    { href: "/subnet-news/gamma", label: "Gamma →", active: pathname === "/subnet-news/gamma" },
    { href: "/subnet-news/etao", label: "eTAO Changes →", active: etaoActive },
    { href: "/subnet-news/burns", label: "Burns →", active: burnsActive },
    { href: "/subnet-news/tao-returns", label: "TAO Returns →", active: returnsActive },
    { href: "/subnet-news/search", label: "News Search →", active: searchActive },
  ];
  return <><SiteHeader /><div className={styles.toolkit}><Link href="/subnet-news/toolkit" aria-current={toolkitActive ? "page" : undefined}>Bittensor Toolkit →</Link><span>Find the right tool for your question.</span></div><nav aria-label="Subnet news tools" className={styles.nav}>
    {tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={tab.active ? "page" : undefined} style={{ padding: "12px 18px", border: `1px solid ${tab.active ? "#fff" : "#444"}`, background: tab.active ? "#fff" : "#000", color: tab.active ? "#000" : "#fff", fontWeight: 700, textDecoration: "none" }}>{tab.label}</Link>)}
  </nav></>;
}



