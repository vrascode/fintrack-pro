import { Platform } from 'react-native';
import {
  authSessionSchema,
  financialAccountInputSchema,
  financialAccountSchema,
  financialCategoryInputSchema,
  financialCategorySchema,
  financialTransactionInputSchema,
  financialTransactionSchema,
  loginSchema,
  registerSchema,
  type AuthSession,
  type FinancialAccount,
  type FinancialAccountInput,
  type FinancialCategory,
  type FinancialTransaction,
  type FinancialTransactionInput,
  type Login,
  type Registration,
} from '@fintrack/shared';
import { resolveApiBaseUrl } from './url';

const baseUrl = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, Platform.OS, __DEV__);

async function list<T>(
  path: string,
  token: string,
  schema: { parse(value: unknown): T },
): Promise<T[]> {
  const payload = await request<unknown>(path, { token });
  if (!Array.isArray(payload)) throw new ApiClientError(502, 'The API returned an invalid list.');
  return payload.map((value: unknown) => schema.parse(value));
}

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(
  path: string,
  options: { token?: string; method?: string; body?: unknown; idempotencyKey?: string } = {},
) {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new ApiClientError(0, 'Could not connect to the FinTrack API.');
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String(payload.message)
        : 'The request could not be completed.';
    throw new ApiClientError(response.status, message);
  }
  return payload as T;
}

export const apiClient = {
  async register(input: Registration) {
    const body = registerSchema.parse(input);
    return request<{ id: string; email: string }>('/auth/register', { method: 'POST', body });
  },
  async login(input: Login): Promise<AuthSession> {
    const body = loginSchema.parse(input);
    return authSessionSchema.parse(await request('/auth/login', { method: 'POST', body }));
  },
  logout(token: string): Promise<{ success: true }> {
    return request('/auth/logout', { token, method: 'POST' });
  },
  async accounts(token: string): Promise<FinancialAccount[]> {
    return list('/accounts', token, financialAccountSchema);
  },
  async createAccount(token: string, input: FinancialAccountInput): Promise<FinancialAccount> {
    const body = financialAccountInputSchema.parse(input);
    return financialAccountSchema.parse(
      await request<unknown>('/accounts', { token, method: 'POST', body }),
    );
  },
  async categories(token: string): Promise<FinancialCategory[]> {
    return list('/categories', token, financialCategorySchema);
  },
  async createCategory(
    token: string,
    input: { name: string; kind: 'income' | 'expense'; essentialForReserve: boolean },
  ): Promise<FinancialCategory> {
    const body = financialCategoryInputSchema.parse(input);
    return financialCategorySchema.parse(
      await request<unknown>('/categories', { token, method: 'POST', body }),
    );
  },
  async transactions(token: string): Promise<FinancialTransaction[]> {
    return list('/transactions', token, financialTransactionSchema);
  },
  async createTransaction(
    token: string,
    idempotencyKey: string,
    input: FinancialTransactionInput,
  ): Promise<FinancialTransaction> {
    const body = financialTransactionInputSchema.parse(input);
    return financialTransactionSchema.parse(
      await request<unknown>('/transactions', {
        token,
        method: 'POST',
        body,
        idempotencyKey,
      }),
    );
  },
};
