# @plaidly/node

Official Node.js / TypeScript SDK for the [Plaidly](https://plaidly.io) cryptocurrency payment API.

Types and the underlying HTTP client are auto-generated from the Plaidly
OpenAPI 3.1 specification. The high-level `PlaidlyClient`, retry middleware,
and `verifyWebhookSignature` helper are hand-written wrappers on top.

## Installation

```bash
npm install @plaidly/node
```

## Usage

```typescript
import { PlaidlyClient } from '@plaidly/node';

const plaidly = new PlaidlyClient({ apiKey: process.env.PLAIDLY_API_KEY! });

// Create a payment session
const session = await plaidly.paymentSessions.create({
  amount: 10.0,
  expires_in: '15m',
  paymentMethod: {
    methodID: 0,
    chain: 'solana',
    token: 'USDC',
    network: 'mainnet',
  },
});

console.log(session.address); // Send funds here
```

## Webhook Verification

```typescript
import { verifyWebhookSignature } from '@plaidly/node';

app.post('/webhook', (req, res) => {
  const valid = verifyWebhookSignature(
    req.rawBody,
    req.headers['x-plaidly-signature'],
    process.env.PLAIDLY_WEBHOOK_SECRET!,
  );
  if (!valid) return res.status(401).send('Invalid signature');
  // handle event
});
```

## Escape hatch — raw generated client

For endpoints not yet exposed on `PlaidlyClient`, use the underlying
[`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) client:

```typescript
const { data, error } = await plaidly.raw.GET('/v1/me', {});
```

## Regenerating from the spec

Types come from [`openapi-typescript`](https://openapi-ts.dev/). The
committed copy of the Plaidly spec lives at `spec/openapi.yaml`.

```bash
# default: reads spec/openapi.yaml
npm run generate

# override with a remote spec
OPENAPI_URL=https://raw.githubusercontent.com/plaidly/plaidly-api/master/api/openapi.yaml \
  npm run generate
```

Generated output: `src/generated/schema.ts` (do not edit by hand).

Pinned versions:

- `openapi-typescript@7.6.1`
- `openapi-fetch@0.13.4`

## API Reference

See [docs.plaidly.io](https://docs.plaidly.io) for full API documentation.
