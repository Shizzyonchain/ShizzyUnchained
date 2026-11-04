export type RankingMode = "balanced" | "yield" | "fees" | "decentralization";
export type Candidate = {
  operation?: "direct" | "delegated" | "unverified"; operators?: string[]; operatorIdentities?: { hotkey: string; name: string | null }[]; hotkey: string; name: string; take: number | null; yield7: number | null; yield30: number | null;
  participation7: number | null; participation30: number | null;
  active: boolean; permit: boolean; updated: number | null; cutoff: number | null;
  stakeShare: number | null; dividends: number | null; registered: string | null;
  // First timestamp is the historical yield measurement; the remainder describe
  // current identity, activity parameters, delegation and operating neurons.
  timestamps: string[]; yieldBasis: "nominator-net" | "chain-net" | "unknown";
  yieldBlock?: number;
  apr7?: number | null; apr30?: number | null;
};
export type RankedCandidate = Candidate & { score: number | null; reasons: string[]; excluded: string[]; consistency: number | null };
const weights: Record<RankingMode, number[]> = {
  balanced: [30, 25, 25, 10, 10, 0], yield: [60, 20, 10, 5, 5, 0],
  fees: [15, 15, 20, 5, 10, 35], decentralization: [15, 20, 20, 5, 40, 0],
};
const valid = (n: number | null): n is number => n !== null && Number.isFinite(n);

export function rankValidators(candidates: Candidate[], mode: RankingMode, now: number): RankedCandidate[] {
  const usesChain = candidates.some(candidate => candidate.yieldBasis === "chain-net");
  const reviewed = candidates.map(candidate => {
    const excluded: string[] = [];
    if (candidate.yieldBasis !== "nominator-net" && candidate.yieldBasis !== "chain-net") excluded.push("Yield after validator take could not be established");
    if (usesChain && candidate.yieldBasis !== "chain-net") excluded.push("Comparable node-calculated yield history required; provider rates cannot enter this ranking");
    if (!candidate.active || !candidate.permit) excluded.push("No fully verified active validator path in the snapshot");
    if (!valid(candidate.updated) || !valid(candidate.cutoff) || candidate.cutoff <= 0 || candidate.updated < 0 || candidate.updated > candidate.cutoff) excluded.push("Recent weight-update activity could not be established");
    if (![candidate.yield7, candidate.yield30].every(n => valid(n) && n > 0)) excluded.push("Positive 7d and 30d yield measurements required");
    if (![candidate.participation7, candidate.participation30].every(n => valid(n) && n >= .9 && n <= 1)) excluded.push("At least 90% reported participation in both windows required");
    if (!valid(candidate.take) || candidate.take < 0 || candidate.take > 1) excluded.push("Fee unavailable or invalid");
    if (!valid(candidate.stakeShare) || candidate.stakeShare < 0 || candidate.stakeShare > 1) excluded.push("Subnet stake share unavailable");
    if (!valid(candidate.dividends) || candidate.dividends <= 0) excluded.push("No positive validator dividends in the snapshot");
    const created = Date.parse(candidate.registered || "");
    if (!Number.isFinite(created) || now - created < 30 * 86400_000) excluded.push("Hotkey registration history shorter than 30 days or unknown");
    const times = candidate.timestamps.map(t => Date.parse(t));
    if (times.length < 4 || times.some(t => !Number.isFinite(t) || now - t > 2 * 3600_000 || t > now + 60_000)) excluded.push("Required snapshots missing, over two hours old or invalid");
    // Rolling 7d/30d returns need not be measured at the same instant as current
    // activity. Keep the two-hour age bound on EVERY source, while requiring
    // the operational snapshots (including delegation) to agree within an hour.
    else if (Math.max(...times.slice(1)) - Math.min(...times.slice(1)) > 3600_000) excluded.push("Operational source snapshots are more than an hour apart");
    const consistency = valid(candidate.yield7) && valid(candidate.yield30) && candidate.yield7 > 0 && candidate.yield30 > 0 ? Math.min(candidate.yield7, candidate.yield30) / Math.max(candidate.yield7, candidate.yield30) : null;
    return { ...candidate, excluded, consistency, score: null, reasons: [] } as RankedCandidate;
  });
  const eligible = reviewed.filter(c => !c.excluded.length);
  for (const row of eligible) {
    const conservativeYield = Math.min(row.yield7!, row.yield30!);
    const yieldRank = eligible.length <= 1 ? .5 : eligible.filter(other => Math.min(other.yield7!, other.yield30!) < conservativeYield).length / (eligible.length - 1);
    const signals = [yieldRank, row.consistency!, Math.min(row.participation7!, row.participation30!), 1 - row.updated! / row.cutoff!, 1 - row.stakeShare!, 1 - row.take!];
    row.score = Math.round(signals.reduce((sum, signal, index) => sum + Math.max(0, Math.min(1, signal)) * weights[mode][index], 0) * 10) / 10;
    row.reasons = [
      row.yieldBasis === "chain-net"
        ? `Node 7d net APY ${(row.yield7! * 100).toFixed(2)}% · 30d net APY ${(row.yield30! * 100).toFixed(2)}%`
        : `Provider 7d annualized rate ${(row.yield7! * 100).toFixed(2)}% · 30d rate ${(row.yield30! * 100).toFixed(2)}% · compounding method unconfirmed`,
      `${(row.consistency! * 100).toFixed(0)}% agreement between yield windows`,
      `At least ${(Math.min(row.participation7!, row.participation30!) * 100).toFixed(1)}% reported epoch participation`,
      `${row.operation === "delegated" ? "Verified child permits" : "Active direct permit"} · weight update ${row.updated} blocks ago (cutoff ${row.cutoff})`,
      `${(row.take! * 100).toFixed(2)}% take · ${(row.stakeShare! * 100).toFixed(2)}% of direct-validator stake weight`,
    ];
  }
  return reviewed.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.take ?? 2) - (b.take ?? 2) || a.hotkey.localeCompare(b.hotkey));
}
