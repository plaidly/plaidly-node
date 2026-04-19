import type {
  Session,
  CreateSessionRequest,
  ListSessionsResponse,
  Merchant,
  CreateMerchantRequest,
  Payout,
  CreatePayoutRequest,
  Faucet,
  PlaidlyError,
} from './types';

interface PlaidlyConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export class PlaidlyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: PlaidlyConfig) {
    if (!config.apiKey) {
      throw new Error('PlaidlyClient: apiKey is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://api.plaidly.io').replace(/\/$/, '');
    this.timeout = config.timeout ?? 30_000;
  }

  readonly sessions = {
    create: (req: CreateSessionRequest): Promise<Session> =>
      this.post('/v1/sessions', req),

    get: (id: string): Promise<Session> =>
      this.get(`/v1/sessions/${encodeURIComponent(id)}`),

    list: (): Promise<ListSessionsResponse> =>
      this.get('/v1/sessions'),

    simulate: (id: string, body: Record<string, unknown> = {}): Promise<void> =>
      this.post(`/v1/sessions/${encodeURIComponent(id)}/simulate`, body),
  };

  readonly merchants = {
    register: (req: CreateMerchantRequest): Promise<Merchant> =>
      this.post('/v1/merchants', req),

    me: (): Promise<Merchant> =>
      this.get('/v1/me'),
  };

  readonly payouts = {
    create: (req: CreatePayoutRequest): Promise<Payout> =>
      this.post('/v1/payouts', req),

    get: (id: string): Promise<Payout> =>
      this.get(`/v1/payouts/${encodeURIComponent(id)}`),
  };

  readonly sandbox = {
    faucets: (): Promise<Faucet[]> =>
      this.get('/v1/sandbox/faucets'),
  };

  private async request<T>(method: string, path: string, body?: unknown, attempt = 1): Promise<T> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (response.status >= 500 && attempt < 3) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        return this.request<T>(method, path, body, attempt + 1);
      }

      if (!response.ok) {
        const err_body = await response.json().catch(() => ({})) as Record<string, unknown>;
        const err = new Error(String(err_body['message'] ?? `HTTP ${response.status}`)) as PlaidlyError;
        err.statusCode = response.status;
        err.code = String(err_body['code'] ?? 'UNKNOWN_ERROR');
        throw err;
      }

      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError' && attempt < 3) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        return this.request<T>(method, path, body, attempt + 1);
      }
      throw err;
    }
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }
}
