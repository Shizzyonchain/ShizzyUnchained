import { requestGuard, concurrencyGate } from "../../../lib/request-protection";
import { routeIsAllowed } from "../../../lib/backend-routes.mjs";
import { NextRequest, NextResponse } from "next/server";

// vercel.json pins all functions to sfo1, keeping this relay close to Render's
// Oregon service without relying on deprecated per-route region configuration.

const admitJob = concurrencyGate(8);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  const { path } = await context.params;
  const pathname = path.join("/");
  if (!routeIsAllowed(request.method, pathname)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (request.method === "GET" && (pathname.includes("/wallets/jobs/") || pathname.endsWith("/candles") || pathname === "v1/activity")) {
    const blocked = requestGuard(request, "research"); if (blocked) return blocked;
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (request.method === "POST" && contentLength > 16_384) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }
  const requestBody = request.method === "GET" ? undefined : await request.text();
  if (requestBody && new TextEncoder().encode(requestBody).byteLength > 16_384) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }
  const base = process.env.BACKEND_API_URL || "http://api:8000";
  const target = new URL(`/${pathname}`, base);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  const endpoint = path.at(-1);
  const isMarketSnapshot = request.method === "GET" && (endpoint === "candles" || endpoint === "screener");
  // Candle tails must await the upstream refresh. Nesting a fetch SWR cache
  // under the CDN can serve a hours-old tail on the first visit to each subnet.
  // The shared five-second CDN cache below still protects the backend.
  const cacheSnapshotFetch = isMarketSnapshot && endpoint !== "candles";
  try {
    const response = await fetch(target, {
      method: request.method,
      headers: { "Content-Type": request.headers.get("content-type") || "application/json", "X-API-Key": process.env.BACKEND_API_KEY || "", "X-Request-Id": requestId },
      body: requestBody,
      cache: cacheSnapshotFetch ? "force-cache" : "no-store",
      signal: AbortSignal.timeout(endpoint === "candles" ? 25_000 : isMarketSnapshot ? 15_000 : 8_000),
      ...(cacheSnapshotFetch ? { next: { revalidate: 5 } } : {}),
    });
    const upstreamMs = Math.round(performance.now() - startedAt);
    if (upstreamMs >= 1_000 || !response.ok) {
      console.warn(JSON.stringify({
        level: response.ok ? "warn" : "error",
        message: "backend relay completed",
        route: pathname,
        method: request.method,
        status: response.status,
        requestId,
        upstreamMs,
      }));
    }
    return new NextResponse(response.body, { status: response.status, headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
      "Server-Timing": `render;dur=${upstreamMs}`,
      "X-Request-Id": requestId,
      "X-Upstream-Duration-Ms": String(upstreamMs),
      ...(response.status === 429 ? { "Retry-After": response.headers.get("retry-after") || "60", "Cache-Control": "no-store" } : {}),
      ...(isMarketSnapshot ? {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=60",
        "CDN-Cache-Control": "public, s-maxage=5, stale-while-revalidate=60",
      } : {}),
    } });
  } catch (error) {
    const upstreamMs = Math.round(performance.now() - startedAt);
    console.error(JSON.stringify({
      level: "error",
      message: "backend relay failed",
      requestId,
      route: pathname,
      method: request.method,
      upstreamMs,
      error: error instanceof Error ? error.name : "UnknownError",
    }));
    return NextResponse.json(
      { error: "Market data service timed out", request_id: requestId },
      { status: 504, headers: {
        "Cache-Control": "no-store",
        "Server-Timing": `render;dur=${upstreamMs}`,
        "X-Request-Id": requestId,
        "X-Upstream-Duration-Ms": String(upstreamMs),
      } },
    );
  }
}
export const GET = proxy;
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  // Never share job identifiers across requests, even behind the same public IP.
  const blocked = requestGuard(request, "wallet");
  if (blocked) return blocked;
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 16_384) return Response.json({ error: "Request body too large" }, { status: 413 });
  const reader = request.body?.getReader();
  const parts: Uint8Array[] = []; let size = 0;
  if (reader) { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 16_384) { await reader.cancel(); return Response.json({ error: "Request body too large" }, { status: 413 }); } parts.push(value); } }
  const body = Buffer.concat(parts).toString("utf8");
  try { const payload = JSON.parse(body); if (!Array.isArray(payload.addresses) || payload.addresses.length < 1 || payload.addresses.length > 100 || payload.addresses.some((address: unknown) => typeof address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{45,50}$/.test(address))) throw new Error("Invalid wallet request"); }
  catch { return Response.json({ error: "Enter valid public wallet addresses." }, { status: 400 }); }
  return admitJob(() => proxy(new NextRequest(request.url, { method: "POST", headers: request.headers, body }), context));
}
