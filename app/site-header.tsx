"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { snapshotIsFresh } from "./lib/market-snapshot";

type Currency = "usd" | "tao";
type DataState = "loading" | "live" | "stale" | "error";

type SiteHeaderProps = {
  brandArtwork?: "original" | "redrawn";
  currency?: Currency;
  onCurrencyChange?: (currency: Currency) => void;
  currencyTitle?: string;
  dataState?: DataState;
  lastUpdated?: Date | null;
  hideCurrency?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  external?: boolean;
};

const navigation: readonly NavItem[] = [
  { href: "/", label: "Market", exact: true },
  { href: "/subnet-news", label: "Bittensor News" },
  { href: "/balls", label: "Balls" },
  { href: "/video", label: "Videos" },
  { href: "/sectors", label: "Sectors" },
  { href: "https://shizzyunchained.printful.me/", label: "Shop", external: true },
  { href: "/university", label: "Shiz University" },
  { href: "/wallet-tracker", label: "Wallet Tracker" },
  { href: "/validators", label: "Validators" },
  { href: "/tao-heads", label: "TAO Heads" },
  { href: "/about", label: "About" },
  { href: "/partners", label: "Partners" },
];

export function SiteHeader({ brandArtwork = "redrawn", currency, onCurrencyChange, currencyTitle, dataState, lastUpdated, hideCurrency = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localCurrency, setLocalCurrency] = useState<Currency>("usd");
  const [localDataState, setLocalDataState] = useState<DataState>("loading");
  const activeCurrency = currency ?? localCurrency;
  const activeDataState = dataState ?? localDataState;

  useEffect(() => {
    if (dataState) return;
    let cancelled = false;
    let inFlight = false;
    let updatedAt: number | null = null;

    const checkFinney = async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch("/api/market-status", {
          cache: "no-store",
          signal: AbortSignal.timeout(6_000),
        });
        if (!response.ok) throw new Error(`Market status failed: ${response.status}`);
        const json = await response.json();
        const newest = Date.parse(json.updatedAt || "");
        updatedAt = Number.isFinite(newest) ? newest : null;
        if (!cancelled) setLocalDataState(snapshotIsFresh(updatedAt) ? "live" : "stale");
      } catch {
        if (!cancelled) setLocalDataState(updatedAt === null ? "error" : snapshotIsFresh(updatedAt) ? "live" : "stale");
      } finally {
        inFlight = false;
      }
    };

    void checkFinney();
    const timer = window.setInterval(checkFinney, 15_000);
    document.addEventListener("visibilitychange", checkFinney);
    window.addEventListener("focus", checkFinney);
    window.addEventListener("online", checkFinney);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", checkFinney);
      window.removeEventListener("focus", checkFinney);
      window.removeEventListener("online", checkFinney);
    };
  }, [dataState]);

  const changeCurrency = (nextCurrency: Currency) => {
    if (onCurrencyChange) onCurrencyChange(nextCurrency);
    else setLocalCurrency(nextCurrency);
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="topbar site-header">
      <Link className="brand" href="/" aria-label="Shizzy Unchained home">
        <Image
          src={brandArtwork === "redrawn" ? "/shizzy-unchained-home-v2.webp" : "/shizzy-unchained-logo.svg"}
          alt="Shizzy Unchained"
          width={brandArtwork === "redrawn" ? 888 : 220}
          height={brandArtwork === "redrawn" ? 313 : 74}
          sizes="(max-width: 600px) 170px, (max-width: 1550px) 220px, 285px"
          priority
        />
      </Link>
      <button
        className={`mobile-menu-toggle ${mobileMenuOpen ? "open" : ""}`}
        type="button"
        aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileMenuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav id="primary-navigation" className={mobileMenuOpen ? "mobile-open" : ""} aria-label="Primary navigation">
        {navigation.map((item) => item.external ? (
          <a href={item.href} target="_blank" rel="noreferrer" key={item.label} onClick={() => setMobileMenuOpen(false)}>
            {item.label}
          </a>
        ) : (
          <Link
            className={isActive(item.href, item.exact) ? "active" : ""}
            aria-current={isActive(item.href, item.exact) ? "page" : undefined}
            href={item.href}
            key={item.label}
            onClick={() => setMobileMenuOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        {!hideCurrency && <div className="currency-toggle" role="group" aria-label="Display currency" title={currencyTitle}>
          <button className={activeCurrency === "usd" ? "active" : ""} type="button" aria-pressed={activeCurrency === "usd"} onClick={() => changeCurrency("usd")}>USD</button>
          <button className={activeCurrency === "tao" ? "active" : ""} type="button" aria-pressed={activeCurrency === "tao"} onClick={() => changeCurrency("tao")}>TAO</button>
        </div>}
        <div
          className={`status ${activeDataState === "live" ? "live" : "demo"}`}
          title={lastUpdated ? `Market data updated ${lastUpdated.toLocaleTimeString()}` : undefined}
        >
          <i aria-hidden="true" />
          {activeDataState === "live" ? "Finney live" : activeDataState === "stale" ? "Finney delayed" : activeDataState === "loading" ? "Connecting…" : "Reconnecting…"}
        </div>
      </div>
    </header>
  );
}
