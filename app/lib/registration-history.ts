type HistoryRow = {netuid:number;time?:string;[key:string]:unknown};
type Registration = {time:string;block:number;evidence:string};

// A bucket beginning before the boundary can contain prices from both projects.
// Exclude it as well as older buckets rather than inventing a replacement OHLC.
export function registrationCandles<T extends {time:string}>(candles:T[], netuid:number, registrations:Record<string,Registration>):T[] {
 const registration=registrations[String(netuid)];
 if(!registration)return candles;
 const start=Date.parse(registration.time);
 return candles.filter(candle=>Date.parse(candle.time)>=start);
}

// Verified lifecycle boundaries, independent of whether a replacement has a
// name. Never compare the new registration against the old occupant's price.
export function registrationHistory<T extends HistoryRow>(row:T, registrations:Record<string,Registration>):T {
 const registration=registrations[String(row.netuid)];
 if(!registration || Date.parse(row.time||"")<Date.parse(registration.time))return row;
 const result={...row};
 for(const period of ["10m","1h","24h","7d"]){
  const baseline=Date.parse(String(row[`time_${period}`]||""));
  if(Number.isFinite(baseline)&&baseline<Date.parse(registration.time)){
   for(const key of [`price_${period}_tao`,`time_${period}`,`change_${period}`,`liquidity_change_${period}`,`emission_change_${period}`,`volume_${period}_tao`,`volume_acceleration_${period}`]) Object.assign(result,{[key]:undefined});
  }
 }
 return result;
}
