export function tradingVolume(value: unknown): number | null {
  if (value == null || value === "" || typeof value === "boolean") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function marketVolume(rows: { netuid: number; volume_24h_tao?: unknown }[]) {
  const markets = rows.filter(row => row.netuid > 0);
  const values = markets.map(row => tradingVolume(row.volume_24h_tao));
  const available = values.filter(value => value !== null);
  return {
    total: markets.length > 0 && available.length === markets.length
      ? available.reduce((sum, value) => sum + value, 0) : null,
    available: available.length,
    markets: markets.length,
  };
}

export type TradingVolumeSnapshot = { buy: number; sell: number; count: number; asOf: string; windowStart?: string; delayed?: boolean };

// The aggregate trade window survives subnet re-registration, unlike the sum
// of lifetime subnet counter differences. Reuse the Buyers vs Sellers feed.
export function finalizedMarketVolume(snapshot: TradingVolumeSnapshot | null, now: number): number | null {
  if (!snapshot || snapshot.count !== 128) return null;
  const age = now - Date.parse(snapshot.asOf);
  if (!Number.isFinite(age) || age < -60000 || age > 21600000) return null;
  if (snapshot.windowStart && Date.parse(snapshot.asOf) - Date.parse(snapshot.windowStart) !== 86400000) return null;
  const buy = tradingVolume(snapshot.buy), sell = tradingVolume(snapshot.sell);
  return buy === null || sell === null ? null : buy + sell;
}

export function subnetDisplayName(row: { netuid: number; name?: string | null }): string {
  const name = row.name?.trim();
  return !name || /^(unknown|unnamed)$/i.test(name) ? `SN${row.netuid}` : name;
}
