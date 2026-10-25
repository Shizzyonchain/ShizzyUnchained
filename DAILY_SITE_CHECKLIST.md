# Required daily site checklist

Use this checklist for every request to do today's news. Read `SUBNET_NEWS_PUBLISHING.md` for the detailed requirements. Complete news AND the video refresh unless the owner explicitly narrows the request. Never treat a collected link, a successful push, or a partial promotion update as completion.

Copy the checklist into dated research notes with the actual date, coverage window, check times, evidence paths and outcomes. Mark each item DONE, BLOCKED (specific reason), or NOT APPLICABLE (specific reason). An unchecked item remains unfinished. Do not claim exhaustive coverage or promise that nothing can ever be missed.

## Research and omission review

- [ ] Establish today's Eastern date and previous report's coverageEnd; record the actual cutoff and seven-day overlap.
- [ ] Verify signed-in X identity @ShizzyUnchained.
- [ ] Ask Grok for today's subnet news, explicitly including @const_reborn; save prompt, response, conversation link and lead dispositions.
- [ ] Ask Grok for today's top five most talked-about subnets; verify the leads and disclose ranking limitations.
- [ ] Check @const_reborn originals, quotes and substantive replies directly.
- [ ] Check @TensiaFDN (https://x.com/TensiaFDN) and @TensiaBot (https://x.com/TensiaBot) directly on every daily news run: originals, quote-posts, substantive replies and attached media within the coverage window, plus the seven-day overlap. Verify relevant claims against primary sources, deduplicate prior coverage, and record links, check times, editorial outcomes or access gaps in the dated source audit. Owner addition October 21, 2026.
- [ ] Review the full current subnet roster, official accounts, aliases, repositories, AlphaGap, SubnetRadar, TAO Daily and relevant partner sources.
- [ ] Inspect attached videos and images on candidate official posts, especially sparse captions such as "soon". Text extraction alone cannot establish what the media says. Record media viewed and its substantive content, or an explicit access gap. Never exclude a candidate solely because its caption is short; distinguish teasers from completed launches after review.
- [ ] Check finalized chain registration, deregistration and owner/coldkey changes using configured RPC and historical events; retain block/time references and state actual coverage limitations. Verify sales separately.
- [ ] Review market outliers, emission leaders, Moments, unresolved incidents and planned events; give each flagged omission a specific sourced disposition.
- [ ] Run the final Grok omission query against public draft headlines; resolve every new lead against primary sources.
- [ ] Explain why each material development matters in original, clear wording, rather than copying a source or listing headlines. Keep the team, actual development and evidence central.
- [ ] Carry forward unresolved leads and scheduled announcements from the previous audit; reconcile collected material against selected stories so a found item cannot silently disappear (the SN38 ChronoLLM and SN8 Vanta corrections).

## TaoStats daily cross-check — owner addition October 16, 2026

Include this section whenever the owner says "let's do today" or an equivalent daily-update request. Preserve our node/feed as primary, the existing design and USD/TAO calculations. This is a required research and health check, not a claim that the proposed API integrations are already implemented or permission to redesign the site.

- [ ] Verify server-side TaoStats access without exposing keys; record endpoint, check time, block/time freshness, pagination, errors and actual credit usage when available. Use the new `/v1/` API; the documented legacy API retirement is November 9, 2026. If access is unavailable, record a specific BLOCKED outcome and continue available sources.
- [ ] Cross-check finalized registrations, deregistrations and ownership changes against our direct chain review over the complete coverage window. Investigate discrepancies and retain block/event references. Distinguish coldkey migrations, scheduled changes and executed transfers; verify sales and prices separately.
- [ ] Compare screener completeness and freshness with current pools/market aggregates: missing market caps, prices, 1-hour/24-hour/7-day returns and emission history. Investigate discrepancies rather than silently overwriting our feed. Aggregates do not document a 10-minute return; verify units, timestamps and historical TAO/USD conversion before using backup values. Compare emission share consistently, not token-price change or incompatible raw emission amounts.
- [ ] Use buy/sell volume, unique buyers/sellers, liquidity, conviction/owner locks and active miner/validator metrics to investigate market outliers and news leads where relevant. Record sourced dispositions; trading activity alone is not adoption, a lock reduction is not a sale, and metrics alone do not establish project health or a five-star story.
- [ ] Check any implemented cached fallback and historical gap-repair paths for freshness and failures; keep an explicit pending status until implemented. Shared background collection must not add a TaoStats request per visitor or slow the homepage/wallet checker. Retain source/time labels and last-good data; never represent stale data as live.
- [ ] Review chart data gaps and carry forward historical-candle/backfill work when relevant. Preserve the public charts authorized by the owner; a compatible candle feed does not itself supply or license a TradingView chart product. No P&L or average purchase-price additions.
- [ ] Save `taostatsReview` in the dated research evidence with access/result status, endpoints, coverage, findings, lead outcomes, discrepancies, quota limitations and pending integration work. Use existing audit/schema fields where compatible; do not add unsupported report fields. No deployment for an unchanged check and no unrelated infrastructure work merely to complete the daily scan.

Reference: https://taostats.io/docs/new ; market aggregates: https://taostats.io/docs/new/subnets/get-subnets-pools-aggregate ; historical candles: https://taostats.io/docs/new/tradingview/get-tradingview-udf-history . Verify current endpoint costs and account entitlement before setting collection intervals; do not assume one request equals one credit.

## Full video refresh — separate from news and promotions

- [ ] Inspect BOTH the channel's Videos and Live tabs for new uploads, completed streams, upcoming streams, removals and reschedules.
- [ ] Compare actual YouTube IDs against the site's video library and promotions; record each new candidate's disposition.
- [ ] Verify title, availability, duration, public/members status and scheduled time/time zone before editing.
- [ ] Update the public library/default player as appropriate, latest members video and next verified stream. Updating only the members promotion does not complete this section.
- [ ] Preserve owner-requested removals and postponements; keep enabled/listed flags consistent.
- [ ] Verify the selected embeds and labels; record "no changes" only after checking both tabs.

## Editorial and publication gates

### Subnet detail news/history — standing requirement October 17, 2026

- [ ] Every daily update must feed the homepage subnet panels: put each material subnet story, registration, deregistration, verified ownership/sale development and sourced name change under the correct SN in the dated report. Keep actual event dates distinct from report dates, current team names accurate, and older editions intact.
- [ ] Check new names against finalized identity/registration evidence and the prior report. Unknown, unnamed or identity-pending labels are placeholders, not project renames. Archive name observations alone do not prove a chain rename, completed sale or ownership transfer. Keep old-project coverage labelled with its recorded name when a slot is reused. Follow TaoStats for unnamed-subnet display labels (currently SN113: Unknown); do not restore a historical name such as LongShort solely from another aggregator. Check the current TaoStats label each daily run and retain older editions unchanged.
- [ ] After publication, check affected subnet panels for the new dated stories and direct sources, plus older-history pagination. The panel automatically reads the published report archive; no separate manual copy is needed. Allow the five-minute news cache to refresh, or verify using a fresh request. Keep news loading on panel open, never in the homepage market-table loading path. Record outcomes/gaps in the dated checklist.

- [ ] Use verified SN numbers before names, justified star ratings, direct sources, accurate event dates and clear planned/developing labels; exclude unrelated crypto news.
- [ ] Save the dated source audit, mandatory marketReview, media dispositions, chain review and video review; preserve prior editions and deduplicate.
- [ ] Validate news, lint and build; inspect the final diff and commit only intended files.
- [ ] Push through the existing publication workflow and confirm the deployment succeeds. A push alone is not a live update.
- [ ] Verify the live dated news page, latest-news date, video library, relevant promotions and playback links.
- [ ] Report completed changes and any blocked steps accurately. Do not say the daily update is complete while an item remains unfinished. No X posting without applicable authorization.

## Standing site requirements — check when touching these features

These requirements come from the owner's earlier requests. They are regression checks, not a claim that every feature has been implemented or verified. A routine news update does not authorize an unrelated redesign or infrastructure change.

- [ ] Performance: keep the homepage, wallet checker and Finney data responsive. Investigate blank 10-minute/1-hour/24-hour/7-day returns and missing market caps; do not accept a roughly one-minute blank wait or claim a paid hosting plan alone fixes it. Verify actual loading behavior after relevant changes.
- [ ] Currency: USD returns must use historical alpha USD prices, including historical TAO/USD conversion; TAO returns must use alpha/TAO prices. Switching units must change the basis correctly. Preserve clearly labelled rolling periods; do not silently substitute daily-close returns.
- [ ] Mobile: preserve the owner's priority of 1-hour and 24-hour returns in the compact screener, and check navigation, readable values, table scrolling and touch controls after layout changes.
- [ ] Emissions: position between price and market cap; color by change in emission share over 24 hours, not by token-price change. Explain the basis and handle unchanged/missing history honestly.
- [ ] Metric explanations: use the designated space above the screener for all metric explanations rather than awkward floating tooltips. Make explanations available by keyboard and touch as well as hover.
- [ ] Table controls: preserve top and bottom horizontal scrolling controls and prevent sticky subnet cells from obscuring headings or values (the clipped "arket cap" report).
- [ ] Accessibility/search visibility: retain a meaningful homepage main heading and a real accessible search label, rather than the magnifying-glass character alone. Check focus, contrast and mobile usability after changes.
- [ ] Branding: pure black backgrounds, white primary text and the approved dark neutral surfaces; avoid faded contrast or blanket grayscale filters. Keep purposeful original assets and correct partner logos. Do not assume the exact neutral shade from chat alone; inspect established site tokens.
- [ ] Community: retain the Unchained TAO Heads name, homepage entry and dedicated page; avoid reverting to Unchained Insiders. Preserve the stronger hat-circle treatment and approved hat crop when modifying those assets.
- [ ] Sharing: main-site link previews should use a black background with the Shizzy logo; Shiz University links should use its own logo on black. Verify route-specific metadata when changing sharing assets. Preserve the requested chain-shaped U favicon direction, subject to the actual approved asset.
- [ ] Charts: keep rebuilt/researched subnet charts hidden until the owner asks to reveal them. Do not make a chart redesign public as part of unrelated work.
- [ ] Wallet checker: do not add P&L or average purchase-price calculations; the owner explicitly canceled that addition over speed concerns.
- [ ] Partners: preserve the correct logos and referral destinations. Engy: https://engy.ai/r/ShizzyUnchained ; SayGM public referral: https://saygm.com/r/qm2gl6jx . The SayGM affiliate dashboard URL is management access, not automatically the public signup CTA. Verify existing Mentat, AlphaGap, Ledger, NordVPN and AlphaChaser entries against their saved configuration before edits; never invent an unknown link or discount.
- [ ] Accounts and secrets: the owner permits relevant use of signed-in X, SayGM and Lium accounts. This is not permission to expose credentials or incur unspecified spending. Keep API keys out of chat, tracked files, screenshots and public frontend code; ask the owner if funding is needed.

## Explicit removals and scheduling constraints

- [ ] Do not restore Shiz Cat TAO replay `X1N2TGCSKhk`.
- [ ] Keep postponed VUNE/TAO.app appearance `lTRFZFVt7yI` removed from upcoming promotions and listings until a new date is confirmed.
- [ ] Keep uploader-removed SN91 Cascade episode `BAMp6OssHks` disabled; verify any approved replacement separately.
- [ ] Expired September 27 hourly monitoring and five-star X posting permission does not carry into current daily work. Respect each automation's end date; do not silently renew it.
- [ ] The October 9 one-time Const check does not authorize ongoing X posts; the standing daily direct Const research requirement remains in force.

## Earlier requests to reconcile — do not silently mark complete

This chat contains requests whose completion cannot be established from the request text alone. Inspect repository history and the live result before closing them. Keep this list separate from daily news so old one-time requests do not cause duplicate content or unwanted changes.

- [ ] Exploit conference catch-up: confirm separate Day 1 and Day 2 coverage, organized by team and what they discussed, with original research and placement after September 30; avoid stage-by-stage filler.
- [ ] Confirm partner coverage for Gordon Frayne's AlphaChaser project and the intended public offer; verify the actual project/link. Earlier screenshots describe community code SHIZZY25, 25% off the first two months for new customers. Do not publish a personal free-account code or private commission terms as a community offer.
- [ ] Confirm requested emissions placement/color, shared explanations and top/bottom table scrolling are live and usable, rather than relying on earlier discussion.
- [ ] Confirm the hidden chart work, favicon and route-specific sharing artwork were completed and remain consistent with the approved design.
- [ ] Track unresolved deployment/CI failures and market-data loading issues to live verification; do not treat a successful local build as resolution of a production failure.
- [ ] Daily visitor checks are on-demand: use authenticated analytics with an explicit date range; distinguish visitors from page views and do not infer visits from market API requests.

When the owner asks for an audit, include desktop and mobile, loading behavior, market-data accuracy, navigation, accessibility, search visibility, videos, partners and sharing previews. Report findings and verify fixes; do not claim a complete audit from a screenshot alone.

## October 12, 2026 correction

The SN8 Vanta post `https://x.com/VantaTrading/status/2109623415300825315` was collected but omitted after text extraction returned only "soon...." without reviewing the video. Today's latest members promotion was updated, but the full Videos/Live refresh was not completed. These are unfinished review steps, not successful no-change checks. Deployment/live verification was also pending when this checklist was introduced. This file does not mark those tasks complete.

## Reviewed owner lead — October 19, 2026

- [x] Review SN107 Minos's team-reported Montreal presentations on October 22 (HelixForge) and October 23 (subnet), attributed by the supplied lead to an October 16 official Discord update: https://subnetradar.com/subnet-news/107/2026-10-16. Check https://x.com/theminos_ai and https://x.com/centrum_blue for primary confirmation and attached media. Deduplicate previous coverage and preserve the October 16 announcement date. Verify the event name, venue, speaker, session titles and times against https://ashgmeeting.ashg.org/ and official team sources. The owner's supplied research suggests ASHG but does not establish that connection; do not present it as confirmed or confuse it with Exploit Summit. Treat October 22–23 appearances as scheduled, not completed. Independently verify HelixForge/research claims; coauthorship involving OpenAI does not establish investment or a commercial partnership. Include an accurately qualified item in October 19 news if relevant, or record the specific verification gap. Watch for scientific users, demonstrations and announced collaborations without inventing adoption. Supplied October 18; not independently checked at intake.

October 19 outcome: primary May 23 post https://x.com/theminos_ai/status/2058303856883446140 explicitly names ASHG and two scientific works. October 22–23 dates retain October 16 digest attribution; specific session titles/times/room remain unverified (linked official planner returned 404). Covered as scheduled/developing in the October 19 report, with IM2 separately planned and no commercial OpenAI tie inferred. See dated source audit.


## eTAO daily chain review (owner request October 20, 2026)
- Read `app/data/etao.json` and the `/subnet-news/etao` background snapshot. Review every pending observation; the 15-minute cron detects snapshot differences, not a complete event stream.
- Inspect finalized `SubnetEmissionWeightsSet` events since the last audited cutoff using our node where configured, with archive fallback for pruned blocks. Confirm full block-range coverage; record gaps honestly. A current-state comparison cannot rule out changes reversed between snapshots. No “zero changes today” badge without a complete event scan.
- Verify each event's block hash, extrinsic index, execution UTC time, subnet number/name and before/after five-slot storage. Check successful execution. Preserve prior verified changes in `app/data/etao.json`; archive dated evidence in the daily audit. Never replace legacy migration settings with an invented owner action.
- Include material changes in the daily news under the correct SN and subnet news/history mapping. Explain owner/miner/validator allocations, Root's baseline/cap, and why historical yield can lag. Link `/subnet-news/etao` and direct transactions. Keep pending snapshot observations distinct from verified transaction history.
- Refresh the checked-in snapshot, names and finalized coverage after review. The runtime cache is temporary and cannot serve as the permanent archive. Validate, lint, build and verify live on publication. Background cron uses read-only `ETAO_RPC_URL` (WebSocket) when configured, otherwise public archive RPC; visitor page requests never call the chain.

## Six-hour eTAO monitoring — owner addition October 20, 2026

The thread automation `verify-etao-changes-every-six-hours` reviews eTAO every six hours, in addition to the shared 15-minute snapshot cron. Verify transactions and preserve exact event/storage evidence before publishing changes to the eTAO archive and the current existing daily edition. Keep scope and full-history RPC gaps explicit; do not claim an exhaustive event scan from snapshots. Carry verified leads into the next full daily edition if no edition exists. No unchanged deployment; no visitor RPC requests.


## Daily X news roundup — owner authorization October 21, 2026

Every owner request such as “let’s do today’s” includes creating and posting one daily news roundup on the signed-in @ShizzyUnchained X account, automatically after the dated news edition is verified live. The owner explicitly selected automatic posting; no routine draft-approval step is required.

- Verify the signed-in identity and the live dated publication first. Select the most consequential verified stories with SN numbers and current names, clearly separating plans, team claims and confirmed execution.
- Lead with a strong promotional hook, concise daily highlights and a clear invitation to read the site. Vary the wording each day to attract readers. Write an engaging, readable original roundup, include the direct dated news link, and stay within the account’s supported post length. Do not use price predictions, investment promises or unsupported hype.
- Fact-check the final text against the published report. Do not disclose private bookmarks/history, credentials or unpublished research. No unrelated replies, reposts or DMs are authorized by this addition.
- Before posting, check the account’s recent posts and dated audit for an existing roundup for that edition. Publish once per edition; do not duplicate a successful post on retries or routine eTAO scans. The six-hour eTAO automation does not independently authorize additional X posts.
- Record the exact published text, direct post URL, time and publication outcome in the dated completion evidence. Verify the public post is present. If login, access or posting fails, report the specific blocker rather than claiming success.

## Daily transaction burns — owner addition October 21, 2026

On every daily run, inspect finalized chain events over the full interval since the previous burn review, using our configured node when available and an archive fallback when needed. Update `/subnet-news/burns` and preserve its prior transaction history. Track explicit non-miner alpha burns, buyback-and-burn executions and voluntary TAO balance burns. Exclude automatic miner-emission burns/withholding, `MinerBurned`, emission-allocation percentages and routine fees. Keep recycling and registration recycling distinct from burns; never infer transaction burns from cumulative counter changes or supply changes alone.

Verify runtime event definitions, successful execution (including nested proxy/batch/EVM outcomes), actual amounts/units, subnet registration identity/name, finalized block/hash, UTC time, event index and extrinsic link. Count the alpha burn once when `AlphaBurned` and `AddStakeBurn` describe the same operation; TAO spent on a buyback is not TAO burned. Do not sum different subnets' alpha as one fungible token. Preserve event IDs and coverage ranges; disclose missing blocks, failed reads and the historical start boundary. Add material verified developments to the correct SN in the dated news and subnet history, and retain routine transactions in the Burns archive with an explicit news disposition in the dated audit. Keep chain/indexer calls in offline daily collection, never visitor requests. No extra X post for a routine burn refresh.

Offline collector (reviewed runtime 484; split/review metadata before any runtime upgrade): run `python scripts/review-chain-news.py --from-block <previous archive toBlock + 1> --output <dated scan path>`, then review identities, outcomes and coverage. Use `python scripts/publish-burns.py <dated scan paths> --history-start <first reviewed UTC time>` to merge verified records without deleting earlier entries. Run `python tests/test_burns.py`, news validation, lint and build, then verify the live Burns filters, pagination and mobile layout. The collector uses read-only `ETAO_RPC_URL` if configured, otherwise Opentensor archive RPC. Record any unsupported runtime or RPC failure as a gap; never publish an incomplete scan as complete.

Owner burn threshold clarification October 21, 2026: report only individual burn events of at least 100 tokens (100 alpha for the relevant subnet, or 100 TAO for a TAO burn). Do not report small 2- or 12-token burns or aggregate them to qualify. Apply this to public burn cards, counts, totals, filters and daily news selection. Keep smaller events in underlying chain-review evidence for continuity. The threshold is native tokens, not dollars or TAO spent on an alpha buyback.

Owner wallets — October 21, 2026: preserve the owner coldkey shown in each subnet’s “What this subnet does” section, with copy and explorer controls. Verify against finalized `SubnetOwner`, not a validator hotkey or metadata contact. Shared eTAO cron refreshes the owner snapshot; daily seed edits must preserve/refresh `ownerSnapshot` and its own block/hash/check time. Label delayed data and never query RPC per visitor.

Wallet navigation/activity — October 21, 2026: owner wallet links open our `/wallet-tracker?address=...`, prefill the public coldkey and open recent activity while preserving saved wallets. Clicking a tracked wallet name opens its recent history. Signed extrinsics and incoming/outgoing TAO transfers are separate, on-demand cached TaoStats views; disclose proxy/inner-call and indexing limitations. No extra history fetch per saved wallet during initial holdings lookup, no P&L additions. Clear/remove controls must also clear the relevant in-memory history and respect hidden amounts.

Competition ratings — owner clarification October 21, 2026: cap routine competition stories at 3 stars, including competition/track launches, added rewarded assets, reward or payout adjustments, miner model eligibility, leaderboards and ordinary competition benchmark updates. Use 1–2 stars for minor housekeeping and up to 3 for a useful participation change. A new track or prize does not by itself merit 4–5 stars. Reserve higher ratings for independently substantive developments such as meaningful product capabilities, evidenced adoption/revenue, material protocol/security developments or a verifiable research result; do not promote competition mechanics by bundling them with unsupported claims. Preserve the story and sources, and explain its actual significance. Apply to today's edition and future daily runs; do not rewrite older editions solely for this rule.

Shizzy coverage priority — owner clarification October 22, 2026: rate Shizzy videos, interviews and livestream coverage 3 stars. This replaces the previous minimum-four-star video exception. Substantive non-video Shizzy announcements retain the prior minimum-four-star feature priority when Shizzy is actually the creator, host or subject; passing mentions and referral links do not qualify. Preserve evidence standards and accurate upcoming/completed labels. Apply to today and future editions, preserving older editions.


## Editorial quality gate — October 21, 2026

- Research every subnet, but do not require a published story for every collected link. Before selecting a story, record what materially changed, who is affected and the primary evidence. Exclude repeated promotion, vague teasers without a concrete date/capability, ordinary social chatter and routine commits without a meaningful user/miner/validator consequence; retain a specific disposition in the audit. Never exclude a safety incident or material chain change merely to shorten the report.
- Lead with completed capabilities, credible adoption evidence, material incidents, protocol changes and verified research. Keep actionable participation changes at up to three stars. Minor maintenance and early plans belong in the one/two-star short updates & watchlist when useful; avoid padding the lead feed.
- A website refresh or conference schedule alone ordinarily merits at most three stars. Evaluate any independently substantive development separately. Preserve the owner’s Shizzy original-coverage priority exception. Stars describe editorial priority, not investment quality or proof of a claim.
- Write concise summaries around what changed and why it matters. Use concrete evidence qualifications rather than repetitive generic caveats. Give a specific rating reason, not “capped at three stars.” Deduplicate follow-ups unless they resolve an incident, confirm execution or supply actionable new details.
- Keep actual event dates and upcoming/completed labels explicit. For team-reported figures, distinguish a team statement from independent verification. Carry unresolved claims forward in the audit rather than republishing the same speculation each day.
- Before publication, check the main feed and expanded short updates on mobile, and verify source links and subnet-history mapping. Keep research coverage and its limitations visible; never equate roster count with exhaustive discovery.

## Sector directory maintenance — October 22, 2026

Review `/sectors` during daily site work. Reconcile all 128 slots in `app/data/sectors.json` with current owner-node identities/descriptions and official project sources. Recheck tags after registration reuse, ownership, name or purpose changes; never silently inherit an old project’s categories. Multiple sectors are allowed when supported. Unknown, parked, sale or insufficient metadata remains Unclassified until a source establishes the product. Record source URLs, current block and review time, refresh the dated public evidence, and preserve the distinction between a project’s stated direction and a live product. Sector tags are editorial discovery, not return/adoption rankings. Keep filtering local and chart links unprefetched to avoid 128 background loads.

Sector review refinement October 22: all 128 slots have explicit review outcomes; Unclassified is an evidence outcome, not an unchecked backlog. Recheck on-chain links against the project itself: a linked README may describe a different SN (SN29 currently links to SN14 material), or point to a successor repository (SN96). Prefer current product documentation over a stale short description, retain both in the dated evidence, and avoid asserting production deployment from a README alone. Software Engineering, Education & Learning and Gaming are valid product sectors; do not tag every subnet as Software, Agents, Security or Training simply because it uses code, an agent, validation or a model internally.


## Pre-push release gate — October 24, 2026

Before every push, run `npm run verify:release`: source UTF-8 integrity, production dependency audit, lint, full JS suite, isolated production smoke build, and bounded desktop/phone visitor checks. This checkout uses the tracked `.githooks/pre-push` hook (`git config core.hooksPath .githooks`). Fresh checkouts must enable that hook and install the repository Playwright Chromium runtime (`npx playwright install chromium`). Do not bypass the gate or disable CI/notification checks to hide failures. Fix failing selectors and verify their intended behavior before pushing. The source-text check also runs in CI. Write edited files explicitly as UTF-8; do not round-trip existing source through Windows legacy encoding. Smoke-build artifacts contain synthetic data and must not be deployed as prebuilt production output; Vercel must perform its normal production build.


## Required eTAO and Burns completion gate — October 24, 2026

Every daily news run must complete BOTH chain reviews before sign-off, including retries and "today's news" requests. Run `python scripts/review-chain-news.py --from-block <earliest archive reviewed head + 1> --output <dated evidence path>` through one recorded finalized cutoff. This combined offline collector checks runtime metadata, positive event controls and every block; it reconciles all current emission vectors while detecting intermediate changes. A runtime/layout change or missing range is BLOCKED until reviewed, never an empty-event result.

- [ ] Read both durable archives, any later complete evidence receipts and pending eTAO observations. Start without a gap in either archive; overlapping an already reviewed range is safe.
- [ ] Verify eTAO executions and exact before/after five-slot vectors, registration identities and all qualifying transaction burns. Preserve history. The burn minimum remains 100 native tokens PER EVENT; miner emissions, allocation withholding, fees and recycling are excluded.
- [ ] Reconcile BOTH public archives through the same finalized block/hash/time, even when no qualifying change was found. Save durable source evidence and a separate `chainReviews.etao` / `chainReviews.burns` receipt in the dated audit: status DONE or BLOCKED, checkedAt, fromBlock, toBlock, hash, throughTime, evidence, gaps, archiveUpdated and newsDisposition. For BLOCKED add reason and the public coverage gap; do not mark the daily workflow complete.
- [ ] Put material verified events under the correct SN in today's existing news, preserving other stories; retain routine events in Burns with an explicit editorial disposition. Never create a one-story daily edition or duplicate the daily tweet for a later chain refresh.
- [ ] Verify live eTAO review-through time, pending observations, Burns minimum/filters and affected subnet news after READY deployment. No visitor chain RPC, new per-visitor requests or unchanged-content deployment for routine monitor checks.

The news validator requires these receipts for editions from October 24 onward. A DONE receipt must have contiguous finalized coverage, a reconciled archive and a cutoff within 30 minutes of the report cutoff (or later). The 10 AM daily automation includes this gate. The separate six-hour eTAO monitor remains active; it supplements the daily review rather than replacing it.

Video classification correction — October 24, 2026: scheduled Leadpoet (q2pGNLUvCm4) and TAO Templar (RnnWezJOuE8) are upcoming LIVESTREAMS, not recent completed videos. Keep all scheduled streams in the dedicated Upcoming livestreams shelf with verified schedule/time zones; exclude upcoming entries from Recent videos and Livestream replays, and never use an upcoming stream as the default player. Move to replay status only after verifying completion on YouTube during the daily refresh.

Owner activity windows — October 24, 2026: keep 24H, 7D and rolling 30D owner buys/sells on subnet pages, with local period buttons on phones. Retain the 5-TAO per-trade minimum, fee-conversion exclusions and bounded pagination/partial-history labels. Owner Burned uses only finalized explicit alpha or buyback burns attributed to the currently verified coldkey and that SN, at least 100 alpha PER EVENT; exclude miner emissions, recycling and other wallets. Burn windows end at the displayed archive cutoff, which is separate from trade time. Burn history is backfilled to September 22 using complete paginated event-index discovery and independent finalized RPC verification of every qualifying burn; preserve the historicalReview evidence and methodology on all future archive publications. Keep longer windows partial whenever they exceed reviewed coverage; never imply missing history is zero. Burns remain separate from bought-minus-sold net trading. Preserve the burn archive throughTime when publishing scans; no per-visitor chain RPC.


## Mandatory daily owner holdings — October 24, 2026

- Run `python scripts/refresh-owner-holdings.py` using the configured read-only archive node during every daily news run, before publishing. Requires substrate-interface (the existing chain-review environment). The collector reads every active SN1–128 owner, per-subnet total/locked/unstakable alpha and free/frozen/root-staked TAO at one finalized block. It requires reviewed runtime 484; review schema changes before supporting a new runtime.
- Publish `app/data/owner-holdings.json` AND its permanent `public/evidence/owner-holdings-BLOCK.json` receipt in the same news push. Never replace a failed query with zero or regress the snapshot. Keep the previous dated data on failure.
- Run `npm run validate:owner-holdings`. The latest news edition requires a holdings snapshot from the same Eastern date or later; build validation enforces this and verifies evidence/roster consistency. Record `ownerHoldings` DONE/BLOCKED, block/hash/asOf, evidence and errors in the dated audit. A failed refresh is a blocker to the full daily sign-off, not permission to fabricate balances.
- Verify the live SN owner panel, including a nonzero alpha holder and small TAO balance, after READY. It must match the currently verified owner, display the snapshot time and an overdue label after 36 hours, and suppress old-owner balances after an ownership change. Keep all RPC offline; visitor requests only read the published snapshot through the existing owners endpoint. Figures cover the current owner coldkey, not every team or exchange wallet. Other subnets' alpha and EVM custody are excluded. Free TAO is distinct from spendable, frozen, reserved or root-staked TAO; do not label it a full portfolio value. Daily holdings refresh does not warrant an extra tweet.

Subnet burn scope — October 24, 2026: subnet pages distinguish `Owner-wallet burns` (only the currently verified coldkey) from `Subnet burns · all wallets` (every wallet on that SN). Both use the shared finalized archive cutoff and 24H/7D/30D controls. Subnet totals include owner burns; never add the two totals or subtract either from bought-minus-sold net trading. Keep the 100-alpha PER EVENT minimum and exclusions for miner emissions/recycling/fees, exact raw arithmetic, coverage labels and visible burn cutoff. Vanta's burn wallet differs from its owner coldkey; never infer no subnet burns from zero owner-wallet burns.


Snapshot metrics — October 25, 2026: the mandatory `refresh-owner-holdings.py` collector also reads each subnet's SubnetAlphaOutEmission and five-slot eTAO weights at the same finalized holdings block. Preserve `ownerEmissionRates` in its evidence and validate the 7,200-block daily-rate calculation; owner/day is an estimate in alpha valued at the current quote, not actual trailing-day income or business revenue. Never restore a hard-coded 18% share. The compact market card uses the shared owners response (coalesced with owner activity), no new visitor chain calls. FDV is spot × the nominal 21M cap, rank is market-cap rank among available subnet rows, current supply is SubnetAlphaIn + SubnetAlphaOut (not circulating or lifetime issuance). Card burns are all-wallet qualifying ≥100-alpha events over 30 days ending at the displayed archive cutoff, not lifetime burns; preserve registration filters and coverage labels. Keep owner, market and burn timestamps separate and owner locks restricted to the verified coldkey. Preserve all detailed metrics and the USD/TAO rolling-return basis.
