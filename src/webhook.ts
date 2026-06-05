import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookEvent } from './types';

export interface VerifyWebhookOptions {
  toleranceSeconds?: number;
  now?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 300;

interface ParsedSignature {
  timestamp: number;
  v1: string[];
}

function parseSignatureHeader(header: string): ParsedSignature | null {
  let timestamp: number | undefined;
  const v1: string[] = [];

  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === 'v1' && value) {
      v1.push(value);
    }
  }

  if (timestamp === undefined || v1.length === 0) return null;
  return { timestamp, v1 };
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyWebhookSignature(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string,
  options: VerifyWebhookOptions = {},
): boolean {
  if (!signatureHeader || !secret) return false;

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (tolerance > 0) {
    const now = options.now ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - parsed.timestamp) > tolerance) return false;
  }

  const body = typeof payload === 'string' ? payload : payload.toString('utf8');
  const signedPayload = `${parsed.timestamp}.${body}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');

  for (const candidate of parsed.v1) {
    if (safeEqualHex(candidate, expected)) return true;
  }
  return false;
}

export function parseWebhookEvent(payload: string | Buffer): WebhookEvent {
  const raw = typeof payload === 'string' ? payload : payload.toString('utf8');
  return JSON.parse(raw) as WebhookEvent;
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string,
  options: VerifyWebhookOptions = {},
): WebhookEvent {
  if (!verifyWebhookSignature(payload, signatureHeader, secret, options)) {
    throw new Error('Invalid Plaidly webhook signature');
  }
  return parseWebhookEvent(payload);
}
