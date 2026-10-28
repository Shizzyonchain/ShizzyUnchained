"use client";
import { matchesSubnetQuery } from "./lib/subnet-search";
import { quoteFresh, quoteUsable, type TaoQuote } from "./lib/fx-price";

import { CSSProperties, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { calendarBars, dollarBars, priceBars, mergeChartCandles, withLiveCandle } from "./lib/chart-data";
import { SiteHeader } from "./site-header";
import { LivestreamBanner } from "./livestream-banner";
import { MembershipPromo } from "./membership-promo";
import { currencyReturns, type FxPoint, type ReturnHistory } from "./lib/currency-returns";
import { mergeFxHistory } from "./lib/merge-fx-history";
import { compareLiquidation, liquidationExplanation, liquidationPercent } from "./lib/liquidation";
import { taoHeadsCommunity } from "./lib/community";
import { SubnetNewsPanel } from "./subnet-news-panel";
import { WalletHistory, clearWalletHistoryCache } from "./wallet-history";
import { SubnetYield } from "./subnet-yield";
import { SubnetMarketSnapshot } from "./subnet-market-snapshot";
import { SubnetOwner } from "./subnet-owner";
import { MarketSignals } from "./market-signals";
import { SentimentTile } from "./sentiment-tile";
import { OverviewHelp } from "./overview-help";
import { MetricExplanation } from "./metric-explanation";
import metricStyles from "./metric-explanation.module.css";
import { latestSnapshotTime, snapshotIsFresh, marketSnapshotHealth, persistMarketSnapshot, MARKET_SNAPSHOT_CACHE_MAX_AGE_MS } from "./lib/market-snapshot";
import {
  bubbleTimeframeHasCoverage,
  bubbleTimeframeLabel,
  bubbleTimeframes,
  resolveBubbleTimeframe,
  type BubbleTimeframe,
} from "./lib/bubble-timeframe";

function ScrollableScreener({ children }: { children: ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [help, setHelp] = useState({ label: "Column guide", text: "Hover over a column or focus its heading to see what it means here." });
  const showHelp = (target: EventTarget) => {
    if (!(target instanceof Element)) return;
    const cell = target.closest<HTMLTableCellElement>("th, td");
    if (!cell) return;
    const heading = tableRef.current?.querySelector("thead tr")?.children[cell.cellIndex] as HTMLElement | undefined;
    const text = cell.dataset.help || heading?.dataset.help;
    if (text && heading) setHelp({ label: heading.textContent?.replace(/[↑↓]/g, "").trim() || "Column guide", text });
  };

  useEffect(() => {
    const container = tableRef.current;
    const table = container?.querySelector("table");
    if (!container || !table) return;
    const measure = () => setScrollWidth(container.scrollWidth > container.clientWidth ? container.scrollWidth : 0);
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(table);
    measure();
    return () => observer.disconnect();
  }, []);

  return <div onMouseOver={(event) => showHelp(event.target)} onFocus={(event) => showHelp(event.target)}>
    <div className="screener-column-help" role="status" aria-live="polite" aria-atomic="true">
      <strong>{help.label}</strong><p>{help.text}</p>
    </div>
    <div className="screener-scroll-top" ref={topRef} hidden={!scrollWidth}
      role="region" aria-label="Scroll subnet table horizontally" tabIndex={0}
      onScroll={() => { if (tableRef.current && topRef.current) tableRef.current.scrollLeft = topRef.current.scrollLeft; }}>
      <div style={{ width: scrollWidth, height: 1 }} />
    </div>
    <div className="table-wrap" ref={tableRef} tabIndex={0} role="region" aria-label="Subnet market data"
      onScroll={() => { if (topRef.current && tableRef.current) topRef.current.scrollLeft = tableRef.current.scrollLeft; }}>
      {children}
    </div>
  </div>;
}

export type ScreenerRow = ReturnHistory & {
  netuid: number;
  name?: string;
  symbol?: string;
  price_tao: string;
  tao_reserve?: string;
  liquidation_price_tao?: string;
  liquidation_diff_pct?: string;
  liquidation_time?: string;
  description?: string;
  website?: string;
  github_repo?: string;
  discord?: string;
  contact?: string;
  logo_url?: string;
  additional?: string;
  alpha_out?: string;
  market_cap_tao?: string;
  volume_24h_tao?: string;
  emission_pct?: string;
  apy?: string;
  apr?: string;
  yield_basis?: string;
  tempo?: string | number;
  staker_epoch_dividends_alpha?: string | number;
  circulating_alpha?: string | number;
  alpha_reserve?: string | number;
  conviction_locked_alpha?: string;
  conviction_locked_pct?: string;
  change_10m?: string;
  change_1h?: string;
  change_24h?: string;
  change_7d?: string;
  liquidity_change_1h?: string;
  emission_change_1h?: string;
  emission_share_24h?: string;
  emission_change_24h?: string;
  volume_1h_tao?: string;
  volume_acceleration_1h?: string;
  liquidity_change_24h?: string;
  volume_acceleration_24h?: string;
  time?: string;
};
type Candle = {
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume_tao?: string;
};
type Stake = {
  hotkey: string;
  netuid: number;
  name?: string;
  symbol?: string;
  alpha: string;
  tao_value?: string;
};
type Wallet = {
  address: string;
  free_tao: string;
  staked_tao_value?: string;
  total_tao_value?: string;
  stakes: Stake[];
  error?: string;
};
type PortfolioAsset = {
  key: string;
  netuid: number | null;
  name: string;
  symbol: string;
  alpha: number;
  taoValue: number;
  wallets: Set<string>;
};
type ChainEvent = {
  block_number: number;
  event_index: number;
  time: string;
  event_type: string;
  netuid?: number;
  destination_netuid?: number;
  name?: string;
  destination_name?: string;
  coldkey?: string;
  destination_coldkey?: string;
  hotkey?: string;
  destination_hotkey?: string;
  amount_alpha?: string;
  amount_tao?: string;
  tao_value?: string;
  perpetual?: boolean;
};
type ActivitySummary = {
  locked_alpha_24h: string;
  unlocked_alpha_24h: string;
  net_locked_alpha_24h: string;
  stake_moves_24h: number;
  locked_tao_24h: string;
  unlocked_tao_24h: string;
  net_locked_tao_24h: string;
  event_count_24h: number;
  tao_moved_24h: string;
  largest_move_tao_24h: string;
  active_subnets_24h: number;
};

const fmt = (value?: string | number, digits = 2) => {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: n < 1 ? Math.min(digits, 4) : 0,
  });
};
const preciseAlpha = (value?: string | number) => {
  const alpha = Number(value ?? 0);
  if (!Number.isFinite(alpha) || alpha === 0) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: 8,
    maximumFractionDigits: 12,
  }).format(alpha);
};
const allocationLabel = (allocation: number) => (allocation > 0 && allocation < 0.1 ? "<0.1%" : `${allocation.toFixed(1)}%`);
const compactAlpha = (value?: string | number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
const changeClass = (v?: string) => (Number(v ?? 0) > 0 ? "positive" : Number(v ?? 0) < 0 ? "negative" : "neutral");

const InteractiveBubbleField = dynamic(() => import("./interactive-bubbles").then(module => module.InteractiveBubbleField), { ssr: false, loading: () => <div className="bubble-map-loading" role="status">Building the interactive market map…</div> });
const TradingChart = dynamic(() => import("./trading-chart"), { ssr: false,
  loading: () => <div className="chart-module-loading" role="status">Opening chart…</div> });
type ChartHistory = { data: Candle[]; savedAt: number; method: string; done?: boolean; notice?: string };
const candleCache = new Map<string, ChartHistory>();
const candleRequests = new Map<string, Promise<ChartHistory>>();
const portfolioColors = ["#16d9c4", "#ffb547", "#ff5d73", "#64748b", "#36d66b", "#ff8a4c", "#173766", "#c7e85b", "#40b8ff"];

const safeProjectUrl = (value?: string) => {
  if (!value) return undefined;
  try {
    const url = new URL(value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
};

function decodeCompactCandles(rows: unknown[]): Candle[] {
  return rows.flatMap((row) => {
    if (!Array.isArray(row) || row.length < 5) return [];
    return [
      {
        time: String(row[0]),
        open: String(row[1]),
        high: String(row[2]),
        low: String(row[3]),
        close: String(row[4]),
        volume_tao: String(row[5] ?? 0),
      },
    ];
  });
}

function loadChartHistory(netuid: number | "tao", timeframe: string, before?: number) {
  const key = `${netuid}:${timeframe}${before === undefined ? "" : `:${before}`}`;
  const cached = candleCache.get(key);
  if (cached?.data.length && Date.now() - cached.savedAt < (before === undefined ? 30_000 : 86_400_000)) return Promise.resolve(cached);
  const pending = candleRequests.get(key);
  if (pending) return pending;
  const longInterval = timeframe === "1w" || timeframe === "1mo";
  const nodeUrl = `/api/backend/v1/subnets/${netuid}/candles?interval=${longInterval ? "1d" : timeframe}&limit=${longInterval ? 500 : 180}`;
  const url = (netuid === "tao" ? `/api/tao-chart?interval=${timeframe}` : `/api/subnet-chart?netuid=${netuid}&interval=${timeframe}`) + (before === undefined ? "" : `&before=${before}`);
  const fetchWithRetry = async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 28_000);
    try {
      let response = await fetch(url, { signal: controller.signal });
      let nodeFallback = false;
      if (!response.ok && netuid !== "tao" && before === undefined) {
        if (cached?.data.length) return { data: cached.data.map(c => [c.time,c.open,c.high,c.low,c.close,c.volume_tao || 0]), method: cached.method, historyStale: true, historyCheckedAt: new Date(cached.savedAt).toISOString() };
        nodeFallback = true; response = await fetch(nodeUrl, { cache: "no-store", signal: controller.signal });
      }
      if (!response.ok) throw new Error(`Chart request failed: ${response.status}`);
      return { ...await response.json(), nodeFallback };
    } finally {
      window.clearTimeout(timeout);
    }
  };
  const request = fetchWithRetry()
    .then((json) => {
      const data = netuid === "tao" ? (json.data || []) as Candle[] : decodeCompactCandles(json.data || []);
      const snapshot = { data: before === undefined ? mergeChartCandles(cached?.data || [], data) : data, savedAt: Date.now(), method: cached?.method === "extended-price" ? "extended-price" : json.method || (netuid === "tao" ? "exchange" : "boundary"), done: cached?.done || json.done === true, notice: json.nodeFallback ? "Limited node fallback history · provider temporarily unavailable" : json.historyStale ? `Cached history checked ${new Date(json.historyCheckedAt).toLocaleString("en-US", { timeZone: "UTC", timeStyle: "short" })} UTC · refreshing in background` : undefined };
      candleCache.set(key, snapshot);
      if (candleCache.size > 128) candleCache.delete(candleCache.keys().next().value!);
      return snapshot;
    })
    .finally(() => candleRequests.delete(key));
  candleRequests.set(key, request);
  return request;
}

// A finalized 128-subnet scan plus the regional relay cache normally lands
// within two minutes. Reserve the delayed state for a real missed cycle.
function marketSnapshotAge(rows: ScreenerRow[]) {
  const newest = latestSnapshotTime(rows);
  return newest !== null ? Date.now() - newest : Number.POSITIVE_INFINITY;
}

function marketSnapshotIsFresh(rows: ScreenerRow[]) {
  return marketSnapshotHealth(rows).fresh;
}

function marketSnapshotIsUsable(rows: ScreenerRow[]) {
  const now = Date.now();
  return marketSnapshotHealth(rows, now).complete && rows.filter(row => row.netuid > 0).every(row => {
    const time = Date.parse(row.time || "");
    return Number.isFinite(time) && time <= now + 60_000 && now - time <= MARKET_SNAPSHOT_CACHE_MAX_AGE_MS;
  });
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 18_000) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}



export type DashboardView = "screener" | "activity" | "bubbles" | "wallets";

export function Dashboard({
  appearance = "monochrome",
  initialView = "screener",
  initialRows = [],
  initialTaoUsd = 0,
  initialTaoQuote = null,
  initialDollarHistory = [],
  initialChart,
  initialCurrency = "usd",
  initialInterval = "1d",
  initialNow = 0,
}: {
  appearance?: "blue" | "monochrome";
  initialView?: DashboardView;
  initialRows?: ScreenerRow[];
  initialTaoUsd?: number;
  initialTaoQuote?: TaoQuote | null;
  initialDollarHistory?: FxPoint[];
  initialChart?: number | "tao";
  initialCurrency?: "usd" | "tao";
  initialInterval?: string;
  initialNow?: number;
}) {
  const router = useRouter();
  const chartPage = initialChart !== undefined;
  const serverRows = initialRows.filter((row) => row.netuid !== 0);
  const hasInitialRows = serverRows.length > 0;
  const initialSnapshotRef = useRef(serverRows);
  const [view, setView] = useState<DashboardView>(initialView);
  const [walletHistoryAddress, setWalletHistoryAddress] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"usd" | "tao">(initialCurrency);
  const [taoQuote, setTaoQuote] = useState<TaoQuote | null>(initialTaoQuote ?? (initialTaoUsd > 0 ? { usd: initialTaoUsd, updatedAt: 0, source: "unverified" } : null));
  const [fxNow, setFxNow] = useState(initialNow);
  const taoUsd = quoteUsable(taoQuote, fxNow) ? taoQuote!.usd : 0;
  const fxFresh = quoteFresh(taoQuote, fxNow);
  const [rawRows, setRows] = useState<ScreenerRow[]>(serverRows);
  const [dollarHistory, setDollarHistory] = useState<FxPoint[]>(initialDollarHistory);
  const rows = useMemo(() => rawRows.map(row => currencyReturns({ ...row, name: row.name?.trim() || "Unknown" }, currency, dollarHistory)), [rawRows, currency, dollarHistory]);
  const [dataState, setDataState] = useState<"loading" | "live" | "stale" | "error">(
    "loading",
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const subnetSearchRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<keyof ScreenerRow>("market_cap_tao");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [selected, setSelected] = useState(typeof initialChart === "number" ? initialChart : 64);
  const [showTaoChart] = useState(initialChart === "tao");
  const [marketDetailOpen, setMarketDetailOpen] = useState(chartPage);
  const [timeframe, setTimeframe] = useState(initialInterval);
  const [bubbleTimeframePreference, setBubbleTimeframePreference] = useState<BubbleTimeframe>("change_24h");
  const chartCardRef = useRef<HTMLDivElement>(null);
  const pulseDialog = useRef<HTMLDialogElement>(null);
  const [pulseHelp, setPulseHelp] = useState("Momentum");
  function openPulseHelp(title: string) {
    setPulseHelp(title);
    pulseDialog.current?.showModal();
  }
  const marketModalCloseRef = useRef<HTMLButtonElement>(null);
  const [chartData, setChartData] = useState<{
    key: string;
    candles: Candle[];
    rates: Candle[];
    method: string;
    notice?: string;
  }>({ key: "", candles: [], rates: [], method: "boundary" });
  const [chartRetry, setChartRetry] = useState(0);
  const [earlierHistory, setEarlierHistory] = useState({ key: "", loading: false, done: false, error: "" });
  const [chartDate, setChartDate] = useState<number | null>(null);
  const earlierBusy = useRef(false);
  const chartHistoryRun = useRef(0);
  useEffect(() => { chartHistoryRun.current += 1; earlierBusy.current = false; return () => { chartHistoryRun.current += 1; }; }, [selected, timeframe, currency, chartDate]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(false);
  const [walletInput, setWalletInput] = useState("");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletDisplay, setWalletDisplay] = useState<"wallets" | "portfolio">("wallets");
  const [hideBalances, setHideBalances] = useState(false);
  const [portfolioMetric, setPortfolioMetric] = useState<"allocation" | "value">("allocation");
  const [checking, setChecking] = useState(false);
  const [walletProgress, setWalletProgress] = useState("");
  const [walletError, setWalletError] = useState("");
  const walletPollingRef = useRef(false);
  const walletRunRef = useRef(0);
  const [walletSavedAt, setWalletSavedAt] = useState<string | null>(null);
  const [walletCacheMessage, setWalletCacheMessage] = useState("");
  const [activity, setActivity] = useState<ChainEvent[]>([]);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [activityCheckedAt, setActivityCheckedAt] = useState(0);
  const [activityCollectingSince, setActivityCollectingSince] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | "locks" | "keys">("all");
  const chartVisible = view === "screener" && marketDetailOpen;

  const saveWalletCache = useCallback((results: Wallet[], savedAt: string) => {
    try {
      if (results.length) localStorage.setItem("shizzy:wallet-cache:v1", JSON.stringify({ savedAt, wallets: results }));
      else localStorage.removeItem("shizzy:wallet-cache:v1");
      setWalletCacheMessage("");
    } catch { setWalletCacheMessage("Device storage is unavailable or full. These results are visible for this session only."); }
  }, []);

  const pollWalletJob = useCallback(async (jobId: string, total: number, run = walletRunRef.current) => {
    if (walletPollingRef.current) return;
    walletPollingRef.current = true;
    let missedPolls = 0;
    try {
      for (let attempt = 0; attempt < 240; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        if (run !== walletRunRef.current) return;
        let job: { completed?: number; total?: number; status: string; error?: string; results?: Wallet[] };
        try {
          const response = await fetch(`/api/backend/v1/wallets/jobs/${jobId}`, { cache: "no-store" });
          if (!response.ok) throw new Error(`status ${response.status}`);
          job = await response.json();
          if (run !== walletRunRef.current) return;
          missedPolls = 0;
        } catch {
          if (run !== walletRunRef.current) return;
          missedPolls += 1;
          setWalletProgress(`Reconnecting… ${missedPolls}`);
          if (missedPolls >= 48) throw new Error("The wallet lookup could not reconnect after two minutes. Refresh the page to resume the same job.");
          continue;
        }
        setWalletProgress(`Checking ${job.completed || 0} of ${job.total || total}…`);
        if (job.status === "failed") {
          try { localStorage.removeItem("shizzy:wallet-job"); } catch { /* Optional storage. */ }
          throw new Error(job.error || "The wallet lookup could not complete.");
        }
        if (job.status === "complete") {
          try { localStorage.removeItem("shizzy:wallet-job"); } catch { /* Optional storage. */ }
          const results = job.results || [];
          const savedAt = new Date().toISOString();
          setWallets(results); setWalletInput(results.map(wallet => wallet.address).join("\n")); setWalletSavedAt(savedAt); saveWalletCache(results, savedAt);
          setWalletDisplay("wallets");
          return;
        }
      }
      throw new Error("This lookup is still running after ten minutes. Refresh the page to resume the same job.");
    } finally {
      if (run === walletRunRef.current) walletPollingRef.current = false;
    }
  }, [saveWalletCache]);

  useEffect(() => () => { walletRunRef.current += 1; walletPollingRef.current = false; }, []);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested === "videos" || requested === "partners" || requested === "university") { router.replace(requested === "videos" ? "/video" : requested === "partners" ? "/partners" : "/university"); return; }
    if (requested === "wallets" || requested === "screener" || requested === "activity" || requested === "bubbles") queueMicrotask(() => setView(requested));
  }, [router]);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("shizzy:wallet-cache:v1") || "null");
      if (cached && Array.isArray(cached.wallets) && cached.wallets.length <= 100 && Number.isFinite(Date.parse(cached.savedAt)) && cached.wallets.every((w: Wallet) => w && typeof w.address === "string" && /^5[1-9A-HJ-NP-Za-km-z]{47}$/.test(w.address) && Array.isArray(w.stakes) && w.stakes.every(stake => stake && typeof stake.hotkey === "string" && Number.isInteger(stake.netuid)))) {
        queueMicrotask(() => { setWallets(cached.wallets); setWalletInput(cached.wallets.map((w: Wallet) => w.address).join("\n")); setWalletSavedAt(cached.savedAt); });
      }
      const saved = localStorage.getItem("shizzy:wallet-job");
      if (!saved) return;
      const job = JSON.parse(saved);
      if (!job?.id || !job?.total) return;
      queueMicrotask(() => {
        const run = walletRunRef.current;
        setChecking(true); setWalletError(""); setWalletProgress("Reconnecting to wallet lookup…");
        void pollWalletJob(job.id, job.total, run)
          .catch(error => { if (run === walletRunRef.current) setWalletError(error instanceof Error ? error.message : "The wallet lookup could not reconnect."); })
          .finally(() => { if (run === walletRunRef.current) { setChecking(false); setWalletProgress(""); } });
      });
    } catch { /* Device storage is optional; the tracker still works without it. */ }
  }, [pollWalletJob]);

  useEffect(() => {
    if (initialView !== "wallets") return;
    const address = new URLSearchParams(window.location.search).get("address");
    if (address && /^5[1-9A-HJ-NP-Za-km-z]{47}$/.test(address)) queueMicrotask(() => { setWalletInput(address); setWalletHistoryAddress(address); });
  }, [initialView]);

  useEffect(() => {
    if (!marketDetailOpen || chartPage) return;
    const previousOverflow = document.body.style.overflow;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    marketModalCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMarketDetailOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      opener?.focus({ preventScroll: true });
    };
  }, [marketDetailOpen, chartPage]);

  useEffect(() => {
    let cancelled = false;
    let updatedAt = latestSnapshotTime(initialSnapshotRef.current);
    if (hasInitialRows) queueMicrotask(() => {
      if (cancelled) return;
      setDataState(marketSnapshotIsFresh(initialSnapshotRef.current) ? "live" : "stale");
      setLastUpdated(updatedAt === null ? null : new Date(updatedAt));
    });
    if (!hasInitialRows) {
      try {
        const cached = JSON.parse(window.localStorage.getItem("shizzy:screener") || "null");
        const cachedRows = Array.isArray(cached?.data) ? cached.data.filter((row: ScreenerRow) => row.netuid !== 0) : [];
        if (cachedRows.length && marketSnapshotIsUsable(cachedRows)) {
          queueMicrotask(() => {
            if (cancelled) return;
            updatedAt = latestSnapshotTime(cachedRows);
            initialSnapshotRef.current = cachedRows;
            setRows(cachedRows);
            setSelected((current) => (cachedRows.some((row: ScreenerRow) => row.netuid === current) ? current : cachedRows[0].netuid));
            setDataState(marketSnapshotIsFresh(cachedRows) ? "live" : "stale");
            setLastUpdated(new Date(Date.now() - marketSnapshotAge(cachedRows)));
          });
        }
      } catch {
        try { window.localStorage.removeItem("shizzy:screener"); } catch { /* Storage is optional. */ }
      }
    }
    let refreshInFlight = false;
    const refreshMarkets = () => {
      if (document.hidden || refreshInFlight) return;
      if (updatedAt !== null) setDataState(marketSnapshotIsFresh(initialSnapshotRef.current) ? "live" : "stale");
      refreshInFlight = true;
      fetchJsonWithTimeout("/api/backend/v1/screener")
        .then((json) => {
          if (cancelled) return;
          const subnetMarkets = (json.data || []).filter((row: ScreenerRow) => row.netuid !== 0);
          if (subnetMarkets.length) {
            initialSnapshotRef.current = subnetMarkets;
            setRows(subnetMarkets);
            setSelected((current) => (subnetMarkets.some((row: ScreenerRow) => row.netuid === current) ? current : subnetMarkets[0].netuid));
            setDataState(marketSnapshotIsFresh(subnetMarkets) ? "live" : "stale");
            updatedAt = latestSnapshotTime(subnetMarkets);
            setLastUpdated(updatedAt === null ? null : new Date(updatedAt));
            persistMarketSnapshot(json.data, () => window.localStorage);
          } else {
            throw new Error("Empty market snapshot");
          }
        })
        .catch(() => {
          if (!cancelled) setDataState(updatedAt === null ? "error" : marketSnapshotIsFresh(initialSnapshotRef.current) ? "live" : "stale");
        })
        .finally(() => { refreshInFlight = false; });
    };
    refreshMarkets();
    const refreshTimer = window.setInterval(refreshMarkets, view === "bubbles" ? 6_000 : 12_000);
    document.addEventListener("visibilitychange", refreshMarkets);
    window.addEventListener("focus", refreshMarkets);
    window.addEventListener("online", refreshMarkets);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", refreshMarkets);
      window.removeEventListener("focus", refreshMarkets);
      window.removeEventListener("online", refreshMarkets);
    };
  }, [hasInitialRows, view]);
  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    try {
      const cached = JSON.parse(window.localStorage.getItem("shizzy:fx-history") || "[]");
      if (Array.isArray(cached)) queueMicrotask(() => setDollarHistory(previous => mergeFxHistory(cached, previous)));
    } catch { /* A corrupt or unavailable browser cache must not block live rates. */ }
    const refreshHistory = async () => {
      if (document.hidden || refreshing) return;
      refreshing = true;
      try {
        const response = await fetch("/api/tao-history", { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled && Array.isArray(payload.data)) setDollarHistory(previous => {
          return mergeFxHistory(previous, payload.data);
        });
      } catch { /* Missing or stale rates render as unavailable, never as TAO returns. */ }
      finally { refreshing = false; }
    };
    void refreshHistory();
    const timer = window.setInterval(refreshHistory, 10_000);
    document.addEventListener("visibilitychange", refreshHistory);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshHistory);
    };
  }, []);
  useEffect(() => {
    if (!dollarHistory.length) return;
    try { window.localStorage.setItem("shizzy:fx-history", JSON.stringify(dollarHistory)); }
    catch { /* Storage can be disabled or full. */ }
  }, [dollarHistory]);
  useEffect(() => {
    let active = true, inFlight = false;
    const controller = new AbortController();
    const refreshTaoPrice = async () => {
      if (active) setFxNow(Date.now());
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch("/api/tao-price", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]) });
        if (!response.ok) throw new Error("FX unavailable");
        const quote = await response.json() as TaoQuote;
        if (active && quoteUsable(quote)) setTaoQuote(quote);
      } catch { /* Keep original quote time; ageing visibly marks or expires it. */ }
      finally { inFlight = false; if (active) setFxNow(Date.now()); }
    };
    void refreshTaoPrice();
    const timer = window.setInterval(refreshTaoPrice, 12_000);
    document.addEventListener("visibilitychange", refreshTaoPrice);
    return () => { active = false; controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshTaoPrice); };
  }, []);
  useEffect(() => {
    if (!chartVisible) return;
    let activeRequest = true;
    let refreshing = false;
    const historyKey = `${showTaoChart ? "tao" : selected}:${timeframe}${chartDate === null ? "" : `:${chartDate}`}`;
    const cacheKey = `${historyKey}:${showTaoChart ? "usd" : currency}`;
    const cached = candleCache.get(historyKey);
    const cachedRates = candleCache.get(`tao:${timeframe}${chartDate === null ? "" : `:${chartDate}`}`);
    queueMicrotask(() => {
      if (!activeRequest) return;
      setChartData({ key: cacheKey, candles: cached?.data || [], rates: cachedRates?.data || [], method: cached?.method || "boundary", notice: cached?.notice || cachedRates?.notice });
      setChartLoading(!cached?.data.length || (!showTaoChart && currency === "usd" && !cachedRates?.data.length));
      setChartError(false);
    });
    const refreshChart = () => {
      if (document.hidden || refreshing) return;
      refreshing = true;
      Promise.all([
        loadChartHistory(showTaoChart ? "tao" : selected, timeframe, chartDate ?? undefined),
        !showTaoChart && currency === "usd" ? loadChartHistory("tao", timeframe, chartDate ?? undefined) : Promise.resolve(null),
      ])
        .then(([history, rates]) => {
          if (activeRequest) {
            setChartData(previous => ({ key: cacheKey, candles: mergeChartCandles(previous.key === cacheKey ? previous.candles : [], history.data), rates: mergeChartCandles(previous.key === cacheKey ? previous.rates : [], rates?.data || []), method: previous.key === cacheKey && previous.method === "extended-price" ? "extended-price" : history.method, notice: history.notice || rates?.notice }));
            if (history.done) setEarlierHistory(previous => previous.key === cacheKey && previous.loading ? previous : { key: cacheKey, loading: false, done: true, error: "" });
            setChartLoading(false);
            setChartError(false);
          }
        })
        .catch(() => {
          if (activeRequest) {
            setChartLoading(false);
            setChartError(true);
          }
        }).finally(() => { refreshing = false; });
    };
    refreshChart();
    const refreshTimer = chartDate === null ? window.setInterval(refreshChart, 30_000) : undefined;
    return () => {
      activeRequest = false;
      window.clearInterval(refreshTimer);
    };
  }, [selected, timeframe, showTaoChart, currency, chartVisible, chartRetry, chartDate]);

  useEffect(() => {
    if (view !== "activity") return;
    const refreshActivity = () => {
      if (document.hidden) return;
      fetch("/api/backend/v1/activity?limit=200", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((json) => {
          setActivityCheckedAt(Date.now());
          setActivity(json.data || []);
          setActivitySummary(json.summary || null);
          setActivityCollectingSince(json.collecting_since || null);
        })
        .catch(() => undefined);
    };
    refreshActivity();
    const refreshTimer = window.setInterval(refreshActivity, 60_000);
    return () => window.clearInterval(refreshTimer);
  }, [view]);

  const filtered = useMemo(() => rows.filter((r) => matchesSubnetQuery(r, query)).sort((a, b) => sort === "liquidation_diff_pct"
    ? compareLiquidation(a.liquidation_diff_pct, b.liquidation_diff_pct, sortDirection)
    : (sortDirection === "desc" ? Number(b[sort] ?? 0) - Number(a[sort] ?? 0) : Number(a[sort] ?? 0) - Number(b[sort] ?? 0))), [rows, query, sort, sortDirection]);
  const hasMarketData = rows.length > 0;
  const active = rows.find((r) => r.netuid === selected) || rows[0];
  const portfolioAssets = useMemo(() => {
    const assets = new Map<string, PortfolioAsset>();
    const add = (key: string, netuid: number | null, name: string, symbol: string, alpha: number, taoValue: number, address: string) => {
      const existing = assets.get(key) || {
        key,
        netuid,
        name,
        symbol,
        alpha: 0,
        taoValue: 0,
        wallets: new Set<string>(),
      };
      existing.alpha += Number.isFinite(alpha) ? alpha : 0;
      existing.taoValue += Number.isFinite(taoValue) ? taoValue : 0;
      existing.wallets.add(address);
      assets.set(key, existing);
    };
    wallets.forEach((wallet) => {
      const free = Number(wallet.free_tao || 0);
      if (free > 0) add("tao", null, "Bittensor", "TAO", free, free, wallet.address);
      wallet.stakes.forEach((stake) => add(`sn-${stake.netuid}`, stake.netuid, stake.name || "Unknown", stake.symbol || `SN${stake.netuid}`, Number(stake.alpha || 0), Number(stake.tao_value || 0), wallet.address));
    });
    return [...assets.values()].filter((asset) => asset.alpha > 0 || asset.taoValue > 0).sort((a, b) => b.taoValue - a.taoValue);
  }, [wallets]);
  const portfolioTotal = portfolioAssets.reduce((sum, asset) => sum + asset.taoValue, 0);
  const portfolioChartAssets = portfolioAssets;
  const portfolioGradient = useMemo(() => {
    if (!portfolioTotal) return "#0a1731";
    let cursor = 0;
    return `conic-gradient(${portfolioChartAssets
      .map((asset, index) => {
        const start = cursor;
        cursor += (asset.taoValue / portfolioTotal) * 100;
        return `${portfolioColors[index % portfolioColors.length]} ${start}% ${cursor}%`;
      })
      .join(",")})`;
  }, [portfolioChartAssets, portfolioTotal]);
  const chartCurrency = showTaoChart ? "usd" : currency;
  const requestedChartKey = `${showTaoChart ? "tao" : selected}:${timeframe}${chartDate === null ? "" : `:${chartDate}`}:${chartCurrency}`;
  const candles = useMemo(
    () => (chartData.key === requestedChartKey ? chartData.candles : []),
    [chartData, requestedChartKey],
  );
  const chartCandles = useMemo(
    () => chartDate !== null ? candles : withLiveCandle(
      candles,
      showTaoChart ? fxFresh ? taoUsd : 0 : snapshotIsFresh(Date.parse(active?.time || ""), fxNow) ? Number(active?.price_tao || 0) : 0,
      timeframe === "1w" || timeframe === "1mo" ? "1d" : timeframe,
    ),
    [candles, showTaoChart, taoUsd, fxFresh, fxNow, active?.price_tao, active?.time, timeframe, chartDate],
  );
  const chartBars = useMemo(() => {
    const base = priceBars(chartCandles);
    const rates = chartDate !== null ? chartData.rates : withLiveCandle(chartData.rates, taoUsd, timeframe === "1w" || timeframe === "1mo" ? "1d" : timeframe);
    return calendarBars(!showTaoChart && currency === "usd" ? dollarBars(base, priceBars(rates)) : base, timeframe);
  }, [chartCandles, chartData.rates, showTaoChart, currency, timeframe, taoUsd, chartDate]);
  const missingUsdPeriods = useMemo(() => {
    if (showTaoChart || currency !== "usd") return 0;
    const rateTimes = new Set(chartData.rates.map(candle => Date.parse(candle.time)));
    return chartCandles.filter(candle => !rateTimes.has(Date.parse(candle.time))).length;
  }, [showTaoChart, currency, chartData.rates, chartCandles]);
  async function loadEarlierHistory() {
    if (earlierBusy.current || !candles.length || chartLoading) return;
    const historyKey = `${showTaoChart ? "tao" : selected}:${timeframe}${chartDate === null ? "" : `:${chartDate}`}`;
    const key = requestedChartKey, run = chartHistoryRun.current;
    const before = Math.floor(Date.parse(candles[0].time) / 1000);
    earlierBusy.current = true;
    setEarlierHistory({ key, loading: true, done: false, error: "" });
    try {
      const [history, rates] = await Promise.all([
        loadChartHistory(showTaoChart ? "tao" : selected, timeframe, before),
        !showTaoChart && currency === "usd" ? loadChartHistory("tao", timeframe, before) : Promise.resolve(null),
      ]);
      if (run !== chartHistoryRun.current) return;
      const newCandles = history.data.filter(candle => Date.parse(candle.time) < before * 1000);
      if (rates && newCandles.length && !rates.data.length) throw new Error("Earlier USD rates are unavailable for this period. Switch to TAO to inspect the subnet history.");
      const method = showTaoChart && history.method === "taostats-price" ? (chartData.method === "exchange" || chartData.method === "extended-price" ? "extended-price" : "taostats-price") : chartData.method;
      const merged = mergeChartCandles(newCandles, candles), mergedRates = mergeChartCandles(rates?.data || [], chartData.rates);
      candleCache.set(historyKey, { data: merged, savedAt: Date.now(), method, done: history.done });
      if (rates) candleCache.set(`tao:${timeframe}${chartDate === null ? "" : `:${chartDate}`}`, { data: mergedRates, savedAt: Date.now(), method: chartDate === null ? "extended-price" : "taostats-price" });
      setChartData(previous => previous.key !== key ? previous : { ...previous, candles: mergeChartCandles(newCandles, previous.candles), rates: mergeChartCandles(rates?.data || [], previous.rates), method });
      setEarlierHistory({ key, loading: false, done: history.done === true || !newCandles.length, error: "" });
    } catch (error) {
      if (run === chartHistoryRun.current) setEarlierHistory({ key, loading: false, done: false, error: error instanceof Error ? error.message : "Earlier history could not load. Please retry." });
    } finally { if (run === chartHistoryRun.current) earlierBusy.current = false; }
  }
  const chartNote = (chartData.notice ? `${chartData.notice} · ` : "") + (timeframe === "1w" || timeframe === "1mo" ? "Calendar candles from daily history · UTC · Current period incomplete · " : "") + (showTaoChart ? (chartData.method === "extended-price" ? "Coinbase recent candles · TaoStats older price history · Historical candle volume unavailable" : chartData.method === "taostats-price" ? "TaoStats historical TAO/USD price candles · Candle volume unavailable" : "Coinbase TAO/USD candles · Volume in TAO")
    : chartData.method === "taostats-alpha" ? `TaoStats candles${currency === "usd" ? ` · USD candles use historical TAO/USD rates; high/low are estimates${missingUsdPeriods > 2 ? ` · ${missingUsdPeriods} periods lack USD quotes; TAO mode retains those subnet candles` : ""}` : " · Alpha/TAO"}`
    : `${chartData.method === "boundary" ? "Interval-boundary prices; wicks and volume are estimates" : "Sampled on-chain prices; volume is estimated"}${currency === "usd" ? " · USD estimates use matching historical TAO/USD candles" : " · Alpha/TAO"}`);
  const totalVolume = rows.reduce((sum, r) => sum + Number(r.volume_24h_tao || 0), 0);
  const rankedMovers = rows.filter(row => row.netuid > 0 && row.change_1h != null && row.change_1h !== "" && Number.isFinite(Number(row.change_1h))).sort((a, b) => Number(b.change_1h || 0) - Number(a.change_1h || 0));
  const weakestMover = rankedMovers[rankedMovers.length - 1];
  const advancingMarkets = rows.filter((row) => Number(row.change_1h || 0) > 0).length;
  const decliningMarkets = rows.filter((row) => Number(row.change_1h || 0) < 0).length;
  const directionalMarkets = advancingMarkets + decliningMarkets;
  const marketsRisingPercent = directionalMarkets ? (advancingMarkets / directionalMarkets) * 100 : 0;
  const liquidityFlowTao = rows.reduce((total, row) => {
    if (row.liquidity_change_1h == null) return total;
    const reserve = Number(row.tao_reserve || 0);
    const change = Number(row.liquidity_change_1h || 0) / 100;
    return reserve > 0 && change > -1 ? total + reserve - reserve / (1 + change) : total;
  }, 0);
  const emissionLeader = [...rows].filter((row) => row.emission_change_1h != null).sort((a, b) => Number(b.emission_change_1h || 0) - Number(a.emission_change_1h || 0))[0];
  const volumePulseTotals = rows.reduce(
    (totals, row) => {
      const current = Number(row.volume_1h_tao || 0);
      const acceleration = Number(row.volume_acceleration_1h || 0);
      if (current > 0 && acceleration > 0) {
        totals.current += current;
        totals.previous += current / acceleration;
      }
      return totals;
    },
    { current: 0, previous: 0 },
  );
  const volumePulse = volumePulseTotals.previous > 0 ? volumePulseTotals.current / volumePulseTotals.previous : 0;
  const marketCapLeaders = [...rows].sort((a, b) => Number(b.market_cap_tao || 0) - Number(a.market_cap_tao || 0)).slice(0, 14);
  const bubbleRows = useMemo(
    () =>
      [...rows]
        .filter((r) => r.netuid !== 0)
        .sort((a, b) => a.netuid - b.netuid)
        .slice(0, 128),
    [rows],
  );
  const availableBubbleTimeframes = useMemo(
    () => new Set(bubbleTimeframes.filter((timeframe) => bubbleTimeframeHasCoverage(bubbleRows, timeframe))),
    [bubbleRows],
  );
  const bubbleTimeframe = resolveBubbleTimeframe(bubbleRows, bubbleTimeframePreference);
  const bubbleHistoryFallback = bubbleTimeframe !== bubbleTimeframePreference;
  const bubbleDailyHistoryRebuilding = bubbleRows.length > 0 && !availableBubbleTimeframes.has("change_24h");
  const bubbleSize = (row: ScreenerRow) => {
    const movement = Number(row[bubbleTimeframe] || 0);
    if (Math.abs(movement) <= 0.005) return 48;
    if (movement > 0) return Math.round(54 + Math.min(98, Math.pow(movement, 0.62) * 13));
    return Math.round(52 + Math.min(22, Math.sqrt(Math.abs(movement)) * 7));
  };
  const bubbleChange = (row: ScreenerRow) => row[bubbleTimeframe] as string | undefined;
  const money = (value?: string | number, price = false) => {
    if (value == null || value === "") return currency === "tao" ? "τ —" : "$—";
    const tao = Number(value ?? 0);
    if (currency === "tao") return `τ ${fmt(tao, price ? 6 : 4)}`;
    if (!taoUsd) return "$—";
    const usd = tao * taoUsd;
    return usd.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: price && usd < 1 ? 4 : 0,
      maximumFractionDigits: price ? (usd < 1 ? 6 : 2) : 0,
    });
  };
  const privateMoney = (value?: string | number, price = false) => (hideBalances ? "$••••" : money(value, price));

  function forgetWallet(address?: string) {
    clearWalletHistoryCache(address);
    if (!address || walletHistoryAddress === address) setWalletHistoryAddress(null);
    walletRunRef.current += 1; walletPollingRef.current = false;
    try { localStorage.removeItem("shizzy:wallet-job"); } catch { /* Cache saving reports storage failures below. */ }
    if (!address) {
      setChecking(false); setWalletProgress(""); setWallets([]); setWalletInput(""); setWalletSavedAt(null); setWalletError(""); setWalletDisplay("wallets");
      try { localStorage.removeItem("shizzy:wallet-cache:v1"); localStorage.removeItem("shizzy:wallet-job"); setWalletCacheMessage("Saved wallet data cleared from this device."); }
      catch { setWalletCacheMessage("Could not clear browser storage. Clear this site's data in your browser settings."); }
      return;
    }
    const remaining = wallets.filter(wallet => wallet.address !== address);
    setWallets(remaining); setWalletInput(walletInput.split(/[\s,]+/).filter(value => value && value !== address).join("\n"));
    saveWalletCache(remaining, walletSavedAt || new Date().toISOString());
    if (!remaining.length) setWalletSavedAt(null);
  }

  async function checkWallets(e: FormEvent) {
    e.preventDefault();
    setWalletError("");
    const addresses = [
      ...new Set(
        walletInput
          .split(/[\s,]+/)
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
    if (!addresses.length) return setWalletError("Paste at least one coldkey address.");
    const run = ++walletRunRef.current;
    setChecking(true);
    setWalletProgress("Starting lookup…");
    try {
      let res: Response | undefined;
      for (let attempt = 0; attempt < 7; attempt++) {
        if (run !== walletRunRef.current) return;
        try {
          res = await fetch("/api/backend/v1/wallets/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ addresses, persist: false }),
          });
          if (res.status < 500) break;
        } catch {
          res = undefined;
        }
        if (run !== walletRunRef.current) return;
        setWalletProgress("Node service reconnecting…");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      if (run !== walletRunRef.current) return;
      if (!res) throw new Error("The live wallet lookup is temporarily unavailable. Please try again shortly.");
      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const errorBody = contentType.includes("application/json") ? await res.json().catch(() => null) : null;
        const validationMessage = errorBody?.detail?.[0]?.msg?.replace(/^Value error, /, "");
        if (res.status === 422) throw new Error(validationMessage || "One or more entries are not valid Bittensor public coldkeys.");
        if (res.status === 413) throw new Error("Too many coldkeys. Paste no more than 100 at once.");
        if (res.status === 429) throw new Error("The wallet checker is busy right now. Please wait a minute and try again.");
        throw new Error("The live wallet lookup is temporarily unavailable. Your addresses were not saved; please try again shortly.");
      }
      const started = await res.json();
      if (run !== walletRunRef.current) return;
      try { localStorage.setItem("shizzy:wallet-job", JSON.stringify({ id: started.job_id, total: addresses.length })); } catch { /* Optional resume storage. */ }
      await pollWalletJob(started.job_id, addresses.length, run);
    } catch (error) {
      if (run !== walletRunRef.current) return;
      setWalletError(error instanceof Error ? error.message : "The live wallet lookup is temporarily unavailable. Please try again shortly.");
    } finally {
      if (run === walletRunRef.current) { setChecking(false); setWalletProgress(""); }
    }
  }

  function changeSort(field: keyof ScreenerRow) {
    if (sort === field) setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
    else {
      setSort(field);
      setSortDirection("desc");
    }
  }
  function openSubnetChart(netuid: number) {
    router.push(`/charts/${netuid}?currency=${currency}&interval=${timeframe}`);
  }
  function openTaoChart() {
    router.push(`/charts/tao?interval=${timeframe}`);
  }
  const chartRangeChange = chartBars.length > 1 ? (chartBars.at(-1)!.close / chartBars[0].open - 1) * 100 : null;
  const clampScore = (value: number) => Math.round(Math.max(0, Math.min(100, value)));
  const signalData = active
    ? (() => {
        const change10 = Number(active.change_10m || 0),
          change1h = Number(active.change_1h || 0),
          change24 = Number(active.change_24h || 0);
        const liquidityFlow = Number(active.liquidity_change_1h || 0),
          emissionFlow = Number(active.emission_change_1h || 0);
        const volumeAcceleration = Number(active.volume_acceleration_1h || 0);
        const marketCap = Number(active.market_cap_tao || 0),
          liquidity = Number(active.tao_reserve || 0);
        const coverage = marketCap > 0 ? (liquidity / marketCap) * 100 : 0;
        const momentum = clampScore(50 + (change10 * 0.2 + change1h * 0.45 + change24 * 0.35) * 6);
        const liquidityScore = clampScore(50 + liquidityFlow * 8);
        const emissionScore = clampScore(50 + emissionFlow * 40);
        const activityScore = clampScore(Number.isFinite(volumeAcceleration) ? volumeAcceleration * 50 : 0);
        const risk = clampScore(78 - coverage * 1.6 + Math.abs(change1h) * 5);
        return {
          change10,
          change1h,
          change24,
          liquidityFlow,
          emissionFlow,
          volumeAcceleration,
          coverage,
          momentum,
          liquidityScore,
          emissionScore,
          activityScore,
          risk,
        };
      })()
    : null;
  const sortArrow = (field: keyof ScreenerRow) => (sort === field ? (sortDirection === "desc" ? " ↓" : " ↑") : "");
  const shortKey = (value?: string) => (value ? `${value.slice(0, 6)}…${value.slice(-5)}` : "—");
  const knownValidatorNames: Record<string, string> = {
    "5E4z3h9yVhmQyCFWNbY9BPpwhx4xFiPwq3eeqmBgVF6KULde": "Tensorplex Labs",
  };
  const eventLabel = (event: ChainEvent) =>
    ({
      StakeLocked: "Conviction locked",
      StakeUnlocked: "Conviction unlocked",
      LockMoved: "Lock moved",
      PerpetualLockUpdated: event.perpetual ? "Perpetual lock enabled" : "Perpetual lock disabled",
      StakeMoved: "Stake moved",
      StakeSwapped: "Stake swapped",
      StakeTransferred: "Stake transferred",
      HotkeySwapped: "Hotkey swapped",
      HotkeySwappedOnSubnet: "Subnet hotkey swapped",
      SubnetOwnerChanged: "Subnet owner changed",
    })[event.event_type] || event.event_type;
  const subnetLabel = (netuid?: number, name?: string) => {
    if (netuid === 0) return "Root";
    if (name && name.toLowerCase() !== "deprecated") return name;
    if (netuid != null) return name ? `Retired SN${netuid}` : `SN${netuid}`;
    return "Network";
  };
  const eventSubnet = (event: ChainEvent) => subnetLabel(event.netuid, event.name);
  const eventDestination = (event: ChainEvent) => subnetLabel(event.destination_netuid, event.destination_name);
  const eventCategory = (event: ChainEvent) => (event.event_type.includes("Lock") ? "locks" : event.event_type.includes("Hotkey") || event.event_type === "SubnetOwnerChanged" ? "keys" : "stake");
  const meaningfulActivity = activity.filter((event) => !["StakeLocked", "StakeUnlocked"].includes(event.event_type) || Number(event.tao_value || 0) >= 10);
  const visibleActivity = meaningfulActivity.filter((event) => activityFilter === "all" || eventCategory(event) === activityFilter);
  const keyChangeCount = meaningfulActivity.filter((event) => eventCategory(event) === "keys").length;
  const convictionEventCount = meaningfulActivity.filter((event) => eventCategory(event) === "locks").length;
  const convictionLeaders = [...rows].sort((a, b) => Number(b.conviction_locked_pct || 0) - Number(a.conviction_locked_pct || 0));
  const emissionMovers = [...rows].filter((row) => row.emission_change_1h != null).sort((a, b) => Math.abs(Number(b.emission_change_1h || 0)) - Math.abs(Number(a.emission_change_1h || 0)));
  const liquidityMovers = [...rows].filter((row) => row.liquidity_change_1h != null).sort((a, b) => Math.abs(Number(b.liquidity_change_1h || 0)) - Math.abs(Number(a.liquidity_change_1h || 0)));
  const activityHours = activityCollectingSince ? Math.max(0, (activityCheckedAt - new Date(activityCollectingSince).getTime()) / 3_600_000) : 0;
  const activityPeriod = activityHours < 24 ? `Since tracking began · ${activityHours < 1 ? "<1" : Math.floor(activityHours)}h` : "Last 24 hours";
  const eventDescription = (event: ChainEvent) => {
    const source = eventSubnet(event),
      destination = eventDestination(event);
    if (event.event_type === "StakeLocked") return `Conviction locked on ${source}`;
    if (event.event_type === "StakeUnlocked") return `Conviction unlocked on ${source}`;
    if (event.event_type === "StakeSwapped") return `Stake swapped from ${source} into ${destination}`;
    if (event.event_type === "StakeTransferred") return `Stake transferred from ${source} to ${destination}`;
    if (event.event_type === "StakeMoved") return source === destination ? `Stake moved between hotkeys on ${source}` : `Stake moved from ${source} to ${destination}`;
    if (event.event_type === "LockMoved") return `Conviction lock moved on ${source}`;
    if (event.event_type.includes("Hotkey")) return `Hotkey changed${event.netuid != null ? ` on ${source}` : ""}`;
    if (event.event_type === "SubnetOwnerChanged") return `${source} ownership changed`;
    return eventLabel(event);
  };
  const validatorIdentity = (hotkey?: string) => {
    if (!hotkey) return null;
    const knownName = knownValidatorNames[hotkey];
    return knownName ? `${knownName} (${shortKey(hotkey)})` : shortKey(hotkey);
  };
  const eventIdentity = (event: ChainEvent) => {
    const parts: string[] = [];
    const category = eventCategory(event);
    if (event.coldkey) parts.push(`${category === "stake" || category === "locks" ? "Delegator wallet" : "Wallet"} ${shortKey(event.coldkey)}`);
    if (event.hotkey) parts.push(`${category === "stake" || category === "locks" ? "Validator" : "Hotkey"} ${validatorIdentity(event.hotkey)}`);
    if (event.destination_hotkey) parts.push(`→ ${category === "stake" || category === "locks" ? "Validator" : "Hotkey"} ${validatorIdentity(event.destination_hotkey)}`);
    else if (event.destination_coldkey) parts.push(`→ Wallet ${shortKey(event.destination_coldkey)}`);
    return parts.length ? parts.join(" · ") : "Finalized on Finney";
  };

  return (
    <main className={`shell${appearance === "monochrome" ? " home-monochrome" : ""}${chartPage ? " chart-page" : ""}`}>
      <section className="market-ticker" aria-label="Top subnet tokens by market capitalization">
        <div className="ticker-label">
          <span>Market leaders</span>
          <small>1 Hour</small>
        </div>
        <div className="ticker-window">
          <div className="ticker-track">
            {[...marketCapLeaders, ...marketCapLeaders].map((r, i) => (
              <button key={`${r.netuid}-${i}`} onClick={() => openSubnetChart(r.netuid)}>
                <span>
                  <b>{r.name || "Unknown"}</b>
                  <small>SN{r.netuid}{!snapshotIsFresh(Date.parse(r.time || ""),fxNow) && " · Delayed"}</small>
                </span>
                <strong>{money(r.price_tao, true)}</strong>
                <em className={changeClass(r.change_1h)}>
                  {Number(r.change_1h || 0) > 0 ? "+" : ""}
                  {r.change_1h == null ? "—" : `${fmt(r.change_1h)}%`}
                </em>
              </button>
            ))}
          </div>
        </div>
      </section>
      <SiteHeader
        brandArtwork={appearance === "monochrome" ? "redrawn" : "original"}
        currency={currency}
        onCurrencyChange={setCurrency}
        currencyTitle={taoUsd ? `1 TAO = ${taoUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })}` : "Loading live TAO price"}
        dataState={view === "screener" || view === "bubbles" ? dataState : undefined}
        lastUpdated={view === "screener" || view === "bubbles" ? lastUpdated : undefined}
      />

      {view === "screener" && <LivestreamBanner />}

      {view === "screener" ? (
        <>
          {!chartPage && <>
          <div className="market-overview">
            <section className="hero-strip" aria-label="Market overview">
              <div>
                <OverviewHelp title="TAO price" />
                <button type="button" className={`tao-price-tile overview-price-link ${showTaoChart ? "active" : ""}`} onClick={openTaoChart} aria-label="Open TAO price chart">
                <strong>{currency === "usd" ? money(1, true) : "τ 1"}</strong>
                <small>Open TAO / USD chart →</small>
                </button>
              </div>
              <div>
                <OverviewHelp title="24h volume" />
                <strong>{!hasMarketData || totalVolume === 0 ? "—" : money(totalVolume)}</strong>
                <small>{hasMarketData ? (dataState === "stale" ? "Last finalized snapshot" : totalVolume === 0 ? "Collecting trade history" : `Across ${rows.length} markets`) : "Loading market service"}</small>
              </div>
              <div>
                <OverviewHelp title="Top mover" />
                <strong className={changeClass(rankedMovers[0]?.change_1h)}>{rankedMovers[0]?.name || "—"}</strong>
                <small className={changeClass(rankedMovers[0]?.change_1h)}>{rankedMovers[0] ? `${Number(rankedMovers[0].change_1h || 0) > 0 ? "+" : ""}${fmt(rankedMovers[0].change_1h)}% · 1 Hour · ${currency.toUpperCase()}` : "Waiting for market data"}</small>
              </div>
              <SentimentTile rows={rawRows} state={dataState} initialNow={initialNow} />
            </section>
            <a className="shop-card" href="https://shizzyunchained.printful.me/" target="_blank" rel="noreferrer" aria-label="Shop Shizzy Unchained merchandise">
              <Image src="/shop-hat.webp" alt="Black TAO hat" width={256} height={256} sizes="(max-width: 1100px) 64px, 80px" />
              <span className="shop-card-copy">
                <small>ShizzyUnchained</small>
                <strong>Shop merch</strong>
              </span>
              <span className="shop-card-arrow" aria-hidden="true">↗</span>
            </a>
          </div>
          <section className="network-pulse panel" aria-label="Network pulse">
            <div className="network-pulse-label">
              <span>Network pulse</span>
              <small>1 Hour</small>
            </div>
            <button
              aria-haspopup="dialog" onClick={() => openPulseHelp("Markets rising")}
            >
              <span>Markets rising · {currency === "usd" ? "USD" : "TAO"}</span>
              <strong className={marketsRisingPercent >= 50 ? "positive" : "negative"}>{directionalMarkets ? `${Math.round(marketsRisingPercent)}%` : "—"}</strong>
              <small>
                {advancingMarkets} rising · {decliningMarkets} falling · {currency === "usd" ? "in USD" : "against TAO"}
              </small>
            </button>
            <button aria-haspopup="dialog" onClick={() => openPulseHelp("Weakest mover")}>
              <span>Weakest mover · {currency.toUpperCase()}</span>
              <strong className={changeClass(weakestMover?.change_1h)}>{weakestMover?.name || "—"}</strong>
              <small className={changeClass(weakestMover?.change_1h)}>{weakestMover ? `${Number(weakestMover.change_1h) > 0 ? "+" : ""}${fmt(weakestMover.change_1h)}% · 1 Hour` : "Collecting"}</small>
            </button>
            <button
              aria-haspopup="dialog" onClick={() => openPulseHelp("Liquidity flow")}
            >
              <span>Liquidity flow</span>
              <strong className={liquidityFlowTao > 0 ? "positive" : liquidityFlowTao < 0 ? "negative" : ""}>{liquidityFlowTao === 0 ? "—" : `${liquidityFlowTao > 0 ? "+" : "−"}${money(Math.abs(liquidityFlowTao))}`}</strong>
              <small>Net TAO reserve</small>
            </button>
            <button
              aria-haspopup="dialog" onClick={() => openPulseHelp("Emission")}
            >
              <span>Emission</span>
              <strong>{emissionLeader?.name || "—"}</strong>
              <small className={changeClass(emissionLeader?.emission_change_1h)}>{emissionLeader ? `${Number(emissionLeader.emission_change_1h || 0) >= 0 ? "+" : ""}${fmt(emissionLeader.emission_change_1h, 4)} pts` : "Collecting"}</small>
            </button>
            <button
              aria-haspopup="dialog" onClick={() => openPulseHelp("Volume pulse")}
            >
              <span>Volume pulse</span>
              <strong className={volumePulse >= 1 ? "positive" : volumePulse > 0 ? "negative" : ""}>{volumePulse ? `${fmt(volumePulse, 2)}×` : "—"}</strong>
              <small>vs previous hour</small>
            </button>
          </section>
          <dialog ref={pulseDialog} className={`sentiment-dialog ${metricStyles.dialog}`} aria-labelledby="pulse-help-heading" onClick={event => { if (event.target === event.currentTarget) pulseDialog.current?.close(); }}>
            <div className="sentiment-dialog-head"><h2 id="pulse-help-heading">{pulseHelp}</h2><button type="button" aria-label="Close network pulse explanation" onClick={() => pulseDialog.current?.close()}>✕</button></div>
            <MetricExplanation title={pulseHelp} />
          </dialog>
          <MarketSignals rows={rawRows} initialNow={initialNow} />
          <div className="home-promo-row">
            <Link className="insiders-home-cta tao-heads-home-cta" href={taoHeadsCommunity.path} aria-label={`Explore ${taoHeadsCommunity.name}`}>
              <Image
                src={appearance === "monochrome" ? "/tao-heads-home-v2.webp" : taoHeadsCommunity.icon}
                alt=""
                width={appearance === "monochrome" ? 312 : 1254}
                height={appearance === "monochrome" ? 240 : 1254}
                sizes="(max-width: 600px) 64px, 76px"
              />
              <span>
                <small>Your Bittensor community</small>
                <strong>{taoHeadsCommunity.name}</strong>
              </span>
              <b>Explore <i aria-hidden="true">→</i></b>
            </Link>
            <a className="university-home-cta" href="/university" aria-label="Explore Shiz University">
              <Image
                src={appearance === "monochrome" ? "/shiz-university-home-v2.webp" : "/shiz-university.webp"}
                alt="Shiz University"
                width={appearance === "monochrome" ? 312 : 512}
                height={appearance === "monochrome" ? 300 : 512}
                sizes={appearance === "monochrome" ? "(max-width: 600px) 64px, 76px" : "58px"}
              />
              <div>
                <small>Struggling with TAO?</small>
                <strong>Take a 1-on-1 class with Shizzy</strong>
                <em>Pay by class, not course.</em>
              </div>
              <b>Explore <i aria-hidden="true">→</i></b>
            </a>
          </div>
          </>}
          <div className="market-content">
            {marketDetailOpen && (
              <div className={chartPage ? "chart-page-content" : "market-modal-backdrop"} onMouseDown={chartPage ? undefined : () => setMarketDetailOpen(false)}>
                <div className={chartPage ? "chart-page-details" : "market-modal"} role={chartPage ? undefined : "dialog"} aria-modal={chartPage ? undefined : true} aria-label={showTaoChart ? "TAO market details" : `${active?.name || "Unknown"} market details`} onMouseDown={(event) => event.stopPropagation()}>
                  {!chartPage && <div className="market-modal-navigation"><button type="button" className="market-modal-back" onClick={() => setMarketDetailOpen(false)}>← Back to markets</button>
                  <button type="button" ref={marketModalCloseRef} className="market-modal-close" onClick={() => setMarketDetailOpen(false)} aria-label="Close market details">Close <span aria-hidden="true">×</span></button></div>}
                  <section className="market-grid">
                    <div ref={chartCardRef} className="chart-card panel">
                      {!hasMarketData && (
                        <div className="market-loading" role="status">
                          <i />
                          <strong>{dataState === "loading" ? "Loading market data" : "Market feed unavailable"}</strong>
                          <span>{dataState === "loading" ? "Checking the latest finalized snapshot…" : "We’ll reconnect automatically."}</span>
                        </div>
                      )}
                      {hasMarketData && (
                        <>
                          <div className="panel-head">
                            <div>
                              <p className="eyebrow chart-subnet-id">{showTaoChart ? "TAO · USD" : `SN${active?.netuid} · ${active?.symbol || "ALPHA"}`}</p>
                              <h1>{showTaoChart ? "Bittensor" : active?.name || "Unknown"}</h1>
                            </div>
                            <div className="quote">
                              <strong>
                                {showTaoChart
                                  ? taoUsd.toLocaleString("en-US", {
                                      style: "currency",
                                      currency: "USD",
                                    })
                                  : money(active?.price_tao, true)}
                              </strong>
                              <span className={changeClass(active?.change_24h)}>{active?.change_24h == null || showTaoChart ? "" : `${Number(active.change_24h) > 0 ? "+" : ""}${fmt(active.change_24h)}% · 24 Hours`}</span>
                            </div>
                          </div>
                          <>
                              {!showTaoChart && <nav className="subnet-research-nav" aria-label="Subnet sections"><a href="#subnet-price-chart">Chart</a><a href="#subnet-market-snapshot">Market snapshot ↓</a><a href="#subnet-owner-activity">Owner activity ↓</a><a href="#subnet-recent-news">Recent news ↓</a><a className="subnet-flow-link" href={`https://taoflows.app/flows?subnets=${selected}`} target="_blank" rel="noopener noreferrer" aria-label={`View SN${selected} buys and sells on TaoFlows (opens in a new tab)`}>TaoFlows ↗</a></nav>}
                              <div id="subnet-price-chart" tabIndex={-1}>
                              <TradingChart assetOptions={[{ value: "tao", label: "TAO · Bittensor" }, ...Array.from({ length: 128 }, (_, index) => { const netuid = index + 1; const row = rawRows.find(row => row.netuid === netuid); return { value: String(netuid), label: `SN${netuid} · ${row?.name || "Unknown"}` }; })]} onAssetChange={asset => asset === "tao" ? openTaoChart() : openSubnetChart(Number(asset))} onLoadEarlier={loadEarlierHistory} earlierLoading={earlierHistory.key === requestedChartKey && earlierHistory.loading} earlierDone={earlierHistory.key === requestedChartKey && earlierHistory.done} earlierError={earlierHistory.key === requestedChartKey ? earlierHistory.error : ""} historySession={requestedChartKey} historicalDate={chartDate} onHistoryDate={setChartDate} assetLabel={showTaoChart ? "TAO · Bittensor" : `SN${selected} · ${active?.name || "Unknown"}`} drawingId={showTaoChart ? "tao" : `sn${selected}`} onCurrencyChange={showTaoChart ? undefined : setCurrency} volumeAvailable={chartData.method !== "taostats-price" && chartData.method !== "extended-price"} volumeUnit={chartData.method === "taostats-alpha" ? "alpha" : "TAO"} key={showTaoChart ? "tao" : selected} appearance={appearance} bars={chartBars} currency={chartCurrency} timeframe={timeframe} onTimeframeChange={setTimeframe} loading={chartLoading} error={chartError} note={chartNote} onRetry={() => { candleCache.delete(`${showTaoChart ? "tao" : selected}:${timeframe}${chartDate === null ? "" : `:${chartDate}`}`); candleCache.delete(`tao:${timeframe}${chartDate === null ? "" : `:${chartDate}`}`); setChartRetry(value => value + 1); }} />
                              </div>
                              {chartRangeChange != null && <p className="chart-range-return">Available history <strong className={chartRangeChange >= 0 ? "positive" : "negative"}>{chartRangeChange > 0 ? "+" : ""}{chartRangeChange.toFixed(2)}%</strong> · {chartCurrency.toUpperCase()}</p>}
                              {showTaoChart ? (
                                <div className="chart-stats">
                                  <span>
                                    Pair <b>TAO / USD</b>
                                  </span>
                                  <span>
                                    Price source <b>{chartData.method === "extended-price" ? "Coinbase / TaoStats" : chartData.method === "taostats-price" ? "TaoStats" : "Coinbase"}</b>
                                  </span>
                                  <span>
                                    History <b>{candles.length} candles</b>
                                  </span>
                                </div>
                              ) : (
                                <SubnetMarketSnapshot row={active} rows={rawRows} currency={currency} taoUsd={taoUsd} delayed={dataState === "stale"} now={fxNow} />
                              )}
                          </>
                          {!showTaoChart && active && (
                              <div className="subnet-overview">
                                <div className="subnet-description">
                                  <p className="eyebrow">Owner-submitted on-chain metadata</p>
                                  <h2>What this subnet does</h2>
                                  {active.description ? <p>{active.description}</p> : <p className="metadata-empty">The subnet owner has not published a description on-chain yet.</p>}
                                  {active.additional && <details className="subnet-metadata-details"><summary>Full project metadata &amp; links</summary><p className="project-additional">{active.additional}</p></details>}
                                </div>
                                <div className="project-links">
                                  {safeProjectUrl(active.website) && (
                                    <a href={safeProjectUrl(active.website)} target="_blank" rel="noopener noreferrer">
                                      Website ↗
                                    </a>
                                  )}
                                  {safeProjectUrl(active.github_repo) && (
                                    <a href={safeProjectUrl(active.github_repo)} target="_blank" rel="noopener noreferrer">
                                      GitHub ↗
                                    </a>
                                  )}
                                  {safeProjectUrl(active.discord) && (
                                    <a href={safeProjectUrl(active.discord)} target="_blank" rel="noopener noreferrer">
                                      Discord ↗
                                    </a>
                                  )}
                                  {active.contact && (
                                    <span>
                                      Contact <b>{active.contact}</b>
                                    </span>
                                  )}
                                </div>
                              </div>
                          )}
                          {!showTaoChart && active && <SubnetOwner key={active.netuid} netuid={active.netuid} />}
                          {!showTaoChart && active && <SubnetNewsPanel key={active.netuid} netuid={active.netuid} />}
                        </>
                      )}
                    </div>

                  </section>
                  {!showTaoChart && active && signalData && (
                    <section className="trading-signals panel" aria-labelledby="signals-title">
                      <div className="signals-head">
                        <div>
                          <p className="eyebrow">On-chain research</p>
                          <h2 id="signals-title">Trading signals · {active.name || `SN${active.netuid}`}</h2>
                        </div>
                        <span>Transparent indicators · Not financial advice</span>
                      </div>
                      <div className="signal-grid">
                        <article>
                          <div>
                            <span>Momentum</span>
                            <strong>{signalData.momentum}</strong>
                          </div>
                          <i
                            style={
                              {
                                "--score": `${signalData.momentum}%`,
                              } as CSSProperties
                            }
                          />
                          <p className={signalData.momentum >= 55 ? "positive" : signalData.momentum <= 45 ? "negative" : ""}>{signalData.momentum >= 55 ? "Positive alignment" : signalData.momentum <= 45 ? "Negative alignment" : "Mixed direction"}</p>
                          <small>
                            10m {signalData.change10 >= 0 ? "+" : ""}
                            {fmt(signalData.change10)}% · 1h {signalData.change1h >= 0 ? "+" : ""}
                            {fmt(signalData.change1h)}% · 1d {signalData.change24 >= 0 ? "+" : ""}
                            {fmt(signalData.change24)}%
                          </small>
                        </article>
                        <article>
                          <div>
                            <span>Liquidity flow</span>
                            <strong>{active.liquidity_change_1h == null ? "—" : signalData.liquidityScore}</strong>
                          </div>
                          <i
                            style={
                              {
                                "--score": `${signalData.liquidityScore}%`,
                              } as CSSProperties
                            }
                          />
                          <p className={signalData.liquidityFlow > 0 ? "positive" : signalData.liquidityFlow < 0 ? "negative" : ""}>{active.liquidity_change_1h == null ? "Collecting history" : signalData.liquidityFlow > 0 ? "TAO entering pool" : signalData.liquidityFlow < 0 ? "TAO leaving pool" : "Liquidity unchanged"}</p>
                          <small>{active.liquidity_change_1h == null ? "Needs one hour of comparable reserve data" : `${signalData.liquidityFlow >= 0 ? "+" : ""}${fmt(signalData.liquidityFlow)}% TAO reserve over 1h`}</small>
                        </article>
                        <article>
                          <div>
                            <span>Emission trend</span>
                            <strong>{active.emission_change_1h == null ? "—" : signalData.emissionScore}</strong>
                          </div>
                          <i
                            style={
                              {
                                "--score": `${signalData.emissionScore}%`,
                              } as CSSProperties
                            }
                          />
                          <p className={signalData.emissionFlow > 0 ? "positive" : signalData.emissionFlow < 0 ? "negative" : ""}>{active.emission_change_1h == null ? "Collecting history" : signalData.emissionFlow > 0 ? "Allocation increasing" : signalData.emissionFlow < 0 ? "Allocation decreasing" : "Allocation steady"}</p>
                          <small>{active.emission_change_1h == null ? "Needs one hour of comparable emission data" : `${signalData.emissionFlow >= 0 ? "+" : ""}${fmt(signalData.emissionFlow, 4)} percentage points over 1h`}</small>
                        </article>
                        <article>
                          <div>
                            <span>Volume activity</span>
                            <strong>{active.volume_acceleration_1h == null ? "—" : signalData.activityScore}</strong>
                          </div>
                          <i
                            style={
                              {
                                "--score": `${signalData.activityScore}%`,
                              } as CSSProperties
                            }
                          />
                          <p>{active.volume_acceleration_1h == null ? "Collecting history" : signalData.volumeAcceleration >= 1.25 ? "Volume accelerating" : signalData.volumeAcceleration <= 0.75 ? "Volume cooling" : "Normal activity"}</p>
                          <small>{active.volume_acceleration_1h == null ? "Needs two complete hourly windows" : `${fmt(signalData.volumeAcceleration, 2)}× previous hour`}</small>
                        </article>
                        <article className="risk-signal">
                          <div>
                            <span>Risk</span>
                            <strong>{signalData.risk}</strong>
                          </div>
                          <i
                            style={
                              {
                                "--score": `${signalData.risk}%`,
                              } as CSSProperties
                            }
                          />
                          <p className={signalData.risk >= 65 ? "negative" : signalData.risk <= 35 ? "positive" : ""}>{signalData.risk >= 65 ? "Higher market risk" : signalData.risk <= 35 ? "Lower relative risk" : "Moderate market risk"}</p>
                          <small>
                            {fmt(signalData.coverage)}% liquidity coverage · {fmt(Math.abs(signalData.change1h))}% 1h volatility
                          </small>
                        </article>
                      </div>
                      <p className="signals-note">Scores compare current on-chain conditions, not future performance. Thin liquidity, missing history, and sudden chain events can make any signal unreliable.</p>
                    </section>
                  )}
                </div>
              </div>
            )}
            {!chartPage && <section className="screener panel">
              <div className="screener-head">
                <div>
                  <p className="eyebrow">Bittensor markets</p>
                  <h1>Subnet screener</h1>
                  <small>Price changes in {currency.toUpperCase()} · Rolling periods</small>
                </div>
                <label className="search">
                  <span aria-hidden="true">⌕</span>
                  <input ref={subnetSearchRef} aria-label="Search subnets by name or subnet number" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, SN51 or subnet number" />
                </label>
              </div>
              <ScrollableScreener>
                <table>
                  <thead>
                    <tr>
                      <th data-help="Position in the current sorted and filtered list.">#</th>
                      <th data-help="Subnet name and its on-chain subnet number.">
                        <button onClick={() => changeSort("netuid")}>Subnet{sortArrow("netuid")}</button>
                      </th>
                      <th data-help="Current alpha token price in the selected currency.">
                        <button onClick={() => changeSort("price_tao")}>
                          Price {currency === "usd" ? "$" : "τ"}
                          {sortArrow("price_tao")}
                        </button>
                      </th>
                      <th data-help="Current share of network emissions. Green means the emission share increased over 24 hours; red means it decreased. White means unchanged or historical data unavailable. This is emission allocation, not price performance.">
                        <button onClick={() => changeSort("emission_pct")}>Emission %{sortArrow("emission_pct")}</button>
                      </th>
                      <th data-help="Current alpha token price multiplied by circulating alpha supply, in the selected currency.">
                        <button onClick={() => changeSort("market_cap_tao")}>Market Cap{sortArrow("market_cap_tao")}</button>
                      </th>
                      <th data-help={`Rolling price change over the last 10 minutes in ${currency.toUpperCase()}. USD includes changes in TAO/USD; TAO measures alpha against TAO. Green = up, red = down. A dash means history is unavailable.`}>
                        <button onClick={() => changeSort("change_10m")}>10 Minutes{sortArrow("change_10m")}</button>
                      </th>
                      <th data-help={`Rolling price change over the last 1 hour in ${currency.toUpperCase()}. USD includes changes in TAO/USD; TAO measures alpha against TAO. Green = up, red = down. A dash means history is unavailable.`}>
                        <button onClick={() => changeSort("change_1h")}>1 Hour{sortArrow("change_1h")}</button>
                      </th>
                      <th data-help={`Rolling price change over the last 24 hours in ${currency.toUpperCase()}. USD includes changes in TAO/USD; TAO measures alpha against TAO. Green = up, red = down. A dash means history is unavailable.`}>
                        <button onClick={() => changeSort("change_24h")}>24 Hours{sortArrow("change_24h")}</button>
                      </th>
                      <th data-help={`Rolling price change over the last 7 days in ${currency.toUpperCase()}. USD includes changes in TAO/USD; TAO measures alpha against TAO. Green = up, red = down. A dash means history is unavailable.`}>
                        <button onClick={() => changeSort("change_7d")}>7 Day{sortArrow("change_7d")}</button>
                      </th>
                      <th data-help="One-epoch, subnet-wide estimate, not a validator return. APR does not compound; APY does. Open flagged estimates for stability details.">
                        <button onClick={() => changeSort("apy")}>Staker APY{sortArrow("apy")}</button>
                      </th>
                      <th data-help="Current locked alpha mass. The percentage is measured against SubnetAlphaOut (staked/outstanding alpha). Locked mass and matured conviction are separate on-chain values.">
                        <button onClick={() => changeSort("conviction_locked_pct")}>Locked Alpha{sortArrow("conviction_locked_pct")}</button>
                      </th>
                      <th data-help="Trading volume over the last 24 hours, in the selected currency.">
                        <button onClick={() => changeSort("volume_24h_tao")}>Volume{sortArrow("volume_24h_tao")}</button>
                      </th>
                      <th data-help="TAO reserve in the subnet liquidity pool, shown in the selected currency.">
                        <button onClick={() => changeSort("tao_reserve")}>Liquidity{sortArrow("tao_reserve")}</button>
                      </th>
                      <th className="liquidation-column" data-help={liquidationExplanation} aria-sort={sort === "liquidation_diff_pct" ? (sortDirection === "desc" ? "descending" : "ascending") : "none"}>
                        <button onClick={() => changeSort("liquidation_diff_pct")}>Liq Diff{sortArrow("liquidation_diff_pct")}</button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr
                        key={r.netuid}
                        className={r.netuid === selected ? "selected" : ""}
                        onClick={event => { if (!(event.target instanceof Element) || !event.target.closest("a, button, details, input, select")) openSubnetChart(r.netuid); }}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openSubnetChart(r.netuid);
                          }
                        }}
                      >
                        <td>{i + 1}</td>
                        <td>
                          <div><Link className="subnet-chart-link" href={`/charts/${r.netuid}?currency=${currency}&interval=${timeframe}`} prefetch={false} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
                            <b>{r.name || "Unknown"}</b>
                            <small>SN{r.netuid}{!snapshotIsFresh(Date.parse(r.time || ""),fxNow) && " · Delayed"}</small>
                          </Link></div>
                        </td>
                        <td>{money(r.price_tao, true)}</td>
                        <td className={`emission-cell ${changeClass(r.emission_change_24h)}`} data-help={r.emission_change_24h == null ? "24-hour emission history unavailable. Color tracks emission allocation, not price." : `Emission share ${Number(r.emission_change_24h) > 0 ? "increased" : Number(r.emission_change_24h) < 0 ? "decreased" : "was unchanged"} by ${fmt(Math.abs(Number(r.emission_change_24h)), 4)} percentage points over 24 hours. Green = increased; red = decreased. This is allocation, not price.`}>
                          {r.emission_pct == null ? "—" : `${fmt(r.emission_pct, 4)}%`}
                          <small>of each block</small>
                        </td>
                        <td>{money(r.market_cap_tao)}</td>
                        {[r.change_10m, r.change_1h, r.change_24h, r.change_7d].map((v, j) => (
                          <td key={j} className={changeClass(v)}>
                            {Number(v || 0) > 0 ? "+" : ""}
                            {v == null ? "—" : `${fmt(v)}%`}
                          </td>
                        ))}
                        <td className="apy-cell" data-help="One-epoch, subnet-wide estimate, not a validator return. APR does not compound; APY does. Open flagged estimates for stability details.">
                          <SubnetYield row={r} now={fxNow} />
                        </td>
                        <td
                          className="locked-alpha-cell"
                          data-help="Locked alpha mass; percentage of staked/outstanding alpha (SubnetAlphaOut), not matured conviction."
                        >
                          {r.conviction_locked_alpha == null ? "—" : <>{compactAlpha(r.conviction_locked_alpha)} α<small>{fmt(r.conviction_locked_pct, 2)}% of α-out</small></>}
                        </td>
                        <td>{money(r.volume_24h_tao)}</td>
                        <td>{money(r.tao_reserve)}</td>
                        <td className={`liquidation-column ${changeClass(r.liquidation_diff_pct)}`} data-help={r.liquidation_price_tao == null ? "A fresh payout estimate is unavailable." : `Estimated liquidation price: ${fmt(r.liquidation_price_tao, 6)} τ per α. ${liquidationExplanation}`}>
                          {liquidationPercent(r.liquidation_diff_pct)}
                          <small>on deregistration</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableScreener>
              {hasMarketData && filtered.length === 0 && query.trim() && <div className="subnet-search-empty">
                <div role="status"><strong>No subnets match “{query.trim()}”.</strong><p>Try a name like Lium, or a subnet number such as SN51 or 51.</p></div>
                <button type="button" onClick={() => { setQuery(""); subnetSearchRef.current?.focus(); }}>Clear search</button>
              </div>}
              <details className="liquidation-help">
                <summary>What is Liq Diff?</summary>
                <p>{liquidationExplanation}</p>
                <p>The estimate accounts for protocol-owned alpha and the subnet’s registration rules, using chain reserves and complete stake totals. A dash means fresh inputs are unavailable. <a href="https://docs.taostats.io/docs/subnet-deregistration" target="_blank" rel="noopener noreferrer">How the payout works ↗</a></p>
              </details>
            </section>}
          </div>
        </>
      ) : view === "activity" ? (
        <section className="activity-page">
          <div className="activity-hero">
            <div>
              <p className="eyebrow">Live from your node</p>
              <h1>
                Chain activity.
                <br />
                <span>Finalized and transparent.</span>
              </h1>
            </div>
            <p>Follow stake flows, conviction locks, hotkey changes, and subnet ownership events across Finney as they finalize.</p>
          </div>
          <section className="chain-intel-grid" aria-label="Subnet chain intelligence">
            <article className="conviction-board panel">
              <div className="intel-panel-head">
                <div>
                  <p className="eyebrow">Alpha lock leaderboard</p>
                  <h2>Locked alpha by subnet</h2>
                </div>
                <span>All {convictionLeaders.length} subnets · Live finalized state</span>
              </div>
              <div className="conviction-ranking">
                {convictionLeaders.map((row, index) => (
                  <button key={row.netuid} onClick={() => openSubnetChart(row.netuid)}>
                    <em>{String(index + 1).padStart(2, "0")}</em>
                    <span>
                      <b>{row.name || "Unknown"}</b>
                      <small>SN{row.netuid}</small>
                    </span>
                    <i>
                      <u
                        style={{
                          width: `${Math.min(100, Number(row.conviction_locked_pct || 0))}%`,
                        }}
                      />
                    </i>
                    <strong title="Locked alpha mass; this is distinct from matured conviction.">
                      {compactAlpha(row.conviction_locked_alpha)} α
                      <small>{fmt(row.conviction_locked_pct, 2)}% of α-out</small>
                    </strong>
                  </button>
                ))}
                {!convictionLeaders.length && <div className="intel-empty">Waiting for finalized conviction data…</div>}
              </div>
            </article>
            <div className="flow-panels">
              <article className="flow-board panel">
                <div className="intel-panel-head">
                  <div>
                    <p className="eyebrow">Emission movement</p>
                    <h2>Largest 1-hour changes</h2>
                  </div>
                  <span>Percentage points</span>
                </div>
                <div className="flow-ranking">
                  {emissionMovers.map((row) => (
                    <button key={row.netuid} onClick={() => openSubnetChart(row.netuid)}>
                      <span>
                        <b>{row.name || "Unknown"}</b>
                        <small>SN{row.netuid}</small>
                      </span>
                      <strong className={changeClass(row.emission_change_1h)}>
                        {Number(row.emission_change_1h || 0) > 0 ? "+" : ""}
                        {fmt(row.emission_change_1h, 4)}
                      </strong>
                    </button>
                  ))}
                </div>
              </article>
              <article className="flow-board panel">
                <div className="intel-panel-head">
                  <div>
                    <p className="eyebrow">Liquidity movement</p>
                    <h2>Largest 1-hour changes</h2>
                  </div>
                  <span>TAO reserves</span>
                </div>
                <div className="flow-ranking">
                  {liquidityMovers.map((row) => (
                    <button key={row.netuid} onClick={() => openSubnetChart(row.netuid)}>
                      <span>
                        <b>{row.name || "Unknown"}</b>
                        <small>SN{row.netuid}</small>
                      </span>
                      <strong className={changeClass(row.liquidity_change_1h)}>
                        {Number(row.liquidity_change_1h || 0) > 0 ? "+" : ""}
                        {fmt(row.liquidity_change_1h, 2)}%
                      </strong>
                    </button>
                  ))}
                </div>
              </article>
            </div>
          </section>
          <section className="chain-activity panel" aria-labelledby="activity-title">
            <div className="activity-head">
              <div>
                <p className="eyebrow">Finalized chain intelligence</p>
                <h2 id="activity-title">Conviction, keys, and ownership</h2>
              </div>
              <span>{activityPeriod} · Refreshes every 60 seconds</span>
            </div>
            <div className="activity-summary">
              <article>
                <span>Conviction locked</span>
                <strong>{fmt(activitySummary?.locked_tao_24h, 3)} τ</strong>
                <small>Locks worth at least 10 TAO · {activityPeriod}</small>
              </article>
              <article>
                <span>Conviction unlocked</span>
                <strong>{fmt(activitySummary?.unlocked_tao_24h, 3)} τ</strong>
                <small>Unlocks worth at least 10 TAO · {activityPeriod}</small>
              </article>
              <article>
                <span>Net conviction flow</span>
                <strong className={Number(activitySummary?.net_locked_tao_24h || 0) >= 0 ? "positive" : "negative"}>
                  {Number(activitySummary?.net_locked_tao_24h || 0) > 0 ? "+" : ""}
                  {fmt(activitySummary?.net_locked_tao_24h, 3)} τ
                </strong>
                <small>
                  {fmt(activitySummary?.locked_tao_24h, 2)} locked · {fmt(activitySummary?.unlocked_tao_24h, 2)} unlocked
                </small>
              </article>
              <article>
                <span>Key & owner changes</span>
                <strong>{keyChangeCount}</strong>
                <small>{convictionEventCount} conviction events collected</small>
              </article>
            </div>
            <div className="activity-toolbar">
              <div role="group" aria-label="Filter chain events">
                {[
                  ["all", "All activity"],
                  ["locks", "Conviction"],
                  ["keys", "Keys & owners"],
                ].map(([value, label]) => (
                  <button key={value} className={activityFilter === value ? "active" : ""} onClick={() => setActivityFilter(value as typeof activityFilter)}>
                    {label}
                  </button>
                ))}
              </div>
              <span>{visibleActivity.length} recent events</span>
            </div>
            {visibleActivity.length ? (
              <div className="activity-list">
                {visibleActivity.map((event) => (
                  <article key={`${event.block_number}-${event.event_index}`}>
                    <time>
                      {new Date(event.time).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      <small>Block {event.block_number.toLocaleString()}</small>
                    </time>
                    <span className={`event-badge ${event.event_type.toLowerCase()}`}>{eventLabel(event)}</span>
                    <div>
                      <b>{eventDescription(event)}</b>
                      <small>{eventIdentity(event)}</small>
                    </div>
                    <strong>{event.tao_value != null ? `${fmt(event.tao_value, 3)} τ` : "—"}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <div className="activity-empty">
                <b>No {activityFilter === "all" ? "" : activityFilter} events in the collected window.</b>
                <span>Try another filter. New finalized events appear automatically.</span>
              </div>
            )}
            <p className="activity-note">All tracked finalized stake movements are included. Conviction lock and unlock events worth less than 10 TAO are excluded. TAO values use the subnet price at the finalized event time. Collection began {activityCollectingSince ? new Date(activityCollectingSince).toLocaleString() : "with this deployment"}.</p>
          </section>
        </section>
      ) : view === "bubbles" ? (
        <section className="bubbles-page">
          <div className="bubbles-hero">
            <div>
              <p className="eyebrow">All 128 subnets · live market map</p>
              <h1>
                <span>Balls.</span>
              </h1>
              <p>Explore all 128 subnets. Grab a ball, toss it and watch the others move around it. Our largest balls highlight exceptional gains.</p>
            </div>
            <div className="bubble-controls" role="group" aria-label="Ball performance period">
              {[
                { value: "change_10m", label: "10 Minutes" },
                { value: "change_1h", label: "1 Hour" },
                { value: "change_24h", label: "1 Day" },
              ].map((period) => (
                <button
                  key={period.value}
                  className={bubbleTimeframe === period.value ? "active" : ""}
                  disabled={!availableBubbleTimeframes.has(period.value as BubbleTimeframe)}
                  title={!availableBubbleTimeframes.has(period.value as BubbleTimeframe) ? `${period.label} history is rebuilding` : undefined}
                  onClick={() => setBubbleTimeframePreference(period.value as BubbleTimeframe)}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bubble-legend">
            <span>
              <i className="gain" />
              Gaining
            </span>
            <span>
              <i className="flat" />
              Flat
            </span>
            <span>
              <i className="loss" />
              Falling
            </span>
            <b>
              {bubbleDailyHistoryRebuilding
                ? `1-day history rebuilding · showing ${bubbleTimeframeLabel(bubbleTimeframe)}`
                : bubbleHistoryFallback
                  ? `${bubbleTimeframeLabel(bubbleTimeframePreference)} history rebuilding · showing ${bubbleTimeframeLabel(bubbleTimeframe)}`
                : "Floating market map · large balls highlight exceptional gains"}
            </b>
          </div>
          {!hasMarketData && <p role="status">{dataState === "loading" ? "Loading finalized subnet data…" : "Ball data unavailable. Reconnecting automatically."}</p>}
          <InteractiveBubbleField
            items={bubbleRows.map(row => ({ id: row.netuid, name: row.name || "Unknown", size: bubbleSize(row), change: Number(bubbleChange(row) || 0), changeLabel: `${Number(bubbleChange(row) || 0) > 0 ? "+" : ""}${fmt(bubbleChange(row))}%`, price: money(row.price_tao, true), marketCap: money(row.market_cap_tao), liquidity: money(row.tao_reserve) }))}
            selected={selected} onSelect={setSelected} onChart={openSubnetChart} period={bubbleTimeframeLabel(bubbleTimeframe)}
          />
        </section>
      ) : view === "wallets" ? (
        <section className="wallet-page">
          <div className="wallet-intro">
            <p className="eyebrow">Portfolio intelligence</p>
            <h1>
              See every wallet.
              <br />
              <span>See the whole position.</span>
            </h1>
            <p>Paste up to 100 Bittensor coldkeys. We’ll combine free TAO, alpha positions, subnet exposure, and spot-value estimates at one finalized block.</p>
          </div>
          <form className="wallet-form panel" onSubmit={checkWallets}>
            <label htmlFor="wallets">Coldkey addresses</label>
            <p className="wallet-safety">Read-only lookup. Never enter a seed phrase, private key, or password.</p>
            <textarea id="wallets" value={walletInput} onChange={(e) => setWalletInput(e.target.value)} placeholder={"5F...\n5G...\n5H..."} />
            <div className="wallet-cache-controls"><p>Last checked wallets are saved only in this browser. Use Refresh wallets to get a new chain snapshot.</p><button type="button" onClick={() => forgetWallet()}>Clear saved wallets &amp; cache</button></div>
            {walletSavedAt && <p className="wallet-cache-status">Saved snapshot: {new Date(walletSavedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} Eastern. Holdings and TAO valuations are from that check; USD estimates use the current TAO price.</p>}
            {walletCacheMessage && <p className="wallet-cache-status" role="status">{walletCacheMessage}</p>}
            <div className="form-foot">
              <span>One public coldkey per line, space, or comma</span>
              <button disabled={checking}>{checking ? walletProgress || "Checking chain…" : wallets.length ? "Refresh wallets →" : "Check wallets →"}</button>
            </div>
            {walletError && <p className="form-error">{walletError}</p>}
          </form>
          {walletHistoryAddress && <WalletHistory key={walletHistoryAddress} address={walletHistoryAddress} hideAmounts={hideBalances} onClose={() => setWalletHistoryAddress(null)} />}
          {wallets.length > 0 && (
            <div className="portfolio-summary panel">
              <div>
                <span>Total wallets</span>
                <strong>{wallets.length}</strong>
              </div>
              <div>
                <span>Free balance</span>
                <strong>{privateMoney(wallets.reduce((s, w) => s + Number(w.free_tao || 0), 0))}</strong>
              </div>
              <div>
                <span>Staked value</span>
                <strong>{privateMoney(wallets.reduce((s, w) => s + Number(w.staked_tao_value || 0), 0))}</strong>
              </div>
              <div>
                <span>Total portfolio</span>
                <strong className="accent">{privateMoney(wallets.reduce((s, w) => s + Number(w.total_tao_value || 0), 0))}</strong>
              </div>
            </div>
          )}
          {wallets.length > 0 && (
            <div className="wallet-view-tabs" role="tablist" aria-label="Wallet results views">
              <div>
                <button role="tab" aria-selected={walletDisplay === "wallets"} className={walletDisplay === "wallets" ? "active" : ""} onClick={() => setWalletDisplay("wallets")}>
                  Wallets
                </button>
                <button role="tab" aria-selected={walletDisplay === "portfolio"} className={walletDisplay === "portfolio" ? "active" : ""} onClick={() => setWalletDisplay("portfolio")}>
                  Portfolio
                </button>
              </div>
              <button className={`balance-privacy ${hideBalances ? "active" : ""}`} aria-pressed={hideBalances} onClick={() => setHideBalances((value) => !value)}>
                {hideBalances ? "◉ Show balances" : "◉ Hide balances"}
              </button>
            </div>
          )}
          {walletDisplay === "wallets" && (
            <div className="wallet-results">
              {wallets.map((w) => (
                <article className="wallet-card panel" key={w.address}>
                  <div className="wallet-card-head">
                    <span className="wallet-ident">{w.address.slice(0, 6)}</span>
                    <div>
                      <button type="button" onClick={() => { if (walletHistoryAddress === w.address) document.getElementById("wallet-history")?.scrollIntoView({ behavior: "smooth", block: "start" }); else setWalletHistoryAddress(w.address); }} aria-label={`View recent transactions for wallet ${w.address}`} style={{ background: "transparent", color: "inherit", border: 0, padding: "8px 0", minHeight: 44, font: "inherit", fontWeight: 700, textAlign: "left", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 4 }}>
                        {w.address.slice(0, 12)}…{w.address.slice(-8)}
                      </button>
                      <small>{w.stakes.length} positions</small>
                    </div>
                    <strong>{privateMoney(w.total_tao_value)}</strong>
                    <button type="button" className="wallet-remove" disabled={checking} onClick={() => forgetWallet(w.address)} aria-label={`Remove wallet ${w.address.slice(0, 6)}…${w.address.slice(-6)} from saved tracker`}>Remove</button>
                  </div>
                  <div className="wallet-split">
                    <span>
                      Free <b>{privateMoney(w.free_tao)}</b>
                    </span>
                    <span>
                      Staked <b>{privateMoney(w.staked_tao_value)}</b>
                    </span>
                  </div>
                  <div className="positions">
                    {w.stakes.map((s, i) => (
                      <div key={`${s.hotkey}-${s.netuid}-${i}`}>
                        <span>
                          <b>SN{s.netuid}</b>
                          <small>{s.name || s.hotkey.slice(0, 7) + "…"}</small>
                        </span>
                        <span>
                          {hideBalances ? "•••• α" : `${preciseAlpha(s.alpha)} α`}
                          <small>{privateMoney(s.tao_value)}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
          {wallets.length > 0 && walletDisplay === "portfolio" && (
            <section className="portfolio-view portfolio-snapshot panel" role="tabpanel">
              <div className="portfolio-chart-head">
                <div>
                  <p className="eyebrow">Portfolio allocation</p>
                  <span>
                    {portfolioAssets.length} assets grouped across {wallets.length} wallets
                  </span>
                </div>
                <div className="portfolio-metric" aria-label="Portfolio display">
                  <button className={portfolioMetric === "allocation" ? "active" : ""} onClick={() => setPortfolioMetric("allocation")}>
                    Allocation %
                  </button>
                  <button className={portfolioMetric === "value" ? "active" : ""} onClick={() => setPortfolioMetric("value")}>
                    Value
                  </button>
                </div>
              </div>
              <div className="portfolio-snapshot-body">
                <div
                  className="portfolio-donut"
                  style={
                    {
                      "--portfolio-gradient": portfolioGradient,
                    } as CSSProperties
                  }
                  role="img"
                  aria-label={`Portfolio allocation across ${portfolioAssets.length} assets`}
                >
                  <div>
                    <span>{hideBalances ? "Balance hidden" : "Combined value"}</span>
                    <strong>{privateMoney(portfolioTotal)}</strong>
                    <small>{portfolioAssets.length} assets</small>
                  </div>
                </div>
                <div className="portfolio-legend">
                  {portfolioChartAssets.map((asset, index) => {
                    const allocation = portfolioTotal ? (asset.taoValue / portfolioTotal) * 100 : 0;
                    return (
                      <div key={asset.key}>
                        <em>{String(index + 1).padStart(2, "0")}</em>
                        <i
                          style={{
                            background: portfolioColors[index % portfolioColors.length],
                          }}
                        />
                        <span>
                          <b>
                            {asset.netuid == null ? asset.symbol : `SN${asset.netuid}`} <small>· {asset.name}</small>
                          </b>
                          <span className="portfolio-mini-bar">
                            <i
                              style={{
                                width: `${Math.max(1, allocation)}%`,
                                background: portfolioColors[index % portfolioColors.length],
                              }}
                            />
                          </span>
                        </span>
                        <span className="portfolio-amount">
                          <strong>{portfolioMetric === "allocation" ? allocationLabel(allocation) : privateMoney(asset.taoValue)}</strong>
                          {portfolioMetric === "value" && <small>{hideBalances ? `•••• ${asset.netuid == null ? "TAO" : "α"}` : `${preciseAlpha(asset.alpha)} ${asset.netuid == null ? "TAO" : "α"}`}</small>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
          {!wallets.length && (
            <div className="wallet-empty">
              <div className="radar">
                <i />
                <i />
                <i />
              </div>
              <p>Your combined portfolio will appear here.</p>
            </div>
          )}
        </section>
      ) : null}
      {view === "screener" && <MembershipPromo />}
      <footer>
        <span>SHIZZYUNCHAINED</span>
        <p>Finalized on-chain data · {currency === "usd" ? "USD returns use historical TAO/USD rates (1-minute resolution)" : "TAO-denominated values"} · Not financial advice</p>
        <b>Built on Bittensor</b>
      </footer>
    </main>
  );
}
