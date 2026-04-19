// PlaidlyClient — thin wrapper around the generated openapi-fetch client
// with retries, API-key auth, and typed error translation.
//
// Types are auto-generated from the Plaidly OpenAPI 3.1 spec. Regenerate
// with `npm run generate`. Do not edit src/generated/schema.ts by hand.

import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from './generated/schema';
import {
  PlaidlyError,
  type Merchant,
  type RegisterMerchantRequest,
  type PaymentSession,
  type CreatePaymentSessionRequest,
  type Payout,
  type RequestPayoutRequest,
  type Wallet,
  type CreateWalletRequest,
  type Transaction,
} from './types';

export interface PlaidlyConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

type FetchClient = Client<paths>;

/**
 * Retry middleware — re-issues the request up to 3 times on 5xx responses
 * with exponential backoff (1s, 2s).
 */
function retryMiddleware(): Middleware {
  return {
    async onResponse({ request, response }) {
      let attempt = 1;
      let current = response;
      while (current.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
        current = await fetch(request.clone());
        attempt += 1;
      }
      return current;
    },
  };
}

export class PlaidlyClient {
  /** Raw openapi-fetch client — escape hatch for callers that want to use
   *  the generated client directly for endpoints not yet exposed below. */
  readonly raw: FetchClient;

  constructor(config: PlaidlyConfig) {
    if (!config.apiKey) {
      throw new Error('PlaidlyClient: apiKey is required');
    }
    const baseUrl = (config.baseUrl ?? 'https://api.plaidly.io').replace(/\/$/, '');
    const timeout = config.timeout ?? 30_000;

    const client: FetchClient = createClient<paths>({
      baseUrl,
      headers: {
        'X-API-Key': config.apiKey,
        Accept: 'application/json',
      },
      fetch: async (input: Request) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
          return await fetch(input, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
      },
    });
    client.use(retryMiddleware());
    this.raw = client;
  }

  readonly merchants = {
    register: async (req: RegisterMerchantRequest): Promise<Merchant> => {
      const { data, error, response } = await this.raw.POST('/v1/merchants', { body: req });
      if (error) throw this.toError(error, response);
      return data!;
    },
    me: async (): Promise<Merchant> => {
      const { data, error, response } = await this.raw.GET('/v1/me', {});
      if (error) throw this.toError(error, response);
      return data!;
    },
  };

  readonly paymentSessions = {
    create: async (req: CreatePaymentSessionRequest): Promise<PaymentSession> => {
      const { data, error, response } = await this.raw.POST('/v1/payment_sessions', {
        body: req,
      });
      if (error) throw this.toError(error, response);
      return data!;
    },
    createDemo: async (): Promise<PaymentSession> => {
      const { data, error, response } = await this.raw.POST('/v1/payment_sessions/demo', {});
      if (error) throw this.toError(error, response);
      return data!;
    },
    get: async (sessionId: string): Promise<PaymentSession> => {
      const { data, error, response } = await this.raw.GET(
        '/v1/payment_sessions/{session_id}',
        { params: { path: { session_id: sessionId } } },
      );
      if (error) throw this.toError(error, response);
      return data!;
    },
    fulfillDemo: async (sessionId: string): Promise<void> => {
      const { error, response } = await this.raw.POST(
        '/v1/payment_sessions/{session_id}/fulfill',
        { params: { path: { session_id: sessionId } } },
      );
      if (error) throw this.toError(error, response);
    },
    /**
     * Fetch the PDF receipt for a completed session.
     * Returns the raw PDF body as a Blob (endpoint returns `application/pdf`).
     */
    receipt: async (sessionId: string): Promise<Blob> => {
      const { response } = await this.raw.GET(
        '/v1/payment_sessions/{session_id}/receipt',
        {
          params: { path: { session_id: sessionId } },
          parseAs: 'blob',
        },
      );
      if (!response.ok) {
        throw new PlaidlyError(
          `HTTP ${response.status}`,
          response.status,
          'RECEIPT_FETCH_FAILED',
        );
      }
      return response.blob();
    },
  };

  readonly payouts = {
    request: async (req: RequestPayoutRequest): Promise<Payout> => {
      const { data, error, response } = await this.raw.POST('/v1/payouts', { body: req });
      if (error) throw this.toError(error, response);
      return data!;
    },
    get: async (payoutId: string): Promise<Payout> => {
      const { data, error, response } = await this.raw.GET('/v1/payouts/{payout_id}', {
        params: { path: { payout_id: payoutId } },
      });
      if (error) throw this.toError(error, response);
      return data!;
    },
  };

  readonly wallets = {
    create: async (req: CreateWalletRequest): Promise<Wallet> => {
      const { data, error, response } = await this.raw.POST('/v1/wallets', { body: req });
      if (error) throw this.toError(error, response);
      return data!;
    },
    list: async (): Promise<Wallet[]> => {
      const { data, error, response } = await this.raw.GET('/v1/wallets', {});
      if (error) throw this.toError(error, response);
      return data ?? [];
    },
    get: async (walletId: string): Promise<Wallet> => {
      const { data, error, response } = await this.raw.GET('/v1/wallets/{wallet_id}', {
        params: { path: { wallet_id: walletId } },
      });
      if (error) throw this.toError(error, response);
      return data!;
    },
    transactions: async (walletId: string): Promise<Transaction[]> => {
      const { data, error, response } = await this.raw.GET(
        '/v1/wallets/{wallet_id}/transactions',
        { params: { path: { wallet_id: walletId } } },
      );
      if (error) throw this.toError(error, response);
      return data ?? [];
    },
  };

  private toError(err: unknown, response: Response): PlaidlyError {
    const body = (err ?? {}) as { message?: unknown; code?: unknown };
    const message = typeof body.message === 'string' ? body.message : `HTTP ${response.status}`;
    const code = typeof body.code === 'string' ? body.code : 'UNKNOWN_ERROR';
    return new PlaidlyError(message, response.status, code);
  }
}
