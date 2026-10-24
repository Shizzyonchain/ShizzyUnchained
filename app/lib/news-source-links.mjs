import { routeIsAllowed } from "./backend-routes.mjs";
const siteHosts = new Set(["shizzyunchained.com", "www.shizzyunchained.com", "shizzy-onchain-com.vercel.app"]);
/** Deterministic build gate; no network request is made by readers or builds.
 * @param {{url: string, availability?: string, unavailableReason?: string, checkedAt?: string}} source
 */
export function newsSourceIssue(source) {
 let url;
 try { url = new URL(source.url); } catch { return "must be a valid absolute URL"; }
 if (!["http:", "https:"].includes(url.protocol)) return "must use http or https";
 if (source.availability !== undefined && source.availability !== "unavailable") return "availability must be unavailable or omitted";
 if (source.availability === "unavailable") {
  if (!source.unavailableReason?.trim() || !source.checkedAt || !Number.isFinite(Date.parse(source.checkedAt))) return "unavailable evidence needs a reason and checkedAt timestamp";
  return null; // Provenance only; the UI must not turn this URL into a link.
 }
 if (siteHosts.has(url.hostname)) {
  if (/%26(?:amp;)?(?:end|start|interval|limit)=/i.test(url.search)) return "query separators must be &, not encoded inside a parameter";
  if (url.pathname.startsWith("/api/backend/")) {
   const path = url.pathname.slice("/api/backend/".length);
   if (!routeIsAllowed("GET", path)) return "backend relay does not serve this public GET path; archive durable evidence or mark the original unavailable";
  }
 }
 return null;
}
