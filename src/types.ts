// Re-export types derived from the OpenAPI 3.1 spec.
// Raw generated file: ./generated/schema.ts (regenerate via `npm run generate`).

import type { components } from './generated/schema';

type Schemas = components['schemas'];

export type Merchant = Schemas['Merchant'];
export type RegisterMerchantRequest = Schemas['RegisterMerchantRequest'];
export type Wallet = Schemas['Wallet'];
export type CreateWalletRequest = Schemas['CreateWalletRequest'];
export type Transaction = Schemas['Transaction'];
export type PaymentSession = Schemas['PaymentSession'];
export type CreatePaymentSessionRequest = Schemas['CreatePaymentSessionRequest'];
export type PaymentMethod = Schemas['PaymentMethod'];
export type Receipt = Schemas['Receipt'];
export type Payout = Schemas['Payout'];
export type RequestPayoutRequest = Schemas['RequestPayoutRequest'];
export type User = Schemas['User'];
export type SendRequest = Schemas['SendRequest'];
export type SendResponse = Schemas['SendResponse'];
export type SweepResponse = Schemas['SweepResponse'];
export type ApiError = Schemas['Error'];

// Thrown by PlaidlyClient when the API returns a non-2xx status.
export class PlaidlyError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'PlaidlyError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
