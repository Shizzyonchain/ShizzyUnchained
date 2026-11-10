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
