import test from "node:test";
import assert from "node:assert/strict";
import {recentFxTrades} from "../app/lib/recent-fx-trades.ts";
import {currencyReturns,rateAt} from "../app/lib/currency-returns.ts";
test("actual recent trades restore USD returns when candle publication lags without relaxing freshness",()=>{
 const now=Date.parse("2026-11-10T07:37:48Z")/1000;
 const row={time:new Date(now*1000).toISOString(),price_tao:"1",time_1h:new Date((now-3600)*1000).toISOString(),price_1h_tao:"1"};
 const candles=[{time:now-3630,usd:220},{time:now-228,usd:222}];
 assert.equal(currencyReturns(row,"usd",candles).change_1h,undefined);
 const ticks=recentFxTrades([{time:new Date((now-15)*1000).toISOString(),price:"223"},{time:new Date((now+1)*1000).toISOString(),price:"999"},{time:"invalid",price:"2"}],now);
 assert.deepEqual(ticks,[{time:now-15,usd:223}]);
 assert.ok(Math.abs(Number(currencyReturns(row,"usd",[...candles,...ticks]).change_1h)-100*(223/220-1))<1e-10);
 assert.equal(rateAt(ticks,now+121),undefined);
 assert.deepEqual(recentFxTrades([{time:new Date((now-12000)*1000).toISOString(),price:"223"}],now),[]);
});
