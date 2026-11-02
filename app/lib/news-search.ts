import type { SubnetNewsBrief, NewsItem } from "./subnet-news";
export type SearchStory = { date: string; netuid: number | null; name: string; item: NewsItem; key: string };
const normalize = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function indexNews(reports: SubnetNewsBrief[]): SearchStory[] {
  return reports.flatMap(report => {
    const seen = new Set<string>();
    const candidates = [...report.subnets.flatMap(subnet => subnet.updates.map(item => ({ netuid: subnet.netuid, name: subnet.name, item }))), ...report.ecosystem.map(item => ({ netuid: null, name: "Ecosystem", item })), ...report.highlights.map(item => ({ netuid: null, name: "Edition highlight", item }))];
    return candidates.filter(row => { const key = normalize(row.item.headline); if (seen.has(key)) return false; seen.add(key); return true; }).map((row, i) => ({ ...row, date: report.date, key: `${report.date}-${i}` }));
  }).sort((a, b) => b.date.localeCompare(a.date));
}
export function searchNews(rows: SearchStory[], filters: { query?: string; subnet?: string; status?: string; minimum?: number; from?: string; to?: string }) {
  const terms = normalize(filters.query || "").split(/\s+/).filter(Boolean);
  return rows.filter(row => (!filters.subnet || (filters.subnet === "ecosystem" ? row.netuid === null : String(row.netuid) === filters.subnet)) && (!filters.status || row.item.status === filters.status) && (!filters.minimum || (row.item.rating ?? 0) >= filters.minimum) && (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to) && terms.every(term => normalize(`${row.item.headline} ${row.item.summary} ${row.name} ${row.netuid === null ? "" : `SN${row.netuid}`}`).includes(term)));
}
