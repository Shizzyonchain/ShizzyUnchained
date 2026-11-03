"use client";
import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { track } from "@vercel/analytics";
import { measurementDestination } from "./lib/measurement-destinations";
export function SiteMeasurement() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor) return;
      const destination = measurementDestination(anchor.getAttribute("href")!, location.href);
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
