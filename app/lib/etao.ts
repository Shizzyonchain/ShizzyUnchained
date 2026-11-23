export const emissionPrefix = "0x658faa385070e074c85bf6b568cf0555dc1c92ffdd636ce0bb9f5680dfb61d56";
export const gammaEmissionPrefix = "0x658faa385070e074c85bf6b568cf0555c7799e9283216c7292c39d3abd3a8b45";
export type GammaAllocation = { netuid: number; weight: string };
export function decodeGammaEmission(value: string): GammaAllocation[] {
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("Invalid Gamma encoding");
  const data = Buffer.from(value.slice(2), "hex");
  const mode = data[0] & 3;
  if (mode > 1 || (mode === 1 && data.length < 2)) throw new Error("Invalid Gamma vector length");
  const offset = mode === 0 ? 1 : 2;
  const count = mode === 0 ? data[0] >>> 2 : data.readUInt16LE() >>> 2;
  if ((mode === 1 && count < 64) || count > 16383 || data.length !== offset + count * 10) throw new Error("Invalid Gamma vector encoding");
  const rows = Array.from({ length: count }, (_, i) => ({ netuid: data.readUInt16LE(offset + i * 10), weight: String(data.readBigUInt64LE(offset + i * 10 + 2)) }));
  if (new Set(rows.map(row => row.netuid)).size !== rows.length) throw new Error("Duplicate Gamma recipient");
  return rows;
}
export function decodeEmission(value: string, gamma: GammaAllocation[] = []): string[] {
  const data = Buffer.from(value.replace(/^0x/, ""), "hex");
  if (data.length !== 41 || data[0] !== 20) throw new Error("Invalid emission vector encoding");
  const weights = Array.from({ length: 5 }, (_, i) => data.readBigUInt64LE(1 + i * 8));
  if (weights.reduce((sum, v) => sum + v, BigInt(0)) + gamma.reduce((sum, row) => sum + BigInt(row.weight), BigInt(0)) !== BigInt("18446744073709551615")) throw new Error("Emission vector does not sum to one");
  return weights.map(String);
}
export const emissionPercent = (value: string) => `${(Number(value) / 18446744073709551615 * 100).toFixed(2)}%`;
export type EmissionObservation = { netuid: number; before: string[] | null; after: string[] | null; fromBlock: number; toBlock: number; detectedAt: string };
export function observationIsResolved(row: EmissionObservation, verified: { netuid: number; block: number; after: string[] }[]) {
  return verified.some(change => change.netuid === row.netuid && change.block > row.fromBlock && change.block <= row.toBlock && JSON.stringify(change.after) === JSON.stringify(row.after));
}
