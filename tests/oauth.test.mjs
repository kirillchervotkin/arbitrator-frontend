import test from 'node:test';
import assert from 'node:assert/strict';
import { readOAuthResult, polarAuthorizationUrl } from '../src/utils/oauth.ts';
const popup = {};
const origin = 'http://localhost:3000';
const event = { source: popup, origin, data: { type: 'OAUTH_CONNECT', success: true } };
test('accept success and failure from the expected callback window', () => {
  assert.equal(readOAuthResult(event, popup, origin), true);
  assert.equal(readOAuthResult({ ...event, data: { type: 'OAUTH_CONNECT', success: false } }, popup, origin), false);
});
test('ignore forged origins, unrelated windows and malformed payloads', () => {
  assert.equal(readOAuthResult({ ...event, origin: 'https://attacker.example' }, popup, origin), null);
  assert.equal(readOAuthResult({ ...event, source: {} }, popup, origin), null);
  for (const data of [null, 'OAUTH_CONNECT', { type: 'OTHER', success: true }, { type: 'OAUTH_CONNECT', success: 'true' }]) {
    assert.equal(readOAuthResult({ ...event, data }, popup, origin), null);
  }
});
test('accept only Polar HTTPS authorization links with state', () => {
  assert.equal(polarAuthorizationUrl('https://flow.polar.com/oauth2/authorization?state=abc'), 'https://flow.polar.com/oauth2/authorization?state=abc');
  for (const url of ['javascript:alert(1)', 'http://flow.polar.com/?state=x', 'https://flow.polar.com.attacker.example/?state=x', 'https://flow.polar.com/']) {
    assert.throws(() => polarAuthorizationUrl(url));
  }
});
