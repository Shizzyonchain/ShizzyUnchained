import test from 'node:test';
import assert from 'node:assert/strict';
import { measurementDestination as destination } from '../app/lib/measurement-destinations.ts';
const base = 'https://shizzyunchained.com/subnet-news/toolkit';

test('tool destinations expose fixed categories without query, fragment or saved choices', () => {
  assert.equal(destination('/subnet-news/burns?subnet=14#event-123', base), 'burns');
  assert.equal(destination('/subnet-news/search?q=private-search&subnet=117', base), 'news_search');
  assert.equal(destination('/subnet-news/watchlist/', base), 'news_watchlist');
  assert.equal(destination('/subnet-news/toolkit', base), 'toolkit');
  assert.equal(destination('/subnet-news/recovery-math?price=123', base), 'recovery_math');
  assert.equal(destination('/subnet-news/holding-periods', base), 'holding_returns');
  assert.equal(destination('#prices', base), undefined);
});

test('external lookalikes and unknown or malformed destinations are excluded', () => {
  for (const href of ['https://example.com/subnet-news/burns', 'https://lium.io.evil.test/', 'javascript:alert(1)', 'mailto:a@example.com', 'https://[', '/charts/private-wallet']) {
    assert.equal(destination(href, base), undefined);
  }
  assert.equal(destination('https://lium.io/?private=anything', base), 'lium');
  assert.equal(destination('/video', base), 'videos');
  assert.equal(destination('/partners#btcc', base), 'partners');
});
