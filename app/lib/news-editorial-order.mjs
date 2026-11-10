/** A reviewed running order is separate from star ratings and source-desk order. */
export function validateEditorialOrder(report) {
  if (report.storyOrder === undefined) {
    if (report.date >= "2026-11-10") throw new Error("Subnet News: new editions need an explicit storyOrder. See docs/NEWS_EDITORIAL_ORDER.md.");
    return new Map();
  }
  const stories = [...report.highlights, ...report.ecosystem, ...report.subnets.flatMap(subnet => subnet.updates)];
  const headlines = new Set(stories.map(item => item.headline));
  const order = report.storyOrder;
  if (!Array.isArray(order) || order.length === 0 || order.some(headline => typeof headline !== "string" || !headlines.has(headline))) {
    throw new Error("Subnet News: storyOrder must reference published story headlines.");
  }
  if (new Set(order).size !== order.length || order.length !== headlines.size) {
    throw new Error("Subnet News: storyOrder must include every distinct headline exactly once.");
  }
  const lead = stories.find(item => item.headline === order[0]);
  if (lead.status !== "verified" || (stories.some(item => (item.rating ?? 0) >= 3) && (lead.rating ?? 0) < 3)) {
    throw new Error("Subnet News: storyOrder must start with a verified main story.");
  }
  const ratings = new Map(stories.map(item => [item.headline, item.rating ?? 0]));
  let briefsStarted = false;
  for (const headline of order) {
    if (ratings.get(headline) < 3) briefsStarted = true;
    else if (briefsStarted) throw new Error("Subnet News: minor briefs must follow the main stories in storyOrder.");
  }
  return new Map(order.map((headline, index) => [headline, index]));
}
