# Bittensor Daily News house style

Owner request, November 10, 2026: clear rules and one coherent news page. Read this before writing, ordering or reviewing an edition. This is the canonical editorial and presentation standard. It supersedes older instructions that sort the feed mechanically by stars. It does not replace `NEWS_STAR_RUBRIC.md`, source-review requirements, the publishing cutoff, approval rules or release checks.

## 1. Choose the front page, then write it

One main headline per edition. Choose it after reviewing the whole coverage window, not from the first account scanned or the order in a source array. Compare significance, verified substance, reader consequences, novelty and timeliness. A completed network change, substantial usable product, material incident or evidenced adoption normally outranks a recap of a fund's views. Important original research can lead when its evidence and consequences warrant it. No person, fund or subnet owns the lead slot.

Use explicit `storyOrder` under `NEWS_EDITORIAL_ORDER.md`. Stars measure significance; verification describes evidence; running order expresses editorial judgment. Those are three different decisions. Never inflate stars to obtain placement. Apply the current rubric, including at least four stars for a verified substantive team/project name change and the existing competition/video exceptions.

For November 10: Gamma and SN58's announced robotics-data offering lead; explain the separate network activation and subnet offering together without calling availability paid adoption. Major subnet changes follow. Sami Kassab, Stillcore and Yuma belong in substantive research coverage with their claims attributed. Smaller operational updates follow; minor briefs finish the report. Preserve every existing story and source.

## 2. A consistent reading path

The page hierarchy is masthead and edition date, selected lead, other major developments, research and analysis, useful operational news, minor briefs/watchlist, then methodology, coverage and archive. Group related developments so readers understand one story instead of encountering disconnected fragments. Omit empty sections rather than fill quotas. Keep all selected stories accessible in the full daily edition.

The main headline has the strongest visual emphasis. Secondary stories share a consistent heading size; briefs are visibly subordinate. The dated edition, latest page, homepage news promotion and single daily X roundup must agree on the lead. Tool navigation, promotions and coverage machinery must not overwhelm the first story. Preserve tool access and archive navigation. This is the presentation standard for page changes, not a claim that every section has already been implemented in the renderer.

## 3. The same story structure everywhere

Write an informative headline stating the actor and concrete change. Prefer a short active sentence, usually 8-16 words; clarity takes priority over a rigid limit. Put the verified SN before a subnet name. Explain unfamiliar names or acronyms promptly. Avoid promotional adjectives, vague 'major announcements' and headlines built around a personality when the actual news is a product or protocol change.

Start with what happened, who is affected and when. Follow with why it matters, the material specifics and the evidence boundary. Use short paragraphs, normally 2-4 sentences for a straightforward daily item; expand when necessary for a major story. Keep exact amounts, old/new names, before/after allocations, dates and units when material. Do not compress away facts to meet a word target. A brief usually needs 1-2 sentences.

The reader should learn the news before encountering source-access logs, extrinsic indices or rating justification. Retain essential evidence links and concise qualifications in the story; keep detailed provenance, verification logs and coverage gaps in the audit/coverage notes. Remove internal instructions such as 'merge this lead' or 'reconcile pending' from public copy. No em dashes or generic financial-disclaimer padding.

## 4. Distinguish the kind of reporting

Use these classifications in the editorial audit and identify them clearly in public wording. Future visible section/type labels must use these meanings consistently:

- News: an established event or attributed announcement. Say 'announces', 'plans' or 'reports' when that is the verified fact, rather than implying execution.
- Research: another party's study, thesis, estimates or reported fund performance. Name the author/firm, date, scope, method and limitations that affect interpretation. Do not present a published estimate as independently audited revenue.
- Analysis: our evidence-based explanation of implications. Separate established facts from our inference and explain the connection.
- Opinion: a person's judgment or conviction, explicitly attributed. Shizzy's voice remains welcome; do not pass it off as an independently established fact.
- Watchlist: a useful unresolved development or future event, with the specific uncertainty or scheduled date.

A sourced report that a fund made a claim can be verified while the underlying claim remains unconfirmed. Explain that distinction near the claim. Preserve confidence/status fields; a label alone does not repair overconfident wording. Do not classify every institutional source as a hedge fund: verify its actual role and the speaker's affiliation.

## 5. Updates, corrections and chronology

Preserve the first publication time and actual event date. Display reader-friendly Eastern times with the timezone; keep exact ISO/UTC evidence in the audit. Date late-found news explicitly. A new fact or reordered lead is an update. A factual mistake requires a visible correction explaining what was wrong and what is now correct, with the actual correction time. Do not erase a previous factual correction when adding a later update.

Do not use `correctedAt`/`correctionNote` for a routine reorder. Those existing fields mean factual correction. Any separate public update timestamp/history needs schema and rendering support before use. Until implemented, retain routine editorial changes in the dated audit rather than mislabelling them. Preserve historical editions; do not rewrite them merely to impose today's style.

## 6. Required editorial sign-off

Add an `editorialReview` object to each new dated audit with actual review time, overall DONE/BLOCKED status, selected lead and rationale, lead alternatives considered, complete ordered headlines, and per-story classification, section and disposition. Record whether the page/roundup lead agrees, copy is reader-facing, research claims are attributed, event/publication times are accurate, source gaps are disclosed, and substantive corrections are explained. Record actual desktop/phone checks or an explicit gap. Do not prefill DONE.

Before release read the page as a reader: can someone identify the day's main development, understand it without knowing the jargon, distinguish fact from interpretation, and find supporting evidence? Check the first several headlines together, not isolated cards. Existing automated ordering/schema tests complement this review; they do not prove editorial quality. Carry blocked items forward and report material omissions under the existing alert policy. Do not create another roundup or extra automation for a layout correction.

## Research basis and limits

Reviewed November 10, 2026. These are our adapted house rules, not claims about another newsroom's private editorial process or a review of every newspaper. Public homepage observations concern hierarchy and labels, not verification of their unrelated stories.

- [Financial Times](https://www.ft.com/): prominent lead, short supporting description, related coverage and editorial selections.
- [Wall Street Journal](https://www.wsj.com/): top-story hierarchy and supporting summaries, with market data distinct from the story list.
- [Guardian](https://www.theguardian.com/international): separate news and opinion navigation.
- [Washington Post standards](https://www.washingtonpost.com/policies-and-standards/): distinguish evidence-based analysis from opinion.
- [Reuters standards](https://reutersagency.com/about/standards-values/): prioritize accuracy, sourcing and transparent correction.
- [AP standards](https://www.ap.org/about/news-values-and-principles/telling-the-story/): make factual corrections visible to readers.

The New York Times homepage was inaccessible during this review; no claim is made that its current layout was inspected. No paywall, account or permission changes were made.
