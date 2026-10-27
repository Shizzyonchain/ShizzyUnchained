/** Hourly network replays are deliberately not an indexed-provider fallback. */
export async function nodeFirstTrading<T>(period: "1h" | "24h", node: () => Promise<T>, dailyBackup: () => Promise<T>): Promise<T> {
  try { return await node(); }
  catch (error) {
    if (period === "1h") throw error;
    return dailyBackup();
  }
}
