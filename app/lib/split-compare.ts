const total = BigInt("18446744073709551615");
export const splitLabels = ["Burn allocation", "Recycle allocation", "Owner", "Validators, including Root", "Miners"];
export function validSplit(values: string[] | undefined) {
  if (!values || values.length !== 5 || values.some(v => !/^\d+$/.test(v))) return false;
  return values.reduce((sum, v) => sum + BigInt(v), BigInt(0)) === total;
}
export function compareSplits(left: string[] | undefined, right: string[] | undefined) {
  if (!validSplit(left) || !validSplit(right)) return null;
  return splitLabels.map((label, i) => ({ label, left: Number(left![i]) / Number(total) * 100,
    right: Number(right![i]) / Number(total) * 100,
    difference: Number(BigInt(right![i]) - BigInt(left![i])) / Number(total) * 100 }));
}
