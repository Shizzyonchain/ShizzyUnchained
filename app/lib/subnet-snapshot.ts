/** Nominal protocol cap; FDV is a hypothetical spot valuation, not exit proceeds. */
export const ALPHA_CAP = 21_000_000;
export function nonnegative(value: unknown): number | null {
  if ((typeof value !== "string" && typeof value !== "number") || (typeof value === "string" && !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function reviewedBurns(archive:{throughTime:string;historyStart:string;toBlock:number;transactions:{id:string;netuid:number|null;kind:string;block:number;timestamp:string;amountRaw:string}[]},registrations:Record<string,{registeredAt:number}>){
  const end=Date.parse(archive.throughTime),start=end-30*86400_000;
  const subnets:Record<string,{alphaRaw:string;events:number;complete:boolean}>=Object.fromEntries(Object.entries(registrations).map(([sn,r])=>[sn,{alphaRaw:"0",events:0,complete:Number.isFinite(end)&&Date.parse(archive.historyStart)<=start&&r.registeredAt<=archive.toBlock}]));
  const seen=new Set<string>();
  for(const row of archive.transactions){
    const time=Date.parse(row.timestamp),key=String(row.netuid),registration=registrations[key]?.registeredAt;
    if(seen.has(row.id)||row.netuid===null||!subnets[key]||!registration||row.block<registration||!['alpha','buyback'].includes(row.kind)||!Number.isFinite(time)||!Number.isFinite(end)||time<=start||time>end||!/^\d+$/.test(row.amountRaw)||BigInt(row.amountRaw)<BigInt(100_000_000_000))continue;
    seen.add(row.id);subnets[key].alphaRaw=String(BigInt(subnets[key].alphaRaw)+BigInt(row.amountRaw));subnets[key].events++;
  }
  return {asOf:archive.throughTime,historyStart:archive.historyStart,subnets};
}
export function snapshotNumbers(row: {price_tao?: unknown; alpha_reserve?: unknown; alpha_out?: unknown}) {
  const price = nonnegative(row.price_tao), pool = nonnegative(row.alpha_reserve), out = nonnegative(row.alpha_out);
  return { fdv: price === null ? null : price * ALPHA_CAP, supply: pool === null || out === null ? null : pool + out };
}
export function marketRank(rows: {netuid:number;market_cap_tao?:unknown}[], netuid:number) {
  const eligible=rows.filter(r=>r.netuid>0&&nonnegative(r.market_cap_tao)!==null);
  const row=eligible.find(r=>r.netuid===netuid);
  return row ? {rank:1+eligible.filter(r=>Number(r.market_cap_tao)>Number(row.market_cap_tao)).length,count:eligible.length} : null;
}
