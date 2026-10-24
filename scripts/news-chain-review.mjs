/** Required chain review receipts for every new daily edition. No RPC during publishing. */
export function validateChainReviews(report, audit, archives) {
  if (report.date < "2026-10-24") return;
  const receipts = audit?.chainReviews;
  for (const kind of ["etao", "burns"]) {
    const receipt = receipts?.[kind];
    if (!receipt || !["DONE", "BLOCKED"].includes(receipt.status)) throw new Error(`${report.date}: ${kind} review must be DONE or explicitly BLOCKED`);
    if (!Number.isFinite(Date.parse(receipt.checkedAt)) || !receipt.evidence?.trim() || !receipt.newsDisposition?.trim()) throw new Error(`${kind}: review time, durable evidence and news disposition required`);
    if (receipt.status === "BLOCKED") {
      if (!receipt.reason?.trim() || !report.coverage.gaps.some(gap => gap.toLowerCase().includes(kind))) throw new Error(`${kind}: blocked review must explain the gap in the public report`);
      if (audit.dailyWorkflowComplete === true) throw new Error(`${kind}: blocked review cannot be a completed daily workflow`);
      continue;
    }
    if (!Number.isInteger(receipt.fromBlock) || !Number.isInteger(receipt.toBlock) || receipt.fromBlock < 1 || receipt.toBlock < receipt.fromBlock || !/^0x[\da-f]{64}$/i.test(receipt.hash || "") || !Array.isArray(receipt.gaps) || receipt.gaps.length) throw new Error(`${kind}: contiguous finalized range, hash and no gaps required for DONE`);
    const through = Date.parse(receipt.throughTime);
    if (!Number.isFinite(through) || through < Date.parse(report.coverageEnd) - 30 * 60_000 || through > Date.parse(receipt.checkedAt) + 60_000) throw new Error(`${kind}: finalized review cutoff must be fresh at the news cutoff`);
    const archive = archives?.[kind];
    const archivedThrough = kind === "etao" ? archive?.eventReview?.toBlock : archive?.toBlock;
    if (receipt.archiveUpdated !== true || !Number.isInteger(archivedThrough) || archivedThrough < receipt.toBlock) throw new Error(`${kind}: public archive must be reconciled before publication`);
  }
  if (receipts.etao.status === "DONE" && receipts.burns.status === "DONE" && (receipts.etao.toBlock !== receipts.burns.toBlock || receipts.etao.hash !== receipts.burns.hash)) throw new Error('eTAO and burns must reach the same finalized cutoff');
}
