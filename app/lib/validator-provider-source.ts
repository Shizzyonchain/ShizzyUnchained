import "server-only";
import { getCache } from "@vercel/functions";
import { cachedValidatorCollection, validatorSourceTtl, type SourcePage } from "./validator-source-cache";

const inFlight = new Map<string, Promise<unknown[]>>();
export function validatorCollection<T>(path: string, filters: Record<string, string>, key: string): Promise<T[]> {
  const identity = JSON.stringify([path, Object.entries(filters).sort()]);
  const pending = inFlight.get(identity);
  if (pending) return pending as Promise<T[]>;
  const task = cachedValidatorCollection<T>(getCache({ namespace: "validator-shared-source-v3" }), identity, validatorSourceTtl(path), async page => {
    const url = new URL(path, "https://api.taostats.io");
    Object.entries({ ...filters, limit: "200", page: String(page) }).forEach(([name, value]) => url.searchParams.set(name, value));
    const response = await fetch(url, { headers: { Authorization: key }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!response.ok) {
      if (response.status === 429) throw new Error("Validator provider rate limited; previous recommendations retained.");
      throw new Error("A required validator source is unavailable.");
    }
    console.info("Validator provider request", path, "page", page);
    return await response.json() as SourcePage<T>;
  }).finally(() => inFlight.delete(identity));
  inFlight.set(identity, task);
  return task;
}
