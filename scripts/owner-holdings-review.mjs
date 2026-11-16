// A failed offline refresh must be explicit and public, never silently freshened.
export function validateHoldingsReview(snapshotDay, report, audit) {
  if (snapshotDay >= report.date) return;
  const review = audit?.ownerHoldings;
  if (audit?.date !== report.date || audit.dailyWorkflowComplete !== false ||
      review?.status !== 'BLOCKED' || !review.reason?.trim() ||
      !Number.isFinite(Date.parse(review.checkedAt)) ||
      Date.parse(review.checkedAt) < Date.parse(report.coverageStart) ||
      !review.evidence?.trim() ||
      !report.coverage?.gaps?.some(gap => /owner[- ]holdings/i.test(gap))) {
    throw new Error(`Refresh owner holdings for the ${report.date} daily news edition; snapshot is ${snapshotDay} Eastern, without a disclosed blocked refresh`);
  }
}
