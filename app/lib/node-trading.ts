export function nodeTradingSnapshot(value: unknown, period: '1h'|'24h', now=Date.now()) {
 const row=value as {buy:number;sell:number;count:number;asOf:string;windowStart:string;fromBlock:number;toBlock:number;source:string};
 if(!row || ![row.buy,row.sell].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)||row.count!==128||!Number.isSafeInteger(row.fromBlock)||!Number.isSafeInteger(row.toBlock)||row.toBlock<row.fromBlock||Date.parse(row.asOf)-Date.parse(row.windowStart)!==(period==='1h'?3600000:86400000))throw new Error('Incomplete node trade window');
 const age=now-Date.parse(row.asOf);
 if(!Number.isFinite(age)||age < -60000||age>900000)throw new Error('Delayed node trade snapshot');
 return row;
}
