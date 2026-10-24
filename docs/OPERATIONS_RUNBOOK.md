# Site operations and evidence register

Reviewed October 22, 2026. This is a navigation/runbook document, not proof that unperformed operational tests succeeded.

## Ownership and deployment
Owner: ShizzyUnchained. App: Shizzyonchain/ShizzyUnchained, main branch. Vercel project: shizzyunchained (prj_MAPiC5LEH5bVOkTbFLRkck5XNHpa), production domain shizzyunchained.com. Vercel serves Next.js; backend is a separate Render service with owner node and TaoStats fallbacks. Never put credentials in this document. Production changes require lint, complete JS/Python suites and bounded browser gates (CI_TESTING.md), READY deployment and live verification. Roll back through Vercel deployment history to a known healthy build; data/schema compatibility must be checked separately.

## Integrations and scheduled work
- Market/chart/validator data: backend cache and background workers; keep visitor requests free of node scans. Check source timestamps as well as HTTP status. A stale cache must not be reported as fresh.
- Wallet jobs: backend queued work; browser caches are distinct from server records. Retention and user deletion scope: /privacy. Public endpoint limits and unfinished edge rollout: PUBLIC_ENDPOINT_PROTECTION.md.
- News, videos, sectors, eTAO and burns: DAILY_SITE_CHECKLIST.md and SUBNET_NEWS_PUBLISHING.md are authoritative. Retain dated evidence and previous reports. Check finalized coverage intervals, not only equal current snapshots.
- Analytics: fixed destination-category click events only. No raw searches, wallet IDs, balances, complete outbound URLs or claimed purchase conversions. Query/fragment and recognized wallet address redaction applies to Web Analytics. Verify dashboard receipt after deployment; ad blockers or account-plan limits may suppress collection.
- Owner removed Today on Shizzy and the local subnet watchlist October 23. The app no longer reads or writes shizzy:watchlist:v1; legacy entries can be removed using browser clear site data controls.
- Video discovery searches existing titles/dates and links explicit SN labels to charts/news history. No inferred chapter/transcript coverage.

## F16 recovery and alerts: evidence still required
No restore drill, delivered alert test or combined invoice reconciliation was verified in this audit. Do not mark these complete from a health endpoint or Git history.
1. Owner records the database provider, backup schedule, retention, access owner and restore credentials in a private operations system. No secrets in Git.
2. Restore a backup into an isolated temporary database, with production writes and external jobs disabled. Compare schema, row counts, sampled records and source timestamps; record backup time, duration, checks and deletion of temporary resources. Never restore over production as a test.
3. Configure an external synthetic probe for market source age, chart response/candle freshness, validator prepared snapshot age and backend errors. Exercise a test-only failing target; confirm actual notification receipt, recovery notification, deduplication and named responder. Do not induce a production outage.
4. Reconcile Vercel, Render, node, TaoStats and other paid API invoices for the same billing interval. Record limits, budget owner and delivery-tested threshold alerts. Dashboard traffic is not a total cost statement.
5. Record date, operator and evidence in the audit repair tracker. Keep F16 open until these checks have evidence.

## Corrections
Use footer Feedback & corrections. Preserve original event and publication dates. Record material edits in dated editorial audit; do not fabricate correction timestamps for old reports that lack them. Existing source-unavailable notices must remain visible. Material corrections use paired correctedAt/correctionNote fields, validated by publisher and reader and displayed on the report and latest-report page; actual edit timestamps only.
