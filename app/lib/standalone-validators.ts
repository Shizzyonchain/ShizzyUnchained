import { rememberValidatorNames } from "./validator-metadata-source";
import "server-only";
import { unstable_cache } from "next/cache";
import { getCache } from "@vercel/functions";
import { packChildIndex, unpackChildIndex } from "./child-hotkey-cache";
import { scanChildHotkeys } from "./child-hotkey-storage";
import { validatorCollection } from "./validator-provider-source";
import type { Validator } from "./validator-types";

const getPackedChildHotkeys = unstable_cache(async () => {
  const endpoint = process.env.SUBTENSOR_HTTP_URL || "https://entrypoint-finney.opentensor.ai";
  return packChildIndex(await scanChildHotkeys(endpoint));
}, ["finalized-child-hotkeys-compact-v3"], { revalidate: 1800 });

export async function getChildHotkeys() {
  const cache = getCache({ namespace: "finalized-validator-family-v1" });
  const previous = await cache.get("complete") as ReturnType<typeof packChildIndex> | undefined;
  const age = previous ? Date.now() - Date.parse(previous.checkedAt) : Infinity;
  const usable = previous && age >= -60000 && age <= 7200000;
  if (usable && age < 1800000) return unpackChildIndex(previous);
  if (await cache.get("preparing")) {
    if (usable) return unpackChildIndex(previous);
    throw new Error("The shared validator relationship check is being prepared.");
  }
  // Best-effort shared lease; finalized evidence and age checks remain required.
  await cache.set("preparing", true, { ttl: 60 });
  try {
    const packed = previous
      ? packChildIndex(await scanChildHotkeys(process.env.SUBTENSOR_HTTP_URL || "https://entrypoint-finney.opentensor.ai"))
      : await getPackedChildHotkeys();
    if (Date.now() - Date.parse(packed.checkedAt) > 7200000) throw new Error("Validator relationship snapshot is stale.");
    await cache.set("complete", packed, { ttl: 7200 });
    await cache.delete("preparing");
    return unpackChildIndex(packed);
  } catch (error) {
    // A failed refresh cannot erase usable finalized evidence or trigger a scan storm.
    await cache.set("preparing", true, { ttl: 60 });
    if (usable) return unpackChildIndex(previous);
    throw error;
  }
}

const readStandaloneValidators = unstable_cache(async () => {
  const key = process.env.TAOSTATS_API_KEY;
  if (!key) throw new Error("Validator data is not configured for this environment.");
  const [index, all] = await Promise.all([getChildHotkeys(), validatorCollection<Validator>("/v1/validators", { order_by: "rank", order_dir: "asc" }, key)]);
  const children = new Set(index.hotkeys);
  return { rows: all.filter(row => !children.has(row.hotkey)), hiddenChildren: all.filter(row => children.has(row.hotkey)).length, childCheck: { block: index.block, checkedAt: index.checkedAt } };
}, ["standalone-validator-directory-v2"], { revalidate: 900 });

export async function getStandaloneValidators() {
  const snapshot = await readStandaloneValidators();
  await rememberValidatorNames(snapshot.rows);
  return snapshot;
}
