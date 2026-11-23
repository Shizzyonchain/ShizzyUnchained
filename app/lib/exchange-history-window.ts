/** Fixed-window paging must include a complete previous window at rollover. */
export function exchangeHistoryWindows(interval: string, now: number) {
  const granularity = interval === "10m" ? 300 : interval === "1h" ? 3600 : 60;
  const span = 299 * granularity;
  const boundary = Math.floor(now / 1000 / span) * span;
  return Array.from({ length: interval === "10m" ? 3 : 2 }, (_, index) => ({
    start: boundary - index * span,
    end: index === 0 ? Math.floor(now / 60000) * 60 : boundary - (index - 1) * span,
  }));
}
