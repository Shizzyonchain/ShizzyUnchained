import type { WalletActivity } from "./wallet-activity";
export type SalesTotal = { alpha: string; tao: string; trades: number };
export type OwnerSales = { netuid: number; address: string; asOf: string; ownerCheckedAt: string; complete: boolean; sales?: WalletActivity[]; day: TradeTotal; week: TradeTotal };
export type TradeTotal = SalesTotal & { bought: SalesTotal; netAlpha: string };
function sumDirection(rows: WalletActivity[], netuid: number, asOf: number, buy: boolean) {
  const totals = [ { alpha: BigInt(0), tao: BigInt(0), trades: 0 }, { alpha: BigInt(0), tao: BigInt(0), trades: 0 } ];
  const seen = new Set<string>();
  for (const row of rows) {
    const trade = row.swap, time = Date.parse(row.timestamp);
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (!trade || trade.feeConversion || trade.fromToken !== (buy ? "TAO" : `SN${netuid}`) || trade.toToken !== (buy ? `SN${netuid}` : "TAO") || BigInt(trade.taoValue) < BigInt(5_000_000_000) || time > asOf) continue;
    for (const [index, duration] of [86_400_000, 604_800_000].entries()) if (time >= asOf - duration) {
      totals[index].alpha += BigInt(buy ? trade.toAmount : trade.fromAmount); totals[index].tao += BigInt(buy ? trade.fromAmount : trade.toAmount); totals[index].trades++;
    }
  }
  const encode = (value: typeof totals[number]): SalesTotal => ({ alpha: value.alpha.toString(), tao: value.tao.toString(), trades: value.trades });
  return { day: encode(totals[0]), week: encode(totals[1]) };
}
export function sumOwnerSales(rows: WalletActivity[], netuid: number, asOf: number) { return sumDirection(rows, netuid, asOf, false); }
export function sumOwnerActivity(rows: WalletActivity[], netuid: number, asOf: number) {
  const sold = sumDirection(rows, netuid, asOf, false), bought = sumDirection(rows, netuid, asOf, true);
  const merge = (sales: SalesTotal, buys: SalesTotal): TradeTotal => ({ ...sales, bought: buys, netAlpha: (BigInt(buys.alpha) - BigInt(sales.alpha)).toString() });
  return { day: merge(sold.day, bought.day), week: merge(sold.week, bought.week) };
}
export function formatSalesAmount(raw: string): string {
  if (raw.startsWith("-")) return `-${formatSalesAmount(raw.slice(1))}`;
  const value = BigInt(raw), whole = value / BigInt(1_000_000_000);
  const fraction = (value % BigInt(1_000_000_000)).toString().padStart(9, "0").replace(/0+$/, "");
  return whole.toLocaleString("en-US") + (fraction ? `.${fraction}` : "");
}

export function ownerSaleEvidence(rows: WalletActivity[], netuid: number, asOf: number) {
 const seen = new Set<string>();
 return rows.filter(row => {
  const trade=row.swap,time=Date.parse(row.timestamp);
  if(seen.has(row.id)||!trade||trade.feeConversion||trade.fromToken!==`SN${netuid}`||trade.toToken!=="TAO"||BigInt(trade.taoValue)<BigInt(5000000000)||!Number.isFinite(time)||time>asOf||time<asOf-604800000)return false;
  seen.add(row.id);return true;
 }).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)).slice(0,20);
}
