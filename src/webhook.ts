import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies an incoming Plaidly webhook signature.
 *
 * The `X-Plaidly-Signature` header value is `sha256=<hex>` where the hex string
 * is HMAC-SHA256(webhookSecret, rawBody).
 *
 * @param payload  - Raw request body as a string or Buffer
 * @param signature - Value of the `X-Plaidly-Signature` header
 * @param secret    - Your webhook secret
 * @returns `true` if the signature is valid, `false` otherwise
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
