/** Structural validation cannot determine editorial significance or verify a claim. */
export function validateNewsRating(item, date, field = "item") {
  if (date < "2026-09-04" && item.rating === undefined) return;
  if (!Number.isInteger(item.rating) || item.rating < 1 || item.rating > 5) {
    throw new Error(`Subnet News: ${field}.rating must be an integer from 1 to 5.`);
  }
  if (typeof item.ratingReason !== "string" || !item.ratingReason.trim()) {
    throw new Error(`Subnet News: ${field}.ratingReason must explain the editorial priority.`);
  }
  if (date >= "2026-11-12") {
    const review = item.ratingAssessment;
    if (!review || review.rubricVersion !== "2026-11-11") {
      throw new Error(`Subnet News: ${field}.ratingAssessment requires rubricVersion 2026-11-11.`);
    }
    for (const key of ["claimType", "consequence", "evidence", "scope", "uncertainty", "adjacentRatingReason"]) {
      if (typeof review[key] !== "string" || !review[key].trim()) {
        throw new Error(`Subnet News: ${field}.ratingAssessment.${key} is required.`);
      }
    }
    if (review.claimType === "substantive-identity-change" && item.rating < 4) {
      throw new Error(`Subnet News: ${field} substantive identity changes require at least 4 stars.`);
    }
    if (review.claimType === "routine-competition" && item.rating > 3) {
      throw new Error(`Subnet News: ${field} routine competitions cannot exceed 3 stars.`);
    }
    if (review.claimType === "shizzy-video" && item.rating !== 3) {
      throw new Error(`Subnet News: ${field} Shizzy videos require 3 stars.`);
    }
  }
}
