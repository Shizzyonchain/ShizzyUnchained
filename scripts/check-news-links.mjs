import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { newsSourceIssue } from "../app/lib/news-source-links.mjs";
const publicRoot = resolve(fileURLToPath(new URL("../public/", import.meta.url)));
const owned = new Set(["shizzyunchained.com", "www.shizzyunchained.com", "shizzyunchained.vercel.app", "shizzy-onchain-com.vercel.app"]);
export function collectNewsSources(value) {
 if (!value || typeof value !== "object") return [];
 if (Array.isArray(value)) return value.flatMap(collectNewsSources);
 return [...(Array.isArray(value.sources) ? value.sources : []), ...Object.entries(value).filter(([key]) => key !== "sources").flatMap(([, entry]) => collectNewsSources(entry))];
}
// External X/Discord URLs still require the editorial source-access review.
// Fetch statuses only; a live response is never historical evidence by itself.
export async function checkOwnedNewsLinks(report, request = fetch) {
 const sources = collectNewsSources(report);
 for (const source of sources) { const issue = newsSourceIssue(source); if (issue) throw new Error(`${source.url}: ${issue}`); }
 const urls = [...new Set(sources.filter(source => source.availability !== "unavailable" && owned.has(new URL(source.url).hostname)).map(source => source.url))];
 const results = [];
 let next = 0;
 await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => {
  while (next < urls.length) {
   const url = urls[next++]; const parsed = new URL(url);
   const local = resolve(publicRoot, "." + decodeURIComponent(parsed.pathname));
   if (local.startsWith(publicRoot + sep) && existsSync(local) && statSync(local).isFile()) { results.push({ url, status: "local public asset" }); continue; }
   const response = await request(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10000) });
   await response.body?.cancel();
   results.push({ url, status: response.status });
   if (!response.ok) throw new Error(`News source ${url} returns ${response.status}; replace with durable evidence or explicitly mark unavailable.`);
  }
 }));
 return { checked: results, unavailable: sources.filter(source => source.availability === "unavailable").length, externalManualReview: sources.filter(source => !owned.has(new URL(source.url).hostname)).length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 if (!process.argv[2]) throw new Error("Usage: node scripts/check-news-links.mjs report.json");
 console.log(JSON.stringify(await checkOwnedNewsLinks(JSON.parse(readFileSync(process.argv[2], "utf8"))), null, 2));
}
