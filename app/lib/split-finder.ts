
const total = BigInt("18446744073709551615");
const validSplit = (values: string[]) => values.length === 5 && values.every(v => /^\d+$/.test(v)) && values.reduce((sum, v) => sum + BigInt(v), BigInt(0)) === total;
export function findSplits(weights: Record<string, string[]>, names: Record<string, string>, slot: number, minimum: number, maximum: number, query = "", ascending = false) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 4 || !Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum < 0 || maximum > 100 || minimum > maximum) return [];
  return Object.entries(weights).filter(([id, values]) => validSplit(values) && `${id} SN${id} ${names[id] || ""}`.toLowerCase().includes(query.trim().toLowerCase()) && BigInt(values[slot]) * BigInt(100) >= BigInt(minimum) * total && BigInt(values[slot]) * BigInt(100) <= BigInt(maximum) * total).map(([id, values]) => ({ id: Number(id), name: names[id] || "Name not confirmed", values, percentages: values.map(v => Number(v) / Number(total) * 100) })).sort((a, b) => {
    const left = BigInt(a.values[slot]), right = BigInt(b.values[slot]);
    return left === right ? a.id - b.id : (left < right ? -1 : 1) * (ascending ? 1 : -1);
  });
}

