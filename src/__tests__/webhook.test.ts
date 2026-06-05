import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import {
  verifyWebhookSignature,
  parseWebhookEvent,
  constructWebhookEvent,
} from '../webhook';

const SECRET = 'whsec_test_secret';
const TIMESTAMP = 1700000000;
const BODY =
  '{"event_type":"payment_session.completed","session_id":"ps_123","status":"completed","amount":10,"currency":"USDC","chain":"solana","network":"mainnet","timestamp":"2023-11-14T22:13:20Z"}';
const GOLDEN_SIG = 'cef092a305a42eeda73974b13ef45e7ac84a3ba600e30240bbc3bff1a32d6897';
const GOLDEN_HEADER = `t=${TIMESTAMP},v1=${GOLDEN_SIG}`;

function header(payload: string, secret: string, t: number): string {
  const sig = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

test('golden vector — valid signature passes within tolerance', () => {
  const now = TIMESTAMP + 60;
  assert.equal(verifyWebhookSignature(BODY, GOLDEN_HEADER, SECRET, { now }), true);
});

test('golden vector — exact recomputed hmac matches the committed digest', () => {
  const sig = createHmac('sha256', SECRET).update(`${TIMESTAMP}.${BODY}`).digest('hex');
  assert.equal(sig, GOLDEN_SIG);
});

test('tampered body fails', () => {
  const tampered = BODY.replace('"amount":10', '"amount":999');
  assert.equal(
    verifyWebhookSignature(tampered, GOLDEN_HEADER, SECRET, { now: TIMESTAMP }),
    false,
  );
});

test('wrong secret fails', () => {
  assert.equal(
    verifyWebhookSignature(BODY, GOLDEN_HEADER, 'wrong_secret', { now: TIMESTAMP }),
    false,
  );
});

test('expired timestamp outside tolerance fails', () => {
  const now = TIMESTAMP + 301;
  assert.equal(verifyWebhookSignature(BODY, GOLDEN_HEADER, SECRET, { now }), false);
});

test('future timestamp outside tolerance fails', () => {
  const now = TIMESTAMP - 301;
  assert.equal(verifyWebhookSignature(BODY, GOLDEN_HEADER, SECRET, { now }), false);
});

test('tolerance disabled (0) ignores timestamp drift', () => {
  const now = TIMESTAMP + 999_999;
  assert.equal(
    verifyWebhookSignature(BODY, GOLDEN_HEADER, SECRET, { now, toleranceSeconds: 0 }),
    true,
  );
});

test('Buffer payload is accepted', () => {
  assert.equal(
    verifyWebhookSignature(Buffer.from(BODY), GOLDEN_HEADER, SECRET, { now: TIMESTAMP }),
    true,
  );
});

test('malformed header (no t) fails', () => {
  assert.equal(
    verifyWebhookSignature(BODY, `v1=${GOLDEN_SIG}`, SECRET, { now: TIMESTAMP }),
    false,
  );
});

test('malformed header (no v1) fails', () => {
  assert.equal(
    verifyWebhookSignature(BODY, `t=${TIMESTAMP}`, SECRET, { now: TIMESTAMP }),
    false,
  );
});

test('empty header fails', () => {
  assert.equal(verifyWebhookSignature(BODY, '', SECRET), false);
});

test('empty secret fails', () => {
  assert.equal(verifyWebhookSignature(BODY, GOLDEN_HEADER, ''), false);
});

test('multiple v1 candidates — one valid passes', () => {
  const valid = createHmac('sha256', SECRET).update(`${TIMESTAMP}.${BODY}`).digest('hex');
  const headerVal = `t=${TIMESTAMP},v1=deadbeef,v1=${valid}`;
  assert.equal(
    verifyWebhookSignature(BODY, headerVal, SECRET, { now: TIMESTAMP }),
    true,
  );
});

test('signature with non-hex v1 fails gracefully', () => {
  assert.equal(
    verifyWebhookSignature(BODY, `t=${TIMESTAMP},v1=zzzz`, SECRET, { now: TIMESTAMP }),
    false,
  );
});

test('freshly signed payload round-trips', () => {
  const now = 1800000000;
  const h = header(BODY, SECRET, now);
  assert.equal(verifyWebhookSignature(BODY, h, SECRET, { now }), true);
});

test('parseWebhookEvent decodes the body', () => {
  const event = parseWebhookEvent(BODY);
  assert.equal(event.event_type, 'payment_session.completed');
  assert.equal(event.session_id, 'ps_123');
  assert.equal(event.status, 'completed');
  assert.equal(event.chain, 'solana');
});

test('constructWebhookEvent returns event for valid signature', () => {
  const event = constructWebhookEvent(BODY, GOLDEN_HEADER, SECRET, { now: TIMESTAMP });
  assert.equal(event.session_id, 'ps_123');
});

test('constructWebhookEvent throws on invalid signature', () => {
  assert.throws(
    () => constructWebhookEvent(BODY, GOLDEN_HEADER, 'wrong', { now: TIMESTAMP }),
    /Invalid Plaidly webhook signature/,
  );
});
