import test from "node:test";
import assert from "node:assert/strict";
import { validateNewsRating } from "../scripts/news-rating.mjs";

test("unscored legacy reports remain readable; scored editions require valid ratings", () => {
  assert.doesNotThrow(() => validateNewsRating({}, "2026-09-03"));
  for (const rating of [undefined, 0, 6, 2.5, "4", null]) {
    assert.throws(() => validateNewsRating({ rating, ratingReason: "Evidence reviewed" }, "2026-11-10"), /rating must/);
  }
  for (const ratingReason of [undefined, "", "   ", 4]) {
    assert.throws(() => validateNewsRating({ rating: 4, ratingReason }, "2026-11-10"), /ratingReason/);
  }
  for (const rating of [1, 2, 3, 4, 5]) {
    assert.doesNotThrow(() => validateNewsRating({ rating, ratingReason: "Specific significance and evidence" }, "2026-11-10"));
  }
});

test('new editions require claim-specific assessment and preserve owner exceptions', () => {
  const assessment = { rubricVersion: '2026-11-11', claimType: 'partnership', consequence: 'New distribution', evidence: 'Named primary announcement', scope: 'Specific launch role', uncertainty: 'Usage not disclosed', adjacentRatingReason: 'Major role; exceptional scale not established' };
  const item = { rating: 4, ratingReason: 'Consequential launch role', ratingAssessment: assessment };
  assert.doesNotThrow(() => validateNewsRating(item, '2026-11-12'));
  assert.throws(() => validateNewsRating({ rating: 4, ratingReason: 'Major' }, '2026-11-12'), /rubricVersion/);
  for (const key of ['claimType', 'consequence', 'evidence', 'scope', 'uncertainty', 'adjacentRatingReason']) {
    assert.throws(() => validateNewsRating({ ...item, ratingAssessment: { ...assessment, [key]: '' } }, '2026-11-12'));
  }
  for (const [claimType, rating] of [['substantive-identity-change', 2], ['routine-competition', 4], ['shizzy-video', 5]]) {
    assert.throws(() => validateNewsRating({ ...item, rating, ratingAssessment: { ...assessment, claimType } }, '2026-11-12'));
  }
  assert.doesNotThrow(() => validateNewsRating({ ...item, rating: 5 }, '2026-11-12'));
});
