import assert from "node:assert/strict";
import test from "node:test";
import { aggregateBars, dollarBars, priceBars, chartPrecision, taoPriceCandles, futureChartTimes, mergeChartCandles, withLiveCandle, calendarBars } from "../app/lib/chart-data.ts";
const candle = (time, close = "1") => ({ time, open: close, high: close, low: close, close });

test("history paging preserves older candles through live refreshes and replaces overlapping bars", () => {
  const older = [candle("2025-02-13T00:00:00Z"), candle("2025-02-13T00:10:00Z", "2")];
  const recent = [candle("2025-02-13T00:10:00.000Z", "3"), candle("2025-02-13T00:20:00Z", "4")];
  const merged = mergeChartCandles(older, recent);
  assert.deepEqual(merged.map(row => row.close), ["1", "3", "4"]);
  assert.equal(mergeChartCandles(merged, [candle("2025-02-13T00:20:00Z", "5")]).length, 3);
  assert.equal(mergeChartCandles(merged, [candle("2025-02-13T00:20:00Z", "5")])[2].close, "5");
});

test("future chart space uses real UTC days, weeks and calendar months without prices", () => {
  const stamp = value => Date.parse(value) / 1000;
  const months = futureChartTimes(stamp("2024-01-01"), "1mo");
  assert.deepEqual(months.slice(0, 3).map(t => new Date(t * 1000).toISOString().slice(0,10)), ["2024-02-01", "2024-03-01", "2024-04-01"]);
  assert.equal(futureChartTimes(stamp("2024-02-28"), "1d")[0], stamp("2024-02-29"));
  assert.equal(futureChartTimes(stamp("2026-10-19"), "1w")[0], stamp("2026-10-26"));
  assert.deepEqual(futureChartTimes(undefined, "1d"), []);
});

test("TAO price history keeps pre-listing candles and never treats rolling USD volume as candle volume", () => {
  const row = { timestamp: "2023-03-01T00:00:00Z", open: "50", high: "55", low: "49", close: "54", volume_24h: "1000000" };
  const data = taoPriceCandles({ data: [row, { ...row, timestamp: "2023-03-02T00:00:00Z", high: "1" }, { ...row, open: null }] });
  assert.equal(data.length, 1);
  assert.equal(Date.parse(data[0].time), Date.parse(row.timestamp));
  assert.equal(data[0].volume_tao, undefined);
  assert.equal(priceBars(data)[0].volume, 0);
  assert.throws(() => taoPriceCandles({ error: "unavailable" }));
});

test("rejects missing prices and impossible OHLC, keeps gaps and deduplicates", () => {
  const bars = priceBars([
    candle("2026-10-04T00:20:00Z", "2"), candle("2026-10-04T00:00:00Z"),
    candle("2026-10-04T00:00:00Z", "3"), { ...candle("2026-10-04T00:10:00Z"), open: "null" },
    { ...candle("2026-10-04T00:30:00Z"), high: ".5" }, candle("invalid"),
  ]);
  assert.equal(bars.length, 2);
  assert.equal(bars[0].close, 3);
  assert.equal(bars[1].time - bars[0].time, 1200);
});

test("USD history uses each matching historical FX candle, never the latest rate", () => {
  const prices = priceBars([candle("2026-10-04T00:00:00Z"), candle("2026-10-04T00:10:00Z")]);
  const exchange = priceBars([candle("2026-10-04T00:00:00Z", "200"), candle("2026-10-04T00:10:00Z", "250")]);
  assert.deepEqual(dollarBars(prices, exchange).map(bar => bar.close), [200, 250]);
  assert.equal(dollarBars(prices, exchange.slice(1)).length, 1);
});

test("ten-minute aggregation stays on clock boundaries when a five-minute bucket is missing", () => {
  const bars = priceBars([candle("2026-10-04T00:05:00Z", "1"), candle("2026-10-04T00:15:00Z", "2"), candle("2026-10-04T00:20:00Z", "3")]);
  const result = aggregateBars(bars, 600);
  assert.deepEqual(result.map(bar => new Date(bar.time * 1000).toISOString()),
    ["2026-10-04T00:00:00.000Z", "2026-10-04T00:10:00.000Z", "2026-10-04T00:20:00.000Z"]);
  assert.deepEqual(result.map(bar => [bar.open, bar.close]), [[1, 1], [2, 2], [3, 3]]);
});

test("small alpha prices remain readable", () => { assert.equal(chartPrecision(.00001234), 8); });

// Calendar boundaries differ from fixed-duration buckets, especially February.
test("weekly bars begin Monday UTC and preserve OHLC and summed volume", async () => {
  const { calendarBars } = await import("../app/lib/chart-data.ts");
  const bars = priceBars([candle("2026-10-04T00:00:00Z", "2"), candle("2026-10-05T00:00:00Z", "3"), candle("2026-10-06T00:00:00Z", "1")]).map(bar => ({...bar, volume: 4}));
  const weekly = calendarBars(bars, "1w");
  assert.deepEqual(weekly.map(bar => new Date(bar.time * 1000).toISOString().slice(0,10)), ["2026-09-28", "2026-10-05"]);
  assert.deepEqual([weekly[1].open, weekly[1].high, weekly[1].low, weekly[1].close, weekly[1].volume], [3,3,1,1,8]);
});
test("monthly bars use calendar months including leap February and USD is converted daily first", async () => {
  const { calendarBars } = await import("../app/lib/chart-data.ts");
  const bars = priceBars([candle("2024-02-28T00:00:00Z", "2"), candle("2024-02-29T00:00:00Z", "3"), candle("2024-03-01T00:00:00Z", "4")]);
  const fx = bars.map((bar,index) => ({...bar, open:100*(index+1),high:100*(index+1),low:100*(index+1),close:100*(index+1)}));
  const monthly = calendarBars(dollarBars(bars,fx), "1mo");
  assert.deepEqual(monthly.map(bar=>new Date(bar.time*1000).toISOString().slice(0,10)), ["2024-02-01","2024-03-01"]);
  assert.deepEqual([monthly[0].open,monthly[0].close,monthly[1].close],[200,600,1200]);
});


test("live USD close agrees across hourly, daily, weekly and monthly without rewriting history", () => {
  const now = Date.parse("2026-10-19T14:20:00Z");
  const closes = [];
  for (const interval of ["1h", "1d", "1w", "1mo"]) {
    const baseInterval = ["1w", "1mo"].includes(interval) ? "1d" : interval;
    const time = baseInterval === "1h" ? "2026-10-19T14:00:00Z" : "2026-10-19T00:00:00Z";
    const oldTime = baseInterval === "1h" ? "2026-10-19T13:00:00Z" : "2026-10-18T00:00:00Z";
    const alpha = [candle(oldTime, "0.08"), candle(time, "0.1")];
    const fx = [candle(oldTime, "260"), candle(time, baseInterval === "1h" ? "268" : "267")];
    const converted = dollarBars(priceBars(withLiveCandle(alpha, 0.11, baseInterval, now)), priceBars(withLiveCandle(fx, 270, baseInterval, now)));
    assert.equal(converted[0].close, 0.08 * 260);
    closes.push(calendarBars(converted, interval).at(-1).close);
    assert.equal(alpha.at(-1).close, "0.1");
    assert.equal(fx[0].close, "260");
  }
  assert.deepEqual(closes, Array(4).fill(0.11 * 270));
});

test("live price does not bridge a stale archive gap", () => {
  const rows = [candle("2026-10-01T00:00:00Z", "100")];
  assert.equal(withLiveCandle(rows, 270, "1h", Date.parse("2026-10-19T14:20:00Z")), rows);
});


test('node tail fills stale provider history without replacing OHLC or bridging gaps', async()=>{
 const {extendChartHistory,chartNeedsRecentHistory}=await import('../app/lib/chart-data.ts');
 const now=Date.parse('2026-11-16T05:00:00Z');
 const c=(day,close='2')=>({time:`2026-11-${day}T00:00:00Z`,open:'1',high:'3',low:'1',close,volume_tao:'5'});
 const old=[c(12)];
 const updated=extendChartHistory(old,[c(12,'3'),c(13),c(14),c(15),c(16)],'1d',now);
 assert.equal(updated.length,5);assert.equal(updated[0],old[0]);
 assert.equal(chartNeedsRecentHistory(updated,'1d',now),false);
 assert.equal(chartNeedsRecentHistory(old,'1d',now),true);
 assert.deepEqual(extendChartHistory(old,[c(14),c(15)],'1d',now).map(c=>Date.parse(c.time)),[12,14,15].map(day=>Date.parse(c(day).time)));
 assert.equal(extendChartHistory(old,[c(13),c(14),c(15),c(16),c(17)],'1d',now).length,5);
 assert.equal(extendChartHistory(old,[{...c(13),close:'NaN'},c(14)],'1d',now).length,2);
});
