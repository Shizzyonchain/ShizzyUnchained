import "server-only";
import { after } from "next/server";
import { getCache } from "@vercel/functions";
import { cachedChart, type ChartPayload, type ChartStore } from "./chart-cache";

export async function chartResponse(key: string, load: () => Promise<Response>, awaitRefresh = false) {
  try {
    const data = await cachedChart(key, getCache({ namespace: "chart-history-v1" }) as ChartStore, async () => {
      const response = await load();
      if (!response.ok) throw new Error("History source unavailable");
      return await response.json() as ChartPayload;
    }, work => after(work), Date.now(), awaitRefresh);
    return Response.json(data, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } });
  } catch {
    return Response.json({ error: "History is temporarily unavailable. Retry shortly; live market quotes are separate." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
