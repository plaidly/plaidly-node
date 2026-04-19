# @plaidly/node

Official Node.js / TypeScript SDK for the [Plaidly](https://plaidly.io) cryptocurrency payment API.

## Installation

```bash
npm install @plaidly/node
```

## Usage

```typescript
import { PlaidlyClient } from '@plaidly/node';

const plaidly = new PlaidlyClient({ apiKey: process.env.PLAIDLY_API_KEY });

// Create a payment session
const session = await plaidly.sessions.create({
  amount: '10.00',
  currency: 'USDC',
  chain: 'solana',
  callbackUrl: 'https://yoursite.com/webhook',
});

console.log(session.walletAddress); // Send funds here
```

## Webhook Verification

```typescript
import { verifyWebhookSignature } from '@plaidly/node';

app.post('/webhook', (req, res) => {
  const valid = verifyWebhookSignature(
    req.rawBody,
    req.headers['x-plaidly-signature'],
    process.env.PLAIDLY_WEBHOOK_SECRET
  );
  if (!valid) return res.status(401).send('Invalid signature');
  // handle event
});
```

## API Reference

See [docs.plaidly.io](https://docs.plaidly.io) for full API documentation.
