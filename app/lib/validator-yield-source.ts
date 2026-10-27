import "server-only";
import { loadCandidates } from "./validator-candidates";
import { readSubnetRecommendations } from "./subnet-recommendation-preparation";

export async function yieldBackend(path: string, init: RequestInit = {}) {
  if (!process.env.BACKEND_API_URL || !process.env.BACKEND_API_KEY) throw new Error("Yield checks unavailable");
  return fetch(new URL(path, process.env.BACKEND_API_URL), {
    ...init, cache: "no-store", signal: AbortSignal.timeout(4000),
    headers: { "Content-Type": "application/json", "X-API-Key": process.env.BACKEND_API_KEY },
  });
}

export async function queueYieldCheck(netuid: number, watch = true) {
  const prepared = await readSubnetRecommendations(netuid);
  const source = prepared && prepared.candidates.filter(row => Number.isSafeInteger(row.yieldBlock) && row.timestamps[0]).every(row => {
    const age = Date.now() - Date.parse(row.timestamps[0]);
    return age >= -60000 && age < 5400000;
  }) ? prepared : await loadCandidates(netuid);
  const rows = source.candidates.filter(row => Number.isSafeInteger(row.yieldBlock) && row.timestamps[0]).map(row => ({
    hotkey: row.hotkey, block: row.yieldBlock, timestamp: row.timestamps[0], seven: row.yield7, thirty: row.yield30,
  }));
  if (!rows.length || rows.length > 512) throw new Error("No complete bounded yield snapshot");
  const response = await yieldBackend("/v1/validators/yield-checks", { method: "POST", body: JSON.stringify({ netuid, rows, watch }) });
  if (!response.ok) throw new Error("Background yield check could not be queued");
  return response.json();
}
