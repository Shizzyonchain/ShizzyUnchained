import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getTaoQuote } from "./tao-price-source";

import type { ScreenerRow } from "../dashboard";

// Read once at the server data boundary and serialize it with the snapshot.
// The browser uses the same clock for hydration, then starts its live clock.
export const getInitialRenderTime = cache(async () => Date.now());

export const getInitialMarkets = cache(async (): Promise<ScreenerRow[]> => {
  const base = process.env.BACKEND_API_URL;
  if (!base) return [];
  try {
    const response = await fetch(new URL("/v1/screener", base), {
      headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" },
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  }
});

// Cache the complete quote, including its original check time. This keeps ISR
// pages fast without stamping an old provider response as a fresh quote.
export const getInitialTaoQuote = unstable_cache(getTaoQuote, ["initial-tao-usd-reference-v1"], { revalidate: 30 });
