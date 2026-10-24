export type SignalRow = { netuid: number; name?: string; time?: string; change_1h?: string; change_24h?: string; volume_1h_tao?: string; volume_24h_tao?: string; volume_acceleration_1h?: string; volume_acceleration_24h?: string };
export const numberOrNull = (value: unknown): number | null => value === null || value === undefined || value === "" || typeof value === "boolean" || !Number.isFinite(Number(value)) ? null : Number(value);
export function freshSignalRows(rows: SignalRow[], now = Date.now()) {
 const seen = new Set<number>();
 return rows.filter(row => { const time = Date.parse(row.time || ""); if (row.netuid <= 0 || seen.has(row.netuid) || !Number.isFinite(time) || time > now + 60000 || now - time > 180000) return false; seen.add(row.netuid); return true; });
}
export function volumeAlerts(rows: SignalRow[], period: "1h" | "24h", limit = 3) {
 return rows.flatMap(row => { const ratio = numberOrNull(row[period === "1h" ? "volume_acceleration_1h" : "volume_acceleration_24h"]); const volume = numberOrNull(row[period === "1h" ? "volume_1h_tao" : "volume_24h_tao"]); return ratio !== null && ratio >= 2 && volume !== null && volume >= 10 && volume / ratio >= 10 ? [{ netuid: row.netuid, name: row.name || `SN${row.netuid}`, ratio, volume }] : []; }).sort((a,b) => b.ratio-a.ratio || b.volume-a.volume).slice(0,limit);
}
export function sectorHeat(rows: SignalRow[], sectors: {id:string;name:string}[], tags: {netuid:number;sectors:string[]}[], period: "1h" | "24h") {
 const lookup = new Map(rows.map(row => [row.netuid,row]));
 return sectors.flatMap(sector => { const members = tags.filter(row => row.sectors.includes(sector.id)); const values = members.map(member => numberOrNull(lookup.get(member.netuid)?.[period === "1h" ? "change_1h" : "change_24h"])).filter((n): n is number => n !== null).sort((a,b)=>a-b); if (values.length < 2 || values.length < members.length*.8) return []; const mid=Math.floor(values.length/2); return [{...sector, value: values.length%2 ? values[mid] : (values[mid-1]+values[mid])/2, count:values.length,total:members.length}]; }).sort((a,b)=>b.value-a.value);
}
export function buyingTotals(data: unknown, now = Date.now()) {
 if (!Array.isArray(data)) throw new Error("Missing pool aggregates");
 const rows=data.filter(row=>Number.isInteger(row.netuid)&&row.netuid>0&&row.netuid<=128);
 if (rows.length!==128 || new Set(rows.map(row=>row.netuid)).size!==128) throw new Error("Incomplete subnet coverage");
 let buy=BigInt(0),sell=BigInt(0);const times:number[]=[];
 for(const row of rows){ const time=Date.parse(row.timestamp); if(!Number.isFinite(time)||time>now+60000||now-time>900000||!/^\d+$/.test(row.tao_buy_volume_24_hr)||!/^\d+$/.test(row.tao_sell_volume_24_hr))throw new Error("Incomplete or delayed trading data");buy+=BigInt(row.tao_buy_volume_24_hr);sell+=BigInt(row.tao_sell_volume_24_hr);times.push(time); }
 if(Math.max(...times)-Math.min(...times)>180000)throw new Error("Inconsistent trading snapshots");
 return {buy:Number(buy)/1e9,sell:Number(sell)/1e9,asOf:new Date(Math.min(...times)).toISOString(),count:rows.length};
}


/** Recheck cached timestamps at serving time, not only during collection. */
export function requireFreshTrading<T extends {asOf:string}>(value:T,now=Date.now()):T {
 const age=now-Date.parse(value.asOf);
 if(!Number.isFinite(age)||age < -60000||age>900000)throw new Error("Delayed trading snapshot");
 return value;
}
