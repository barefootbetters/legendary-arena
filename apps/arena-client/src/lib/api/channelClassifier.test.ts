import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyChannel } from './channelClassifier';

const HOST = 'arena.legendary-arena.com';

/** Build URLSearchParams from a query string (without the leading '?'). */
function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

test('direct: empty referrer', () => {
  assert.equal(classifyChannel('', params(''), HOST), 'direct');
});

test('direct: same-origin referrer', () => {
  assert.equal(classifyChannel(`https://${HOST}/?route=lobby`, params(''), HOST), 'direct');
});

test('direct: unparseable referrer', () => {
  assert.equal(classifyChannel('not a url', params(''), HOST), 'direct');
});

test('paid: gclid present (even with no referrer)', () => {
  assert.equal(classifyChannel('', params('gclid=abc123'), HOST), 'paid');
});

test('paid: utm_medium=cpc', () => {
  assert.equal(classifyChannel('https://example.test/', params('utm_medium=cpc'), HOST), 'paid');
});

test('paid: utm_medium=ppc / paid (case-insensitive)', () => {
  assert.equal(classifyChannel('', params('utm_medium=PPC'), HOST), 'paid');
  assert.equal(classifyChannel('', params('utm_medium=Paid'), HOST), 'paid');
});

test('paid wins over an otherwise-search referrer (a paid search ad)', () => {
  assert.equal(classifyChannel('https://www.google.com/', params('gclid=z'), HOST), 'paid');
});

test('search: a known search-engine referrer host', () => {
  assert.equal(classifyChannel('https://www.google.com/search?q=x', params(''), HOST), 'search');
  assert.equal(classifyChannel('https://duckduckgo.com/', params(''), HOST), 'search');
  assert.equal(classifyChannel('https://www.bing.com/', params(''), HOST), 'search');
});

test('referral: an unknown external host', () => {
  assert.equal(classifyChannel('https://news.example.test/article', params(''), HOST), 'referral');
});

test('search fragment does not false-match a look-alike host', () => {
  // 'googleblog.example' must NOT match the 'google.' fragment
  assert.equal(classifyChannel('https://googleblog.example/', params(''), HOST), 'referral');
});
