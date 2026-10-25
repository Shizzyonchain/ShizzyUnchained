import type { WalletActivity } from "./wallet-activity";
export type SalesTotal = { alpha: string; tao: string; trades: number };
export type OwnerSales = { netuid: number; address: string; asOf: string; ownerCheckedAt: string; complete: boolean; sales?: WalletActivity[]; day: TradeTotal; week: TradeTotal; month: TradeTotal; burns: OwnerBurns; subnetBurns: OwnerBurns };
export type BurnTotal={alpha:string;burns:number;complete:boolean};
export type OwnerBurns={asOf:string;historyStart:string;minimumAlpha:string;day:BurnTotal;week:BurnTotal;month:BurnTotal};
export type BurnRecord={id:string;netuid:number|null;account:string;kind:string;amountRaw:string;timestamp:string};
export type TradeTotal = SalesTotal & { bought: SalesTotal; netAlpha: string };
function sumDirection(rows: WalletActivity[], netuid: number, asOf: number, buy: boolean) {
  const totals = Array.from({length:3},()=>({alpha:BigInt(0),tao:BigInt(0),trades:0}));
  const seen = new Set<string>();
  for (const row of rows) {
    const trade = row.swap, time = Date.parse(row.timestamp);
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (!trade || trade.feeConversion || trade.fromToken !== (buy ? "TAO" : `SN${netuid}`) || trade.toToken !== (buy ? `SN${netuid}` : "TAO") || BigInt(trade.taoValue) < BigInt(5_000_000_000) || time > asOf) continue;
    for (const [index, duration] of [86_400_000, 604_800_000, 2_592_000_000].entries()) if (time >= asOf - duration) {
      totals[index].alpha += BigInt(buy ? trade.toAmount : trade.fromAmount); totals[index].tao += BigInt(buy ? trade.fromAmount : trade.toAmount); totals[index].trades++;
    }
  }
  const encode = (value: typeof totals[number]): SalesTotal => ({ alpha: value.alpha.toString(), tao: value.tao.toString(), trades: value.trades });
  return { day: encode(totals[0]), week: encode(totals[1]), month: encode(totals[2]) };
}
export function sumOwnerSales(rows: WalletActivity[], netuid: number, asOf: number) { return sumDirection(rows, netuid, asOf, false); }
export function sumOwnerActivity(rows: WalletActivity[], netuid: number, asOf: number) {
  const sold = sumDirection(rows, netuid, asOf, false), bought = sumDirection(rows, netuid, asOf, true);
  const merge = (sales: SalesTotal, buys: SalesTotal): TradeTotal => ({ ...sales, bought: buys, netAlpha: (BigInt(buys.alpha) - BigInt(sales.alpha)).toString() });
  return { day: merge(sold.day, bought.day), week: merge(sold.week, bought.week), month:merge(sold.month,bought.month) };
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
  if(seen.has(row.id)||!trade||trade.feeConversion||trade.fromToken!==`SN${netuid}`||trade.toToken!=="TAO"||BigInt(trade.taoValue)<BigInt(5000000000)||!Number.isFinite(time)||time>asOf||time<asOf-2592000000)return false;
  seen.add(row.id);return true;
 }).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)).slice(0,20);
}

/** Only finalized explicit burns attributed to the current owner; never recycling/emissions. */
function sumBurns(rows:BurnRecord[],netuid:number,address:string|null,asOf:number,historyStart:string):OwnerBurns {
 const start=Date.parse(historyStart);if(!Number.isFinite(asOf)||!Number.isFinite(start)||start>asOf)throw new Error("Missing burn coverage");
 const totals=[86400000,604800000,2592000000].map(duration=>({alpha:BigInt(0),burns:0,complete:start<=asOf-duration}));const seen=new Set<string>();
 for(const row of rows){const time=Date.parse(row.timestamp);if(seen.has(row.id)||row.netuid!==netuid||(address!==null&&row.account!==address)||!["alpha","buyback"].includes(row.kind)||!/^\d+$/.test(row.amountRaw)||!Number.isFinite(time)||time<start||time>asOf||BigInt(row.amountRaw)<BigInt(100000000000))continue;seen.add(row.id);
  for(const [i,duration]of [86400000,604800000,2592000000].entries())if(time>=asOf-duration){totals[i].alpha+=BigInt(row.amountRaw);totals[i].burns++;}
 }
 const encode=(t:typeof totals[number]):BurnTotal=>({...t,alpha:t.alpha.toString()});
 return {asOf:new Date(asOf).toISOString(),historyStart,minimumAlpha:"100",day:encode(totals[0]),week:encode(totals[1]),month:encode(totals[2])};
}

export function sumOwnerBurns(rows:BurnRecord[],netuid:number,address:string,asOf:number,historyStart:string):OwnerBurns{return sumBurns(rows,netuid,address,asOf,historyStart);}
/** All wallets on this subnet; includes owner burns, so never add the two totals. */
export function sumSubnetBurns(rows:BurnRecord[],netuid:number,asOf:number,historyStart:string):OwnerBurns{return sumBurns(rows,netuid,null,asOf,historyStart);}
