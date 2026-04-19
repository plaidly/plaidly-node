export interface Session {
  id: string;
  merchantId: string;
  amount: string;
  currency: string;
  chain: string;
  network: string;
  status: 'awaiting_payment' | 'processing' | 'completed' | 'expired' | 'failed';
  walletAddress: string;
  callbackUrl: string;
  metadata: Record<string, string>;
  createdAt: string;
  expiresAt: string;
}

export interface CreateSessionRequest {
  amount: string;
  currency: string;
  chain: string;
  network?: string;
  callbackUrl?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface ListSessionsResponse {
  sessions: Session[];
  total: number;
}

export interface Merchant {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  webhookUrl: string;
  sandbox: boolean;
  createdAt: string;
}

export interface CreateMerchantRequest {
  name: string;
  email: string;
  webhookUrl?: string;
  sandbox?: boolean;
}

export interface Payout {
  id: string;
  merchantId: string;
  amount: string;
  currency: string;
  chain: string;
  network: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  toAddress: string;
  txHash?: string;
  createdAt: string;
}

export interface CreatePayoutRequest {
  amount: string;
  currency: string;
  chain: string;
  network?: string;
  address: string;
}

export interface Faucet {
  chain: string;
  network: string;
  url: string;
  description: string;
}

export interface SimulatePaymentRequest {
  txHash?: string;
}

export interface PlaidlyError extends Error {
  statusCode: number;
  code: string;
}
