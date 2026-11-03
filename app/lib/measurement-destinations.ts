// Fixed labels only: never send URL parameters or a visitor's saved subnet list.
const sections: Record<string, string> = {
  "/subnet-news": "daily_news", "/sectors": "sectors", "/validators": "validators",
  "/validators/root": "root", "/video": "videos", "/university": "classes", "/partners": "partners",
  "/subnet-news/toolkit": "toolkit", "/subnet-news/tao-returns": "tao_returns",
  "/subnet-news/holding-periods": "holding_returns", "/subnet-news/seasonality": "seasonality",
  "/subnet-news/recovery-math": "recovery_math", "/subnet-news/etao": "etao",
  "/subnet-news/burns": "burns", "/subnet-news/split-finder": "split_finder",
  "/subnet-news/split-compare": "split_compare", "/subnet-news/watchlist": "news_watchlist",
  "/subnet-news/search": "news_search",
};
const partners: Record<string, string> = { "taoflows.app": "taoflows", "saygm.com": "saygm", "engy.ai": "engy", "lium.io": "lium", "t.me": "telegram" };

export function measurementDestination(href: string, base: string): string | undefined {
  try {
    const url = new URL(href, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (url.origin !== new URL(base).origin) return partners[url.hostname];
    const path = url.pathname.replace(/\/$/, "") || "/";
    // Same-page anchors are navigation within a tool, not a new destination.
    if (url.hash && path === new URL(base).pathname.replace(/\/$/, "")) return undefined;
    return sections[path];
  } catch { return undefined; }
}
