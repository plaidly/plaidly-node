# @plaidly/node

Official Node.js / TypeScript SDK for the [Plaidly](https://plaidly.io) cryptocurrency payment API.

Zero runtime dependencies — built on the platform `fetch`. Ships full
snake_case contract types, automatic retries with timeout, and a
constant-time webhook signature verifier.

- Requires Node.js >= 18.
- Base URL: `https://api.plaidly.io`

## Installation

```bash
npm install @plaidly/node
```

## Quickstart

```typescript
import { PlaidlyClient } from '@plaidly/node';

const plaidly = new PlaidlyClient({ apiKey: process.env.PLAIDLY_API_KEY! });

// 1. Create a payment session (server-to-server, requires API key)
const session = await plaidly.paymentSessions.create({
  amount: 10.0,
  expires_in: '15m',
  paymentMethod: {
    methodID: 0,            // 0 = crypto
    chain: 'solana',
    token: 'USDC',
    network: 'mainnet',
  },
  metadata: { order_id: 'A-1001' },
});

console.log(session.address);      // deposit address — send funds here
console.log(session.payment_url);  // hosted checkout URL for the payer
console.log(session.qr_data);      // payment URI for QR encoding

// 2. Poll for completion (public endpoint — safe from the browser)
const latest = await plaidly.paymentSessions.get(session.session_id);
console.log(latest.status);        // pending -> ... -> completed | confirmed
```

`completed` or `confirmed` both mean success. Helpers are exported:

```typescript
import { isSuccessStatus, isFailureStatus } from '@plaidly/node';

if (isSuccessStatus(latest.status)) { /* fulfill order */ }
if (isFailureStatus(latest.status)) { /* expired or failed */ }
```

## Endpoints

```typescript
// Payment sessions
plaidly.paymentSessions.create(req);          // POST /v1/payment_sessions     (API key)
plaidly.paymentSessions.createDemo(opts?);    // POST /v1/payment_sessions/demo (public)
plaidly.paymentSessions.get(sessionId);       // GET  /v1/payment_sessions/{id} (public)
plaidly.paymentSessions.simulate(sessionId);  // POST /v1/payment_sessions/{id}/simulate (demo/sandbox)
plaidly.paymentSessions.receipt(sessionId);   // GET  …/receipt -> Blob (PDF)

// Discovery (all public)
plaidly.paymentMethods.list();                // GET /v1/payment_methods
plaidly.rates.get(['ETH', 'SOL']);            // GET /v1/rates?symbols=ETH,SOL
plaidly.sandbox.faucets();                    // GET /v1/sandbox/faucets

// Merchants, payouts, wallets
plaidly.merchants.register({ name, webhook_url });
plaidly.merchants.me();
plaidly.payouts.request(req);
plaidly.wallets.list();
```

### Demo & sandbox flow

```typescript
const demo = await plaidly.paymentSessions.createDemo({ chain: 'ethereum', token: 'USDC' });
const done = await plaidly.paymentSessions.simulate(demo.session_id); // instantly completes
console.log(done.status); // "completed"
```

## Webhook verification

Plaidly signs each delivery with an `X-Plaidly-Signature` header of the form
`t=<unix>,v1=<hex>`, where `<hex>` is `HMAC-SHA256(webhook_secret, "<t>.<rawBody>")`.
Verification is constant-time and rejects timestamps outside a 5-minute
tolerance by default. **You must pass the raw, unparsed request body.**

```typescript
import { verifyWebhookSignature, constructWebhookEvent } from '@plaidly/node';

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-plaidly-signature'] as string;
  const secret = process.env.PLAIDLY_WEBHOOK_SECRET!;

  // Option A: boolean check
  if (!verifyWebhookSignature(req.body, sig, secret)) {
    return res.status(401).send('invalid signature');
  }

  // Option B: verify + parse in one step (throws on bad signature)
  const event = constructWebhookEvent(req.body, sig, secret);
  console.log(event.event_type, event.session_id, event.status);

  res.sendStatus(200);
});
```

Override the tolerance (seconds) if needed:

```typescript
verifyWebhookSignature(rawBody, sig, secret, { toleranceSeconds: 600 });
```

## Configuration

```typescript
new PlaidlyClient({
  apiKey,              // required for authenticated endpoints
  baseUrl,             // default https://api.plaidly.io
  timeout,             // per-request ms, default 30_000 (AbortController)
  maxRetries,          // retries on 502/503/504 and network errors, default 3
  fetch,               // inject a custom fetch (testing / non-global runtimes)
});
```

Errors are thrown as `PlaidlyError` with `statusCode` and `code`.

## License

MIT
