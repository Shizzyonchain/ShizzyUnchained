# Daily edition running order

Read [NEWS_HOUSE_STYLE.md](NEWS_HOUSE_STYLE.md) for the canonical story structure, classifications, presentation, updates/corrections and editorial sign-off. This document supplies the explicit running-order implementation rules.

Owner correction November 10, 2026: Gamma activation and the concrete SN58 service offering should lead the edition, ahead of Sami Kassab's research. A shared four-star rating does not make those stories equally suitable as the main headline.

For every edition from November 10 onward, provide a `storyOrder` array containing every distinct published headline exactly once. The first headline selects the verified main story. The publisher, runtime reader and edition renderer validate this order. Earlier editions retain their historical ordering.

Choose the lead deliberately after reviewing the full report. Weigh material impact, verified execution, new usable products, freshness and consequences for readers. Network activation and concrete service adoption normally lead attributed fund opinions or research recaps. A genuinely more consequential research or fund announcement can lead when the evidence and editorial judgment support it. Never hardcode a project or person as the permanent lead.

Then order major network and subnet changes, substantive research and fund perspectives, useful operational developments, and minor briefs. Keep related developments adjacent where helpful. Preserve actual announcement dates and distinguish implementation, configuration, announced availability, paid use and forecasts.

Stars remain importance judgments, not layout controls. Do not inflate a rating to force a story into the lead. Keep confidence labels separate. The displayed main story and the daily roundup's opening must describe the same editorial lead; do not publish another roundup merely to reorder an existing edition.

Before release, inspect the actual lead and the next several headlines on both desktop and phone-sized layouts. Confirm the complete report survives reordering, no story is duplicated or dropped, and later corrections update `storyOrder` when they add or rename a headline. Record the lead rationale and reviewed order in the dated audit.
