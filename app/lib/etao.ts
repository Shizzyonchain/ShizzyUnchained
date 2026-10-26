export const emissionPrefix = "0x658faa385070e074c85bf6b568cf0555dc1c92ffdd636ce0bb9f5680dfb61d56";
export function decodeEmission(value: string): string[] {
  const data = Buffer.from(value.replace(/^0x/, ""), "hex");
  if (data.length !== 41 || data[0] !== 20) throw new Error("Invalid emission vector encoding");
  const weights = Array.from({ length: 5 }, (_, i) => data.readBigUInt64LE(1 + i * 8));
  if (weights.reduce((sum, v) => sum + v, BigInt(0)) !== BigInt("18446744073709551615")) throw new Error("Emission vector does not sum to one");
  return weights.map(String);
}
export const emissionPercent = (value: string) => `${(Number(value) / 18446744073709551615 * 100).toFixed(2)}%`;
export type EmissionObservation = { netuid: number; before: string[] | null; after: string[] | null; fromBlock: number; toBlock: number; detectedAt: string };
export function observationIsResolved(row: EmissionObservation, verified: { netuid: number; block: number; after: string[] }[]) {
  return verified.some(change => change.netuid === row.netuid && change.block > row.fromBlock && change.block <= row.toBlock && JSON.stringify(change.after) === JSON.stringify(row.after));
}
