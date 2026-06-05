export type Chain =
  | 'ethereum'
  | 'polygon'
  | 'bsc'
  | 'base'
  | 'arbitrum'
  | 'optimism'
  | 'avalanche'
  | 'solana'
  | 'tron'
  | 'ton';

export type Network = 'mainnet' | 'testnet';

export type PaymentMethodKind = 'native' | 'erc20' | 'trc20' | 'spl' | 'jetton';

export type PaymentSessionStatus =
  | 'pending'
  | 'partial_paid'
  | 'paid'
  | 'finalizing'
  | 'confirmed'
  | 'completed'
  | 'expired'
  | 'failed';

export const SUCCESS_STATUSES: ReadonlySet<PaymentSessionStatus> = new Set([
  'confirmed',
  'completed',
]);

export const FAILURE_STATUSES: ReadonlySet<PaymentSessionStatus> = new Set([
  'expired',
  'failed',
]);

export function isSuccessStatus(status: string): boolean {
  return SUCCESS_STATUSES.has(status as PaymentSessionStatus);
}

export function isFailureStatus(status: string): boolean {
  return FAILURE_STATUSES.has(status as PaymentSessionStatus);
}

export interface PaymentMethod {
  methodID: number;
  chain: Chain | string;
  token: string;
  network: Network | string;
}

export interface PaymentSession {
  session_id: string;
  merchant_id: string;
  expected_amount: number;
  received_amount: number;
  address: string;
  status: PaymentSessionStatus | string;
  metadata: Record<string, unknown>;
  expires_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  demo: boolean;
  currency?: string;
  payment_url?: string;
  qr_data?: string;
  explorer_url?: string;
  paymentMethod: PaymentMethod;
}

export interface CreatePaymentSessionRequest {
  amount: number;
  expires_in: string;
  paymentMethod: PaymentMethod;
  metadata?: Record<string, unknown>;
}

export interface CreateDemoPaymentSessionRequest {
  chain?: Chain | string;
  token?: string;
  network?: Network | string;
  amount?: number;
}

export interface PaymentMethodInfo {
  chain: Chain | string;
  network: Network | string;
  token: string;
  display_name: string;
  decimals: number;
  kind: PaymentMethodKind | string;
  min_amount?: number;
}

export interface RateInfo {
  symbol: string;
  usd: number;
  updated_at: string;
}

export type SandboxFaucets = Record<string, string>;

export interface RegisterMerchantRequest {
  name: string;
  webhook_url?: string;
}

export interface Merchant {
  id: string;
  name: string;
  email?: string;
  api_key: string;
  webhook_url?: string;
  webhook_secret?: string;
  rate_limit_per_minute?: number;
  created_at: string;
}

export interface CreateWalletRequest {
  user_id: string;
  chain: string;
  token: string;
}

export interface Wallet {
  id: string;
  network: string;
  address: string;
  private_key_encrypted: string;
  type: string;
  assigned_session_id?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  tx_hash: string;
  session_id: string;
  network: string;
  token_symbol: string;
  from_address?: string;
  to_address?: string;
  amount: number;
  detected_at: string;
  confirmed: boolean;
  block_number?: number;
}

export interface RequestPayoutRequest {
  destination_address: string;
  amount: number;
  token_symbol: string;
  network: string;
}

export interface Payout {
  id: string;
  merchant_id: string;
  destination_address: string;
  amount: number;
  token_symbol: string;
  network: string;
  tx_hash?: string;
  status: string;
  requested_at: string;
  sent_at?: string;
}

export interface Receipt {
  id: string;
  session_id: string;
  merchant_id: string;
  issued_at: string;
  amount: number;
  currency: string;
}

export interface User {
  id: string;
  personal_wallet_address: string;
  created_wallet_address: string;
  last_login_at: string;
}

export interface SendRequest {
  to_address: string;
  amount: number;
  token: string;
}

export interface SendResponse {
  success: boolean;
  tx_hash: string;
}

export interface SweepResponse {
  success: boolean;
  sweep_tx_hash: string;
}

export interface ApiError {
  code: number;
  message: string;
}

export type WebhookEventType =
  | 'payment_session.completed'
  | 'payment_session.expired'
  | 'payment_session.partial_paid';

export interface WebhookEvent {
  event_type: WebhookEventType | string;
  session_id: string;
  status: PaymentSessionStatus | string;
  amount: number;
  currency: string;
  chain: Chain | string;
  network: Network | string;
  timestamp: string;
}

export class PlaidlyError extends Error {
  readonly statusCode: number;
  readonly code: string | number;

  constructor(message: string, statusCode: number, code: string | number) {
    super(message);
    this.name = 'PlaidlyError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
