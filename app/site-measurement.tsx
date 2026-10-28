"use client";
import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { track } from "@vercel/analytics";

const destinations: Record<string, string> = { "/subnet-news": "daily_news", "/sectors": "sectors", "/validators": "validators", "/validators/root": "root", "/video": "videos", "/university": "classes", "/partners": "partners" };
export function SiteMeasurement() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!anchor) return;
      const url = new URL(anchor.getAttribute("href")!, location.href);
      const destination = url.origin === location.origin ? destinations[url.pathname] : ({ "taoflows.app": "taoflows", "saygm.com": "saygm", "engy.ai": "engy", "lium.io": "lium", "t.me": "telegram" } as Record<string, string>)[url.hostname];
      if (destination) track("Destination opened", { destination });
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  return <Analytics beforeSend={event => {
    const url = new URL(event.url);
    url.search = ""; url.hash = "";
    url.pathname = url.pathname.replace(/5[1-9A-HJ-NP-Za-km-z]{46,47}/g, "wallet");
    return { ...event, url: url.toString() };
  }} />;
}
