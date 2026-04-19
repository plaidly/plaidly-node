import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature } from '../webhook';

function sign(payload: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}

test('verifyWebhookSignature — returns true for valid signature', () => {
  const payload = '{"event":"payment.completed"}';
  const secret = 'whsec_test';
  const signature = sign(payload, secret);
  assert.equal(verifyWebhookSignature(payload, signature, secret), true);
});

test('verifyWebhookSignature — returns false for tampered payload', () => {
  const secret = 'whsec_test';
  const signature = sign('{"event":"payment.completed"}', secret);
  assert.equal(verifyWebhookSignature('{"event":"tampered"}', signature, secret), false);
});

test('verifyWebhookSignature — returns false for wrong secret', () => {
  const payload = '{"event":"payment.completed"}';
  const signature = sign(payload, 'correct_secret');
  assert.equal(verifyWebhookSignature(payload, signature, 'wrong_secret'), false);
});

test('verifyWebhookSignature — accepts Buffer payload', () => {
  const payload = Buffer.from('{"event":"payment.completed"}');
  const secret = 'whsec_test';
  const signature = sign(payload.toString(), secret);
  assert.equal(verifyWebhookSignature(payload, signature, secret), true);
});

test('verifyWebhookSignature — returns false for length-mismatched signature', () => {
  const payload = '{"event":"payment.completed"}';
  assert.equal(verifyWebhookSignature(payload, 'sha256=bad', 'secret'), false);
});
