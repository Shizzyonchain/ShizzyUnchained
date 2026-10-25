import { readFileSync } from "node:fs";
import { test as base, expect, type Page } from "@playwright/test";
import { keys, stamp, markets, candidates, validators, pagination, baskets, history, chart, cachedWallets } from "./contracts.mjs";

const test = base.extend<{ contracts: { failed: Set<string>; calls: string[] } }>({
  contracts: [async ({ page }, use) => {
    const failed = new Set<string>(), calls: string[] = [], unexpected: string[] = [], errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== "http://127.0.0.1:4310") return route.abort(); // No third-party browser traffic or credentials.
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const path = url.pathname; calls.push(path);
      if (failed.has(path)) return route.fulfill({ status: 503, json: { error: "Smoke provider unavailable" } });
      if (path === "/api/backend/v1/screener" || path === "/api/market-status" || /^\/api\/subnets\/\d+\/news$/.test(path)) return route.continue();
      let value: unknown;
      if (path === "/api/market-signals") value = {buying:{buy:url.searchParams.get("period")==="1h"?300:600,sell:400,asOf:new Date().toISOString(),count:128},sectors:[{id:"compute",name:"Compute & Cloud"}],tags:[{netuid:51,sectors:["compute"]},{netuid:64,sectors:["compute"]}]};
      else if (path === "/api/tao-price") value = { usd: 250, updatedAt: Math.floor(Date.now() / 1000), source: "ci-contract-fixture" };
      else if (path === "/api/wallet-activity") {
        const transfer = url.searchParams.get("kind") === "transfers", older = url.searchParams.get("page") === "2";
        const tradeKind = url.searchParams.get("kind");
        if (tradeKind === "swaps" || tradeKind === "trades") return route.fulfill({ json: { rows: [{ id: "swap-fixture", extrinsic:"9000000-0001", timestamp:stamp, action:"Subnet swap", success:null, amount:null, from:null, to:null, swap: {fromToken:"SN51",toToken:"SN64",fromAmount:"12500000000",toAmount:"8000000000",taoValue:"6000000000"} }],nextPage:null,fetchedAt:stamp,source:"CI indexed swaps" } });
        value = { rows: [{ id: older ? "8999999-0001" : "9000000-0001", extrinsic: older ? "8999999-0001" : "9000000-0001", timestamp: stamp, action: transfer ? (older ? "Sent TAO" : "Received TAO") : "SubtensorModule.add_stake", success: transfer ? null : true, amount: transfer ? "6000000000" : null, from: transfer ? keys[1] : null, to: transfer ? keys[0] : null }], nextPage: older ? null : 2, fetchedAt: stamp, source: "CI indexed history" };
        if (transfer) (value as { rows: unknown[] }).rows.push({ id: "dust-transfer", amount: "50000", action: "Dust transfer" });
      }
      else if (path === "/api/tao-history") value = { data: [] };
      else if (path === "/api/subnet-chart") value = chart(url.searchParams.get("interval") || "1d");
      else if (path === "/api/tao-chart") value = { ...chart(url.searchParams.get("interval") || "1d"), data: chart(url.searchParams.get("interval") || "1d").data.map(([time]) => ({ time, open: "250", high: "250", low: "250", close: "250" })) };
      else if (path === "/api/subnets/owner-sales") value = { netuid: Number(url.searchParams.get("netuid")), address: keys[0], asOf: stamp, ownerCheckedAt: stamp, complete: true, sales:[{id:"owner-sale",extrinsic:"9000000-0001",timestamp:stamp,swap:{fromToken:`SN${url.searchParams.get("netuid")}`,toToken:"TAO",fromAmount:"12500000000",toAmount:"6000000000",taoValue:"6000000000"}}], day: { alpha: "12500000000", tao: "6000000000", trades: 1, bought: { alpha: "25000000000", tao: "12000000000", trades: 2 }, netAlpha: "12500000000" }, week: { alpha: "25000000000", tao: "12000000000", trades: 2, bought: { alpha: "10000000000", tao: "5000000000", trades: 1 }, netAlpha: "-15000000000" } };
      else if (path === "/api/subnets/owners") value = { checkedAt: stamp, block: 9000000, owners: { 51: keys[0], 103: keys[0] } };
      else if (path === "/api/validators") value = { data: validators, pagination, directoryTotal: 2 };
      else if (path === "/api/validators/recommendations") value = { netuid: 51, candidates, collectedAt: stamp, preparedAt: stamp, coverage: { permitHolders: 2, yieldRows: 2, directoryEntries: 2 } };
      else if (path === "/api/validators/yield-checks") value = { netuid: 51, state: "ready", result: { methodVersion: 4, checkedAt: stamp, rows: candidates.map(row => ({ hotkey: row.hotkey, providerBlock: row.yieldBlock, providerTimestamp: stamp, seven: { status: "consistent", chainApy: .3, chainApr: .26 }, thirty: { status: "consistent", chainApy: .3, chainApr: .26 } })) } };
      else if (path === "/api/validators/root") value = { data: baskets, hiddenChildren: 0, collectedAt: stamp };
      else if (path === "/api/validators/root/history") value = { data: history(url.searchParams.get("hotkey") === keys[1] ? 1 : 0) };
      else if (path === "/api/validators/root/recommendations") value = { matches: keys.map((hotkey, index) => ({ hotkey, name: `Smoke Validator ${index + 1}`, take: .09, totalReturn: .03, drawdown: -.0314 - index * .001, volatility: .001, concentration: 1, quoteGap: 0, topFive: 1, snapshot: stamp, identityTimestamp: stamp, operatingTimestamp: stamp, start: history()[60].day, end: history()[90].day })), excluded: [], reviewed: ["Smoke Validator 1", "Smoke Validator 2"], totalBaskets: 2, historyCandidates: 2, hiddenChildren: 0, historyEnd: history()[90].day, preparedAt: stamp };
      else { unexpected.push(`${route.request().method()} ${path}`); return route.fulfill({ status: 501, json: { error: "Unmocked smoke contract" } }); }
      if(path==="/api/subnets/owner-sales")Object.assign(value as object,{month:{alpha:"100000000000",tao:"50000000000",trades:5,bought:{alpha:"500000000000",tao:"100000000000",trades:6},netAlpha:"400000000000"},burns:{asOf:stamp,historyStart:new Date(Date.parse(stamp)-4*86400000).toISOString(),minimumAlpha:"100",day:{alpha:"200000000000",burns:1,complete:true},week:{alpha:"300000000000",burns:2,complete:false},month:{alpha:"300000000000",burns:2,complete:false}}});
      return route.fulfill({ json: value });
    });
    await use({ failed, calls });
    expect(unexpected, "Unexpected internal APIs must be explicitly covered, not silently stubbed").toEqual([]);
    expect(errors, "Uncaught browser errors").toEqual([]);
  }, { auto: true }],
});
const search = (page: Page) => page.getByRole("searchbox", { name: "Search subnets by name or subnet number" });
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

test("market search, clear and chart navigation retain useful chart controls", async ({ page, isMobile }) => {
  await page.goto("/");
  await search(page).fill("SN51");
  await expect(page.locator(".screener tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Smoke Lium SN51", exact: true })).toBeVisible();
  await search(page).fill("no-subnet-has-this-name");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".screener tbody tr")).toHaveCount(markets.length);
  await search(page).fill("SN51");
  await page.getByRole("link", { name: "Smoke Lium SN51", exact: true }).click();
  await expect(page).toHaveURL(/\/charts\/51/);
  await expect(page.locator(".chart-plot canvas").first()).toBeVisible();
  await expect(page.locator(".chart-empty")).toHaveCount(0);
  await expect(page.locator(".trading-chart-host")).toHaveAttribute("aria-label", /[1-9]\d* sampled intervals/);
  if (isMobile) {
    const toolbar = page.getByRole("group", { name: "Quick chart controls", exact: true });
    await expect(toolbar.getByRole("combobox")).toHaveValue("1d");
    await expect(page.getByRole("button", { name: "Chart settings", exact: true })).toHaveAttribute("aria-expanded", "false");
    expect((await page.locator(".chart-plot").boundingBox())!.y).toBeLessThan(500);
    await toolbar.getByRole("combobox").selectOption("1w");
    await toolbar.getByRole("button", { name: "TAO", exact: true }).click();
    await expect(toolbar.getByRole("button", { name: "TAO", exact: true })).toHaveAttribute("aria-pressed", "true");
  } else {
    await page.getByRole("button", { name: "Weekly candles", exact: true }).click();
    await page.getByRole("group", { name: "Chart currency", exact: true }).getByRole("button", { name: "TAO", exact: true }).click();
  }
  await expect(page.locator(".chart-plot-context")).toContainText("TAO");
  const jump=page.getByRole("link",{name:"Market snapshot ↓",exact:true});
  await expect(jump).toHaveAttribute("href","#subnet-market-snapshot");await jump.click();
  const snapshot=page.getByRole("region",{name:"Subnet market information",exact:true});
  await expect(snapshot.getByRole("heading",{name:"Market snapshot",exact:true})).toBeInViewport();
  expect((await snapshot.boundingBox())!.y).toBeGreaterThan(80);
  const ownerActivity = page.getByRole("region", { name: "Owner wallet alpha activity", exact: true });
  await expect(ownerActivity).toContainText("Net buying");
  await expect(ownerActivity).toContainText("+12.5");
  await ownerActivity.getByRole("group",{name:"Owner activity period",exact:true}).getByRole("button",{name:"7D",exact:true}).click();
  await expect(ownerActivity).toContainText("Net selling");
  await expect(ownerActivity).toContainText("−15");
  const newsJump=page.getByRole("link",{name:"Recent news ↓",exact:true});await expect(newsJump).toHaveAttribute("href","#subnet-recent-news");await newsJump.click();
  const news=page.getByRole("region",{name:"Recent news & history",exact:true});await expect(news.getByRole("heading",{name:"Recent news & history",exact:true})).toBeInViewport();expect((await news.boundingBox())!.y).toBeGreaterThan(80);
  await noOverflow(page);
});

test("extreme yield disclosure keeps uncapped data and does not navigate the table row", async ({ page, isMobile }) => {
  await page.goto("/"); await search(page).fill("SN103");
  if (isMobile) await page.getByRole("link", { name: "Smoke Subnet 103 SN103", exact: true }).click();
  const cell = page.locator(isMobile ? ".subnet-yield-fact" : ".apy-cell");
  await expect(cell).toContainText("20,000%"); await expect(cell).toContainText("530% APR");
  await expect(cell).toContainText("Potentially unstable");
  await cell.locator("summary").click();
  await expect(cell.locator("details")).toHaveAttribute("open", "");
  await expect(cell).toContainText("not a specific validator");
  await expect(page).toHaveURL(isMobile ? /\/charts\/103/ : "/");
  await cell.locator("summary").press("Enter");
  await expect(cell.locator("details")).not.toHaveAttribute("open", "");
  await expect(page).toHaveURL(isMobile ? /\/charts\/103/ : "/"); await noOverflow(page);
});

test("subnet recommendations show net yield and fail closed when sources fail", async ({ page, contracts }) => {
  await page.goto("/validators");
  await page.getByRole("combobox", { name: "Choose your subnet", exact: true }).selectOption("51");
  await page.getByRole("button", { name: "Find my validator →", exact: true }).click();
  const finder = page.locator('[aria-labelledby="validator-finder-title"]');
  await expect(finder.getByRole("heading", { name: "Smoke Validator 2", exact: true })).toBeVisible();
  await expect(finder).toContainText("30% APY"); // Already after take; do not reduce to 27.3%.
  contracts.failed.add("/api/validators/recommendations");
  await page.getByRole("button", { name: "Find my validator →", exact: true }).click();
  await expect(finder.getByRole("alert")).toContainText("We could not verify a current choice");
  await expect(finder.getByRole("heading", { name: "Smoke Validator 2", exact: true })).toHaveCount(0);
  await noOverflow(page);
});

test("root capital and TWR views name their series and reuse loaded history", async ({ page, contracts }) => {
  await page.goto("/validators/root");
  const compare = page.locator('[aria-labelledby="root-compare-title"]');
  await compare.locator("select").nth(0).selectOption(keys[0]); await compare.locator("select").nth(1).selectOption(keys[1]);
  await compare.getByRole("button", { name: "Compare baskets", exact: true }).click();
  await expect(compare.getByRole("columnheader", { name: "Capital drawdown · NAV/share", exact: true })).toBeVisible();
  await expect(compare).toContainText("-3.14%");
  const reads = contracts.calls.filter(path => path === "/api/validators/root/history").length;
  await compare.getByRole("button", { name: "Total return · TWR", exact: true }).click();
  await expect(compare.getByRole("columnheader", { name: "Total-return drawdown · TWR", exact: true })).toBeVisible();
  await expect(compare).toContainText("A 0% TWR drawdown does not mean");
  expect(contracts.calls.filter(path => path === "/api/validators/root/history")).toHaveLength(reads);
  await page.getByRole("button", { name: "Find root recommendations", exact: true }).click();
  await expect(page.locator('[aria-labelledby="root-recommend-title"]')).toContainText("Capital drawdown · NAV/share (daily closes): -3.14%");
  await noOverflow(page);
});

test("saved wallets persist, remove individually and clear completely", async ({ page }) => {
  await page.addInitScript(({ wallets }) => {
    if (sessionStorage.getItem("smoke-seeded")) return;
    localStorage.setItem("shizzy:wallet-cache:v1", JSON.stringify({ wallets, savedAt: new Date().toISOString() }));
    sessionStorage.setItem("smoke-seeded", "true");
  }, { wallets: cachedWallets });
  await page.goto("/wallet-tracker");
  await expect(page.locator(".wallet-remove")).toHaveCount(2);
  await page.getByRole("button", { name: `View recent transactions for wallet ${keys[0]}`, exact: true }).click();
  const activity = page.getByRole("region", { name: "Selected wallet recent activity", exact: true });
  const transfers = activity.getByRole("region", { name: "TAO transfers", exact: true });
  const signed = activity.getByRole("region", { name: "Signed transactions", exact: true });
  await expect(activity.getByRole("region", {name:"Subnet swaps",exact:true})).toContainText("12.5 SN51 → 8 SN64");
  await expect(transfers).toContainText("Received TAO");
  await expect(transfers).toContainText("5 TAO or more");
  await expect(transfers).not.toContainText("Dust transfer");
  await expect(signed).toHaveCount(0);
  await activity.getByText("Advanced transactions",{exact:true}).click();
  await expect(signed).toContainText("SubtensorModule.add_stake");
  await transfers.getByRole("button", { name: "Older →", exact: true }).click();
  await expect(transfers).toContainText("Sent TAO");
  await expect(signed).toContainText("Page 1");
  await noOverflow(page);
  await page.getByRole("button", { name: "Close wallet activity", exact: true }).click();
  await page.locator(".wallet-remove").first().click();
  await expect(page.locator(".wallet-remove")).toHaveCount(1);
  await page.reload(); await expect(page.locator(".wallet-remove")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear saved wallets & cache", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("shizzy:wallet-cache:v1"))).toBeNull();
  await page.reload(); await expect(page.locator(".wallet-remove")).toHaveCount(0); await noOverflow(page);
});

test("wallet activity throttle stays readable and can recover on retry", async ({ page }) => {
  await page.addInitScript(({ wallets }) => localStorage.setItem("shizzy:wallet-cache:v1", JSON.stringify({ wallets, savedAt: new Date().toISOString() })), { wallets: cachedWallets });
  let throttle = true;
  await page.route("**/api/wallet-activity?**", route => throttle ? route.fulfill({ status: 429, headers: { "Retry-After": "60" }, json: { error: "Too many data requests. Please wait 60 seconds and try again." } }) : route.fallback());
  await page.goto("/wallet-tracker");
  await page.getByRole("button", { name: `View recent transactions for wallet ${keys[0]}`, exact: true }).click();
  const activity = page.getByRole("region", { name: "Selected wallet recent activity", exact: true });
  const transfers = activity.getByRole("region", { name: "TAO transfers", exact: true });
  await expect(transfers).toContainText("Please wait 60 seconds");
  await noOverflow(page);
  throttle = false;
  await transfers.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(transfers).toContainText("Received TAO");
  await noOverflow(page);
});

test("archived unavailable evidence is not clickable and partner referrals remain intact", async ({ page }) => {
  await page.goto("/subnet-news/2026-08-11");
  await expect(page.locator(".news-source-unavailable")).toHaveCount(5);
  await expect(page.locator('a[href*="/api/backend/v1/subnets/"][href*="/prices"]')).toHaveCount(0);
  await noOverflow(page); await page.goto("/partners");
  await expect(page.locator('a[href="https://saygm.com/r/qm2gl6jx"]')).toBeVisible();
  await expect(page.locator('a[href="https://engy.ai/r/ShizzyUnchained"]')).toBeVisible();
  await expect(page.locator(".partner-banner")).toHaveCount(7); await noOverflow(page);
});

test("shared privacy footer opens readable notice and wallet controls remain reachable", async ({ page }) => {
  await page.goto("/partners");
  await page.getByRole("contentinfo", { name: "Privacy and contact" }).getByRole("link", { name: "Privacy & data", exact: true }).click();
  await expect(page).toHaveURL("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy & data", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText("eligible for deletion after 24 hours");
  await expect(page.locator("main")).toContainText("do not issue a server-side deletion request");
  await noOverflow(page);
  await page.getByRole("navigation", { name: "Privacy topics" }).getByRole("link", { name: "On your device", exact: true }).click();
  await expect(page).toHaveURL("/privacy#storage");
  await page.getByRole("link", { name: "Wallet Tracker", exact: true }).click();
  await expect(page).toHaveURL("/wallet-tracker");
  await expect(page.getByRole("contentinfo", { name: "Privacy and contact" })).toBeVisible();
  await noOverflow(page);
});

test("sector discovery supports overlap, search, unknown slots and subnet navigation", async ({ page }) => {
  await page.goto("/sectors");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bittensor");
  await page.getByRole("button", { name: "Robotics & Physical AI 7", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "subnets found" })).toContainText("7 subnets found");
  await expect(page.getByRole("link", { name: "OpenRoboto", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Swarm", exact: true })).toBeVisible();
  await noOverflow(page);
  await page.getByRole("searchbox", { name: "Find a subnet", exact: true }).fill("SN80");
  const card=page.getByRole("article").filter({ hasText: "OpenRoboto" });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Computer Vision", exact: true }).click();
  await expect(card).toBeVisible();
  await page.getByRole("searchbox", { name: "Find a subnet", exact: true }).fill("no matching sector subnet");
  await expect(page.getByRole("heading", { name: "No matches in this view", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show all subnets", exact: true }).click();
  await page.getByRole("searchbox", { name: "Find a subnet", exact: true }).fill("SN113");
  await expect(page.getByRole("article")).toContainText("Unknown");
  await expect(page.getByRole("article")).toContainText("Unclassified");
  await page.getByRole("searchbox", { name: "Find a subnet", exact: true }).fill("SN80");
  await page.getByRole("link", { name: "Chart & subnet details", exact: true }).click();
  await expect(page).toHaveURL("/charts/80");
});

 test("market signals show indexed buy volume, share period controls and filter sector deep links",async({page})=>{
 await page.goto("/");const signals=page.getByRole("region",{name:"Market signals",exact:true});await expect(signals.getByText("60% buy volume",{exact:true})).toBeVisible();await expect(signals.getByRole("heading",{name:"Strongest",exact:true})).toBeVisible();await expect(signals.getByRole("heading",{name:"Weakest",exact:true})).toBeVisible();await expect(signals.getByText(/rising · .* falling.*against TAO/)).toBeVisible();await signals.getByRole("group",{name:"Market signal period",exact:true}).getByRole("button",{name:"24H",exact:true}).click();await expect(signals.getByRole("group",{name:"Market signal period",exact:true}).getByRole("button",{name:"24H",exact:true})).toHaveAttribute("aria-pressed","true");const surgePeriod=signals.getByRole("group",{name:"Trading Surge period",exact:true});await expect(surgePeriod.getByRole("button",{name:"1H",exact:true})).toHaveAttribute("aria-pressed","true");await surgePeriod.getByRole("button",{name:"24H",exact:true}).click();await signals.getByRole("group",{name:"Market signal period",exact:true}).getByRole("button",{name:"1H",exact:true}).click();await expect(surgePeriod.getByRole("button",{name:"24H",exact:true})).toHaveAttribute("aria-pressed","true");await expect(page.getByRole("button").filter({hasText:"Markets rising · USD"})).toBeVisible();await expect(page.getByRole("button").filter({hasText:"Weakest mover · USD"})).toBeVisible();await page.getByRole("group",{name:"Display currency",exact:true}).getByRole("button",{name:"TAO",exact:true}).click();await expect(page.getByRole("button").filter({hasText:"Markets rising · TAO"})).toBeVisible();await expect(page.getByRole("button").filter({hasText:"Weakest mover · TAO"})).toBeVisible();await expect(signals.getByText(/Median move against TAO/)).toBeVisible();await page.getByRole("group",{name:"Display currency",exact:true}).getByRole("button",{name:"USD",exact:true}).click();await signals.getByRole("group",{name:"Buyers and Sellers period",exact:true}).getByRole("button",{name:"1H",exact:true}).click();await expect(signals.getByText("43% buy volume",{exact:true})).toBeVisible();await signals.getByRole("group",{name:"Buyers and Sellers period",exact:true}).getByRole("button",{name:"24H",exact:true}).click();await expect(signals.getByText("60% buy volume",{exact:true})).toBeVisible();await signals.getByRole("button",{name:"Buyers vs Sellers details",exact:true}).click();const detail=page.getByRole("dialog",{name:"Buyers vs Sellers",exact:true});await expect(detail.getByText(/not the number of traders/)).toBeVisible();await detail.getByRole("button",{name:"Close market signal details"}).click();for (const name of ["Sector Heat", "Trading Surge"]) {await signals.getByRole("button",{name:`${name} details`,exact:true}).click();const panel=page.getByRole("dialog",{name,exact:true});await expect(panel.getByRole("heading",{name,exact:true})).toBeVisible();await panel.getByRole("button",{name:"Close market signal details"}).click();}await noOverflow(page);await page.goto("/sectors?sector=robotics");await expect(page.getByRole("heading",{name:"Robotics & Physical AI",exact:true})).toBeVisible();await expect(page.getByRole("status").filter({hasText:"subnets found"})).toContainText("7 subnets found");
 });

test("owner wallet opens subnet alpha sales instead of general wallet transfers",async({page,contracts})=>{await page.goto("/charts/51");await page.getByRole("button",{name:"View SN51 owner alpha sales",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Owner alpha sales",exact:true});await expect(dialog.getByText("12.5 α sold",{exact:true})).toHaveCount(2);await expect(dialog.getByRole("link",{name:"View transaction",exact:false})).toBeVisible();await expect(dialog.getByText("TAO transfers",{exact:true})).toHaveCount(0);expect(contracts.calls.filter(p=>p==="/api/wallet-activity")).toHaveLength(0);await noOverflow(page);await dialog.getByRole("button",{name:"Close owner alpha sales",exact:true}).click();await expect(dialog).not.toBeVisible();});

test("latest news opens the full edition and retains the archive", async ({ page }) => {
  await page.goto("/subnet-news");
  await expect(page.getByText("Bittensor Daily News",{exact:true})).toBeVisible();
  const edition=page.getByRole("combobox",{name:"Choose news edition"});
  const dates=await edition.locator("option").evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value));
  expect(dates.length).toBeGreaterThan(70);
  const count=await page.locator(".news-item").count();
  const brief=JSON.parse(readFileSync(`content/subnet-news/${dates[0]}.json`,"utf8"));
  const items=[...brief.highlights,...brief.ecosystem,...brief.subnets.flatMap((subnet: {updates:unknown[]})=>subnet.updates)];
  const unique=[...new Map(items.map(item=>[JSON.stringify(item),item])).values()];
  expect(count).toBe(unique.length);
  for(const item of unique){
    const story=page.locator(".news-item").filter({has:page.getByRole("heading",{name:item.headline,exact:true})});
    await expect(story).toContainText(item.summary);
  }
  const headline=page.getByRole("heading",{level:1});
  await expect(headline).toBeVisible();
  await expect(page.getByRole("region",{name:"Main story"}).getByRole("heading",{level:1})).toHaveCount(1);
  const headlineBounds=await headline.boundingBox();
  expect(headlineBounds!.y).toBeLessThan(520);
  await expect(page.getByRole("heading",{name:"The lead story",exact:true})).toHaveCount(0);
  await noOverflow(page);
  await page.goto(`/subnet-news/${dates[0]}`);
  await expect(page.locator(".news-item")).toHaveCount(count);
  await page.getByRole("combobox",{name:"Choose news edition"}).selectOption(dates[1]);
  await expect(page).toHaveURL(new RegExp(`/subnet-news/${dates[1]}$`));
  await expect(page.getByText("From the archive",{exact:true})).toBeVisible();
  await noOverflow(page);
});

test("scheduled livestreams stay out of recent videos and replays", async ({ page }) => {
  await page.goto("/video");
  const upcoming=page.getByRole("region",{name:"Upcoming livestreams",exact:true});
  await expect(upcoming.getByRole("button")).toHaveCount(3);
  await expect(upcoming).toContainText("October 28, 2026");
  await expect(upcoming).toContainText("October 29, 2026");
  await expect(page.locator(".video-library").getByRole("button",{name:/Leadpoet’s Latest|Gets Expressive|Yanez/})).toHaveCount(0);
  await expect(page.getByRole("region",{name:"Livestream replays",exact:true}).getByRole("button",{name:/Leadpoet’s Latest|Gets Expressive|Yanez/})).toHaveCount(0);
  await expect(page.locator(".video-caption")).toContainText("Now playing");
  await upcoming.getByRole("button",{name:/Leadpoet’s Latest/}).click();
  await expect(page.locator(".video-caption")).toContainText("Upcoming live stream");
  await expect(page.locator(".video-caption")).toContainText("October 28, 2026");
  await noOverflow(page);
});

test("Balls supports search, paused dragging, legacy links and chart details", async ({ page }) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/bubbles?currency=tao");
  await expect(page).toHaveURL(/\/balls\?currency=tao$/);
  await expect(page.getByRole("heading",{level:1,name:"Balls.",exact:true})).toBeVisible();
  const map=page.getByRole("region",{name:"Interactive subnet ball map",exact:true});
  await expect(map.locator(".pool-pocket")).toHaveCount(4);
  await expect.poll(()=>map.locator(".bubble-field").evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=window.innerHeight;})).toBe(true);
  await expect(map.locator(".market-bubble")).toHaveCount(markets.length);
  await expect(map.getByRole("button",{name:"Resume motion",exact:true})).toBeVisible();
  await map.getByRole("searchbox",{name:"Find a subnet",exact:true}).fill("SN51");
  await expect(map.locator(".search-dimmed")).toHaveCount(markets.length-1);
  const bubble=map.getByRole("button",{name:/^SN51 Smoke Lium,/});
  await bubble.scrollIntoViewIfNeeded();
  const before=await bubble.boundingBox();
  await expect(map.locator("canvas.ball-canvas")).toBeVisible();
  await page.mouse.move(before!.x+before!.width/2,before!.y+before!.height/2);
  await page.mouse.down();
  await page.mouse.move(before!.x+before!.width/2+65,before!.y+before!.height/2+40,{steps:12});
  await page.mouse.up();
  await expect.poll(()=>bubble.boundingBox()).not.toEqual(before);
  await expect(page.getByRole("complementary",{name:"SN51 details",exact:true})).toHaveCount(0);
  const clicked=await bubble.boundingBox();
  await page.mouse.click(clicked!.x+clicked!.width/2,clicked!.y+clicked!.height/2);
  const details=page.getByRole("complementary",{name:"SN51 details",exact:true});
  await expect(details).toContainText("Smoke Lium");
  await expect(details.getByRole("button",{name:"Open subnet chart"})).toBeVisible();
  await page.getByRole("button",{name:"Close subnet details",exact:true}).click();
  await map.getByRole("button",{name:"Clear search",exact:true}).click();
  await map.getByRole("button",{name:"Reset layout",exact:true}).click();
  await expect(map.locator(".market-bubble")).toHaveCount(markets.length);
  await noOverflow(page);
  await bubble.press("Enter");
  await details.getByRole("button",{name:"Open subnet chart"}).click();
  await expect(page).toHaveURL(/\/charts\/51/);
});


test("full ball map frame profile", async ({ page }, testInfo) => {
  const session=await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate",{rate:4});
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto("/balls");
  await expect(page.locator(".bubble-field[data-ready=true] .market-bubble")).toHaveCount(128);
  const measure=()=>page.evaluate(()=>new Promise<{frames:number;meanMs:number;p95Ms:number;styleMutations:number}>(resolve=>{
    const intervals:number[]=[];let start=0,last=0,styleMutations=0;
    const observer=new MutationObserver(rows=>{styleMutations+=rows.length;});
    observer.observe(document.querySelector(".bubble-field")!,{subtree:true,attributes:true,attributeFilter:["style"]});
    const frame=(now:number)=>{if(!start)start=now;if(last)intervals.push(now-last);last=now;
      if(now-start<3000){requestAnimationFrame(frame);return;}
      observer.disconnect();const sorted=[...intervals].sort((a,b)=>a-b);
      resolve({frames:intervals.length,meanMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,p95Ms:sorted[Math.floor(sorted.length*.95)],styleMutations});};
    requestAnimationFrame(frame);
  }));
  const profile=await measure();
  console.log(`BALL_PROFILE ${testInfo.project.name} ${JSON.stringify(profile)}`);
  await testInfo.attach("ball-frame-profile",{body:JSON.stringify(profile,null,2),contentType:"application/json"});
  await session.send("Emulation.setCPUThrottlingRate",{rate:1});const native=await measure();
  console.log(`BALL_NATIVE ${testInfo.project.name} ${JSON.stringify(native)}`);
  await testInfo.attach("ball-native-frame-profile",{body:JSON.stringify(native,null,2),contentType:"application/json"});
  expect(profile.frames).toBeGreaterThan(0);
  expect(profile.styleMutations,"Animation must not change every ball DOM style each frame").toBeLessThan(512);
});


test("trading card loads honestly and retains a timestamped snapshot during an outage",async({page})=>{
 await page.clock.install();
 let release:()=>void=()=>{};const first=new Promise<void>(resolve=>{release=resolve;});let calls=0,failed=false;
 await page.route("**/api/market-signals",async route=>{calls++;if(calls===1)await first;if(failed)return route.fulfill({json:{buying:null,sectors:[],tags:[]}});return route.fallback();});
 await page.goto("/");const signals=page.getByRole("region",{name:"Market signals",exact:true});
 await expect(signals.getByText("Loading trading data",{exact:false})).toBeVisible();
 await expect(signals.getByText("Trading data unavailable",{exact:true})).toHaveCount(0);
 release();await expect(signals.getByText("60% buy volume",{exact:true})).toBeVisible();
 failed=true;await page.clock.fastForward(60000);
 await expect(signals.getByText(/Refresh delayed/)).toBeVisible();await expect(signals.getByText("60% buy volume",{exact:true})).toBeVisible();
 failed=false;await page.clock.fastForward(15000);await expect(signals.getByText(/Refresh delayed/)).toHaveCount(0);
 failed=true;await page.clock.fastForward(16*60000);await expect(signals.getByText("delayed, not live",{exact:false})).toBeVisible();await page.clock.fastForward(345*60000);await expect(signals.getByText("Trading data unavailable",{exact:true})).toBeVisible();
 await expect(signals.getByText("60% buy volume",{exact:true})).toHaveCount(0);
 const response=await page.request.get("/api/market-signals?period=24h");expect((await response.json()).buying).toBeNull();expect(response.headers()["cache-control"]).toBe("no-store");
});


test("hourly trading refresh retries independently and never substitutes daily totals",async({page})=>{
 await page.clock.install();let release:()=>void=()=>{};const first=new Promise<void>(resolve=>{release=resolve;});let calls=0,failed=false;
 await page.route(url=>url.pathname==="/api/market-signals"&&url.searchParams.get("period")==="1h",async route=>{calls++;if(calls===1)await first;if(failed)return route.fulfill({status:503,json:{buying:null}});return route.fallback();});
 await page.goto("/");const signals=page.getByRole("region",{name:"Market signals",exact:true}),period=signals.getByRole("group",{name:"Buyers and Sellers period",exact:true});
 await expect(signals.getByText("60% buy volume",{exact:true})).toBeVisible();await period.getByRole("button",{name:"1H",exact:true}).click();
 await expect(signals.getByText("Loading hourly trades",{exact:false})).toBeVisible();await expect(signals.getByText("60% buy volume",{exact:true})).toHaveCount(0);
 release();await expect(signals.getByText("43% buy volume",{exact:true})).toBeVisible();failed=true;await page.clock.fastForward(60000);
 await expect(signals.getByText(/Refresh delayed/)).toBeVisible();await expect(signals.getByText("43% buy volume",{exact:true})).toBeVisible();
 failed=false;await page.clock.fastForward(15000);await expect(signals.getByText(/Refresh delayed/)).toHaveCount(0);
 await period.getByRole("button",{name:"24H",exact:true}).click();await expect(signals.getByText("60% buy volume",{exact:true})).toBeVisible();
 await period.getByRole("button",{name:"1H",exact:true}).click();await expect(signals.getByText("43% buy volume",{exact:true})).toBeVisible();
 const previous=calls;await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));await expect.poll(()=>calls).toBeGreaterThan(previous);
 failed=true;await page.clock.fastForward(16*60000);await expect(signals.getByText("delayed, not live",{exact:false})).toBeVisible();await page.clock.fastForward(345*60000);await expect(signals.getByText("Trading data unavailable",{exact:true})).toBeVisible();await expect(signals.getByText("43% buy volume",{exact:true})).toHaveCount(0);
});

test("owner activity exposes a month and separates verified burns from trading",async({page})=>{
 await page.goto("/charts/51");const panel=page.getByRole("region",{name:"Owner wallet alpha activity",exact:true});await expect(panel.getByRole("heading",{name:"Owner wallet buys, sells & burns",exact:true})).toBeVisible();
 await panel.getByRole("group",{name:"Owner activity period",exact:true}).getByRole("button",{name:"30D",exact:true}).click();
 await expect(panel.getByText("Last 30 days",{exact:true})).toBeVisible();await expect(panel.getByText("300 α or more",{exact:true}).first()).toBeVisible();await expect(panel.getByText("+400 α",{exact:true}).first()).toBeVisible();await expect(panel).toContainText("partial history");await expect(panel).toContainText("Burns through");
 await noOverflow(page);
});

test("subnet research stays compact and preserves advanced metrics without extra owner requests",async({page})=>{
 let ownerRequests=0;page.on("request",request=>{if(request.url().includes('/api/subnets/owner-sales?'))ownerRequests++;});
 await page.goto('/charts/51');
 const snapshot=page.getByRole('region',{name:'Subnet market information',exact:true});
 expect(await snapshot.locator('.subnet-key-metrics>div').count()).toBe(6);
 await expect(snapshot.getByText('Estimated deregistration payout',{exact:true})).not.toBeVisible();
 await snapshot.getByText('More metrics & staking basis',{exact:true}).click();
 await expect(snapshot.getByText('Estimated deregistration payout',{exact:true})).toBeVisible();
 await expect(snapshot.getByText('Staked / outstanding alpha',{exact:true})).toBeVisible();
 const owner=page.getByRole('region',{name:'Owner wallet alpha activity',exact:true});
 await expect(owner.getByText('Net buying',{exact:true})).toBeVisible();const before=ownerRequests;
 await owner.getByRole('button',{name:'30D',exact:true}).click();
 await expect(owner.getByText('+400 α',{exact:true}).first()).toBeVisible();expect(ownerRequests).toBe(before);
 await owner.getByText('Exact amounts, transactions & coverage',{exact:true}).click();
 await expect(owner.getByText(/Burns through/)).toBeVisible();
 await page.getByRole('link',{name:'Owner activity ↓',exact:true}).click();
 await expect(page.getByRole('region',{name:'Subnet owner research',exact:true})).toBeInViewport();
 await noOverflow(page);
});

test('compact subnet news keeps every loaded story and reveals older pages immediately',async({page})=>{
 const entry=(n:number)=>({id:`news-${n}`,date:'2026-10-24',kind:'news',name:'Lium',status:'verified',rating:3,headline:`Retained story ${n}`,summary:`Full preserved update ${n}`,sources:[]});
 await page.route('**/api/subnets/51/news?offset=*',route=>{const older=new URL(route.request().url()).searchParams.get('offset')!=='0';return route.fulfill({json:{entries:older?[entry(6)]:[1,2,3,4,5].map(entry),total:6,nextOffset:older?null:5,archiveThrough:'2026-10-24'}});});
 await page.goto('/charts/51');const news=page.getByRole('region',{name:'Recent news & history',exact:true});
 await expect(news.getByRole('heading',{name:'Retained story 3',exact:true})).toBeVisible();
 await expect(news.getByRole('heading',{name:'Retained story 4',exact:true})).toHaveCount(0);
 await news.getByRole('button',{name:'Show 2 more updates',exact:true}).click();
 await expect(news.getByRole('heading',{name:'Retained story 5',exact:true})).toBeVisible();
 await news.getByRole('button',{name:'Load older updates',exact:true}).click();
 await expect(news.getByRole('heading',{name:'Retained story 6',exact:true})).toBeVisible();
 await expect(news.getByRole('heading',{name:'Retained story 1',exact:true})).toBeVisible();await noOverflow(page);
});
