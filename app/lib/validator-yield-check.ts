import type { Candidate } from "./validator-ranking";

export type YieldWindow = {
  status: "consistent" | "review" | "basis-review" | "unavailable"; reason?: string;
  chainApy?: number; chainApr?: number; providerApy?: number; observedReturn?: number;
  difference?: number; tolerance?: number; startBlock?: number; endBlock?: number;
  start?: string; end?: string;
};
export type YieldCheck = { hotkey: string; providerBlock: number; providerTimestamp: string; seven: YieldWindow; thirty: YieldWindow };
export type YieldChecks = { netuid: number; state: string; error?: string; result?: { methodVersion?: number; checkedAt: string; rows: YieldCheck[] } };
export function currentYieldCheck(check: YieldCheck | undefined, block: number | undefined, timestamp: string, now: number) {
  const time = Date.parse(timestamp);
  return check && check.providerBlock === block && Date.parse(check.providerTimestamp) === time && Number.isFinite(time) && now - time <= 7200000 && time <= now + 60000 ? check : undefined;
}

export function chainYield(check: YieldCheck | undefined) {
  if (!check) return null;
  const values = [check.seven.chainApy, check.thirty.chainApy, check.seven.chainApr, check.thirty.chainApr];
  if (check.seven.status === "unavailable" || check.thirty.status === "unavailable" || values.some(value => typeof value !== "number" || !Number.isFinite(value))) return null;
  return { yield7: check.seven.chainApy!, yield30: check.thirty.chainApy!, apr7: check.seven.chainApr!, apr30: check.thirty.chainApr! };
}

export function yieldCandidates(candidates: Candidate[], checks: YieldChecks | null, netuid: number | undefined, now: number) {
  const byHotkey = new Map((checks && checks.netuid === netuid && checks.state === "ready" && checks.result?.methodVersion === 4 ? checks.result.rows : []).map(row => [row.hotkey, row]));
  const measured = candidates.map(row => chainYield(currentYieldCheck(byHotkey.get(row.hotkey), row.yieldBlock, row.timestamps[0], now)));
  if (measured.filter(Boolean).length < 2) return { source: "provider" as const, candidates };
  return { source: "chain" as const, candidates: candidates.map((row, index): Candidate => measured[index]
    ? { ...row, ...measured[index], yieldBasis: "chain-net" }
    : { ...row, yield7: null, yield30: null, apr7: null, apr30: null, yieldBasis: "unknown" }) };
}

// Only a change in the actual yield evidence restarts the independent check.
export function yieldSnapshotKey(candidates: Pick<Candidate, "hotkey" | "yieldBlock" | "timestamps">[]) {
  return candidates.map(row => `${row.hotkey}:${row.yieldBlock ?? ""}:${row.timestamps[0] || ""}`).sort().join("|");
}

// Invert this site's chain APY annualization; provider compounding is unconfirmed.
export function thirtyDayRewardGrowth(row: Pick<Candidate, "yieldBasis" | "yield30">) {
  if (row.yieldBasis !== "chain-net" || row.yield30 === null || !Number.isFinite(row.yield30) || row.yield30 <= -1) return null;
  const growth = Math.expm1(Math.log1p(row.yield30) * 30 / 365);
  return Number.isFinite(growth) ? growth : null;
}
