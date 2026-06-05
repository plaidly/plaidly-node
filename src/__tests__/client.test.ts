import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PlaidlyClient } from '../client';
import { PlaidlyError } from '../types';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function mockFetch(handler: (call: Call) => Response | Promise<Response>): {
  fetch: typeof fetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers: Record<string, string> = {};
    const h = init?.headers as Record<string, string> | undefined;
    if (h) for (const [k, v] of Object.entries(h)) headers[k] = v;
    const call: Call = {
      url,
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? init.body : undefined,
    };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { fetch: fn, calls };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SESSION = {
  session_id: 'ps_1',
  merchant_id: 'm_1',
  expected_amount: 10,
  received_amount: 0,
  address: '0xabc',
  status: 'pending',
  metadata: {},
  expires_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  demo: false,
  paymentMethod: { methodID: 0, chain: 'ethereum', token: 'USDC', network: 'mainnet' },
};

test('create payment session — POST snake_case path, auth header, JSON body', async () => {
  const { fetch, calls } = mockFetch(() => json(SESSION, 201));
  const client = new PlaidlyClient({ apiKey: 'sk_test', fetch });
  const session = await client.paymentSessions.create({
    amount: 10,
    expires_in: '15m',
    paymentMethod: { methodID: 0, chain: 'ethereum', token: 'USDC', network: 'mainnet' },
  });
  assert.equal(session.session_id, 'ps_1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url, 'https://api.plaidly.io/v1/payment_sessions');
  assert.equal(calls[0].headers['X-API-Key'], 'sk_test');
  assert.equal(calls[0].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].body!).paymentMethod.chain, 'ethereum');
});

test('create requires apiKey', async () => {
  const { fetch } = mockFetch(() => json(SESSION, 201));
  const client = new PlaidlyClient({ fetch });
  await assert.rejects(
    () =>
      client.paymentSessions.create({
        amount: 1,
        expires_in: '15m',
        paymentMethod: { methodID: 0, chain: 'solana', token: 'SOL', network: 'mainnet' },
      }),
    (err: unknown) => err instanceof PlaidlyError && err.code === 'MISSING_API_KEY',
  );
});

test('createDemo — public POST with optional body', async () => {
  const { fetch, calls } = mockFetch(() => json({ ...SESSION, demo: true }, 201));
  const client = new PlaidlyClient({ fetch });
  const session = await client.paymentSessions.createDemo({ chain: 'tron', token: 'USDT' });
  assert.equal(session.demo, true);
  assert.equal(calls[0].url, 'https://api.plaidly.io/v1/payment_sessions/demo');
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].body!), { chain: 'tron', token: 'USDT' });
});

test('get session — encodes id in path, no auth needed', async () => {
  const { fetch, calls } = mockFetch(() => json(SESSION));
  const client = new PlaidlyClient({ fetch });
  await client.paymentSessions.get('ps/with space');
  assert.equal(
    calls[0].url,
    'https://api.plaidly.io/v1/payment_sessions/ps%2Fwith%20space',
  );
  assert.equal(calls[0].method, 'GET');
});

test('simulate — POST to /simulate', async () => {
  const { fetch, calls } = mockFetch(() => json({ ...SESSION, status: 'completed' }));
  const client = new PlaidlyClient({ fetch });
  const session = await client.paymentSessions.simulate('ps_1');
  assert.equal(session.status, 'completed');
  assert.equal(calls[0].url, 'https://api.plaidly.io/v1/payment_sessions/ps_1/simulate');
  assert.equal(calls[0].method, 'POST');
});

test('payment_methods — GET list', async () => {
  const methods = [
    {
      chain: 'ethereum',
      network: 'mainnet',
      token: 'USDC',
      display_name: 'USD Coin',
      decimals: 6,
      kind: 'erc20',
      min_amount: 1,
    },
  ];
  const { fetch, calls } = mockFetch(() => json(methods));
  const client = new PlaidlyClient({ fetch });
  const result = await client.paymentMethods.list();
  assert.equal(result[0].display_name, 'USD Coin');
  assert.equal(calls[0].url, 'https://api.plaidly.io/v1/payment_methods');
});

test('rates — GET with symbols query', async () => {
  const { fetch, calls } = mockFetch(() =>
    json([{ symbol: 'ETH', usd: 3000, updated_at: 'now' }]),
  );
  const client = new PlaidlyClient({ fetch });
  const rates = await client.rates.get(['ETH', 'SOL']);
  assert.equal(rates[0].symbol, 'ETH');
  assert.equal(calls[0].url, 'https://api.plaidly.io/v1/rates?symbols=ETH%2CSOL');
});

test('rates — no symbols omits query param', async () => {
  const { fetch, calls } = mockFetch(() => json([]));
  const client = new PlaidlyClient({ fetch });
  await client.rates.get();
  assert.equal(calls[0].url, 'https://api.plaidly.io/v1/rates');
});

test('sandbox faucets — GET map', async () => {
  const { fetch, calls } = mockFetch(() =>
    json({ 'ethereum:testnet': 'https://faucet.example' }),
  );
  const client = new PlaidlyClient({ fetch });
  const faucets = await client.sandbox.faucets();
  assert.equal(faucets['ethereum:testnet'], 'https://faucet.example');
  assert.equal(calls[0].url, 'https://api.plaidly.io/v1/sandbox/faucets');
});

test('merchants.register — POST', async () => {
  const merchant = { id: 'm_1', name: 'Acme', api_key: 'sk_live', created_at: 'now' };
  const { fetch, calls } = mockFetch(() => json(merchant, 201));
  const client = new PlaidlyClient({ fetch });
  const result = await client.merchants.register({ name: 'Acme' });
  assert.equal(result.api_key, 'sk_live');
  assert.equal(calls[0].url, 'https://api.plaidly.io/v1/merchants');
});

test('error response maps to PlaidlyError with code and message', async () => {
  const { fetch } = mockFetch(() => json({ code: 404, message: 'not found' }, 404));
  const client = new PlaidlyClient({ apiKey: 'sk', fetch });
  await assert.rejects(
    () => client.paymentSessions.get('missing'),
    (err: unknown) =>
      err instanceof PlaidlyError &&
      err.statusCode === 404 &&
      err.code === 404 &&
      err.message === 'not found',
  );
});

test('retries on 503 then succeeds', async () => {
  let n = 0;
  const { fetch, calls } = mockFetch(() => {
    n += 1;
    if (n < 3) return new Response('', { status: 503 });
    return json(SESSION);
  });
  const client = new PlaidlyClient({ apiKey: 'sk', fetch, maxRetries: 3, timeout: 5000 });
  const session = await client.paymentSessions.get('ps_1');
  assert.equal(session.session_id, 'ps_1');
  assert.equal(calls.length, 3);
});

test('does not retry on 4xx', async () => {
  const { fetch, calls } = mockFetch(() => json({ code: 400, message: 'bad' }, 400));
  const client = new PlaidlyClient({ apiKey: 'sk', fetch });
  await assert.rejects(() => client.paymentSessions.get('ps_1'));
  assert.equal(calls.length, 1);
});

test('custom baseUrl trailing slash is normalized', async () => {
  const { fetch, calls } = mockFetch(() => json(SESSION));
  const client = new PlaidlyClient({ fetch, baseUrl: 'http://localhost:8080/' });
  await client.paymentSessions.get('ps_1');
  assert.equal(calls[0].url, 'http://localhost:8080/v1/payment_sessions/ps_1');
});

test('network failure surfaces as PlaidlyError after exhausting retries', async () => {
  const { fetch, calls } = mockFetch(() => {
    throw new Error('boom');
  });
  const client = new PlaidlyClient({ apiKey: 'sk', fetch, maxRetries: 1, timeout: 1000 });
  await assert.rejects(
    () => client.paymentSessions.get('ps_1'),
    (err: unknown) => err instanceof PlaidlyError && err.code === 'NETWORK_ERROR',
  );
  assert.equal(calls.length, 2);
});
