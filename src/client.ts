import {
  PlaidlyError,
  type CreateDemoPaymentSessionRequest,
  type CreatePaymentSessionRequest,
  type CreateWalletRequest,
  type Merchant,
  type PaymentMethodInfo,
  type PaymentSession,
  type Payout,
  type RateInfo,
  type RegisterMerchantRequest,
  type RequestPayoutRequest,
  type SandboxFaucets,
  type Transaction,
  type Wallet,
} from './types';

export interface PlaidlyConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
}

interface RequestOptions {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  auth?: boolean;
  parseAs?: 'json' | 'blob' | 'none';
}

const DEFAULT_BASE_URL = 'https://api.plaidly.io';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

export class PlaidlyClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: PlaidlyConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error('PlaidlyClient: global fetch is unavailable; pass config.fetch');
    }
  }

  readonly merchants = {
    register: (req: RegisterMerchantRequest): Promise<Merchant> =>
      this.request<Merchant>('POST', '/v1/merchants', { body: req }),
    me: (): Promise<Merchant> =>
      this.request<Merchant>('GET', '/v1/me', { auth: true }),
  };

  readonly paymentSessions = {
    create: (req: CreatePaymentSessionRequest): Promise<PaymentSession> =>
      this.request<PaymentSession>('POST', '/v1/payment_sessions', {
        body: req,
        auth: true,
      }),
    createDemo: (req: CreateDemoPaymentSessionRequest = {}): Promise<PaymentSession> =>
      this.request<PaymentSession>('POST', '/v1/payment_sessions/demo', {
        body: req,
      }),
    get: (sessionId: string): Promise<PaymentSession> =>
      this.request<PaymentSession>(
        'GET',
        `/v1/payment_sessions/${encodeURIComponent(sessionId)}`,
      ),
    simulate: (sessionId: string): Promise<PaymentSession> =>
      this.request<PaymentSession>(
        'POST',
        `/v1/payment_sessions/${encodeURIComponent(sessionId)}/simulate`,
      ),
    receipt: (sessionId: string): Promise<Blob> =>
      this.request<Blob>(
        'GET',
        `/v1/payment_sessions/${encodeURIComponent(sessionId)}/receipt`,
        { parseAs: 'blob' },
      ),
  };

  readonly paymentMethods = {
    list: (): Promise<PaymentMethodInfo[]> =>
      this.request<PaymentMethodInfo[]>('GET', '/v1/payment_methods'),
  };

  readonly rates = {
    get: (symbols?: string[] | string): Promise<RateInfo[]> => {
      const symbolsParam = Array.isArray(symbols) ? symbols.join(',') : symbols;
      return this.request<RateInfo[]>('GET', '/v1/rates', {
        query: { symbols: symbolsParam },
      });
    },
  };

  readonly sandbox = {
    faucets: (): Promise<SandboxFaucets> =>
      this.request<SandboxFaucets>('GET', '/v1/sandbox/faucets'),
  };

  readonly payouts = {
    request: (req: RequestPayoutRequest): Promise<Payout> =>
      this.request<Payout>('POST', '/v1/payouts', { body: req, auth: true }),
    get: (payoutId: string): Promise<Payout> =>
      this.request<Payout>(
        'GET',
        `/v1/payouts/${encodeURIComponent(payoutId)}`,
        { auth: true },
      ),
  };

  readonly wallets = {
    create: (req: CreateWalletRequest): Promise<Wallet> =>
      this.request<Wallet>('POST', '/v1/wallets', { body: req, auth: true }),
    list: (): Promise<Wallet[]> =>
      this.request<Wallet[]>('GET', '/v1/wallets', { auth: true }),
    get: (walletId: string): Promise<Wallet> =>
      this.request<Wallet>(
        'GET',
        `/v1/wallets/${encodeURIComponent(walletId)}`,
        { auth: true },
      ),
    transactions: (walletId: string): Promise<Transaction[]> =>
      this.request<Transaction[]>(
        'GET',
        `/v1/wallets/${encodeURIComponent(walletId)}/transactions`,
        { auth: true },
      ),
  };

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.auth) {
      if (!this.apiKey) {
        throw new PlaidlyError(
          `PlaidlyClient: apiKey is required for ${method} ${path}`,
          0,
          'MISSING_API_KEY',
        );
      }
      headers['X-API-Key'] = this.apiKey;
    } else if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    let serializedBody: string | undefined;
    if (options.body !== undefined && method !== 'GET') {
      serializedBody = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }

    const response = await this.fetchWithRetry(url, {
      method,
      headers,
      body: serializedBody,
    });

    if (!response.ok) {
      throw await this.toError(response);
    }

    if (options.parseAs === 'blob') {
      return (await response.blob()) as T;
    }
    if (options.parseAs === 'none' || response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      try {
        const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
        if (RETRYABLE_STATUS.has(response.status) && attempt < this.maxRetries) {
          await this.backoff(attempt);
          continue;
        }
        return response;
      } catch (err) {
        lastError = err;
        if (attempt >= this.maxRetries) break;
        await this.backoff(attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new PlaidlyError(
      lastError instanceof Error ? lastError.message : 'Request failed',
      0,
      'NETWORK_ERROR',
    );
  }

  private backoff(attempt: number): Promise<void> {
    const delay = 2 ** attempt * 500;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async toError(response: Response): Promise<PlaidlyError> {
    let message = `HTTP ${response.status}`;
    let code: string | number = response.status;
    try {
      const body = (await response.json()) as { message?: unknown; code?: unknown };
      if (typeof body.message === 'string') message = body.message;
      if (typeof body.code === 'string' || typeof body.code === 'number') code = body.code;
    } catch {
      // non-JSON error body; keep status-derived defaults
    }
    return new PlaidlyError(message, response.status, code);
  }
}
