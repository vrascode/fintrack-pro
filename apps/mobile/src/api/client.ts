import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  clientSessionSchema,
  financialAccountInputSchema,
  financialAccountSchema,
  financialCategoryInputSchema,
  financialCategorySchema,
  financialTransactionInputSchema,
  financialTransactionSchema,
  loginSchema,
  registerSchema,
  type ClientSession,
  type FinancialAccount,
  type FinancialAccountInput,
  type FinancialCategory,
  type FinancialTransaction,
  type FinancialTransactionInput,
  type Login,
  type Registration,
} from '@fintrack/shared';
import { resolveApiBaseUrl } from './url';
import { ApiClientError, createApiTransport } from './transport';

export { ApiClientError } from './transport';
export const { request, setSessionRecovery } = createApiTransport(() =>
  resolveApiBaseUrl(
    process.env.EXPO_PUBLIC_API_URL,
    Platform.OS,
    __DEV__,
    typeof window !== 'undefined' ? window.location.hostname : undefined,
    Constants.expoConfig?.hostUri,
  ),
);

async function list<T>(
  path: string,
  token: string,
  schema: { parse(value: unknown): T },
): Promise<T[]> {
  const payload = await request<unknown>(path, { token });
  if (!Array.isArray(payload)) throw new ApiClientError(502, 'The API returned an invalid list.');
  return payload.map((value: unknown) => schema.parse(value));
}

export const apiClient = {
  async editTransaction(
    token: string,
    id: string,
    revision: number,
    input: FinancialTransactionInput,
  ): Promise<FinancialTransaction> {
    return financialTransactionSchema.parse(
      await request(`/transactions/${encodeURIComponent(id)}`, {
        token,
        method: 'PATCH',
        body: { revision, transaction: financialTransactionInputSchema.parse(input) },
      }),
    );
  },
  removeTransaction(token: string, id: string, revision: number): Promise<{ success: true }> {
    return request(`/transactions/${encodeURIComponent(id)}`, {
      token,
      method: 'DELETE',
      body: { revision },
    });
  },
  async refresh(session: ClientSession): Promise<ClientSession> {
    return clientSessionSchema.parse(
      await request('/auth/refresh', {
        method: 'POST',
        ...(Platform.OS === 'web'
          ? {}
          : {
              body: {
                refreshToken: 'refreshToken' in session ? session.refreshToken : '',
              },
            }),
      }),
    );
  },
  async restore(): Promise<ClientSession | null> {
    if (Platform.OS !== 'web') return null;
    try {
      return clientSessionSchema.parse(await request('/auth/session', { method: 'POST' }));
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) return null;
      throw error;
    }
  },
  async register(input: Registration) {
    const body = registerSchema.parse(input);
    return request<{ id: string; email: string }>('/auth/register', { method: 'POST', body });
  },
  async login(input: Login): Promise<ClientSession> {
    const body = loginSchema.parse(input);
    return clientSessionSchema.parse(await request('/auth/login', { method: 'POST', body }));
  },
  logout(token: string): Promise<{ success: true }> {
    return request('/auth/logout', { token, method: 'POST' });
  },
  async accounts(token: string): Promise<FinancialAccount[]> {
    return list('/accounts', token, financialAccountSchema);
  },
  updateAccount(token: string, id: string, input: { name?: string; archived?: boolean }) {
    return request(`/accounts/${encodeURIComponent(id)}`, { token, method: 'PATCH', body: input });
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
    const rows: FinancialTransaction[] = [];
    for (let offset = 0; offset <= 1000000; offset += 100) {
      const page = await list(
        `/transactions?limit=100&offset=${offset}`,
        token,
        financialTransactionSchema,
      );
      rows.push(...page);
      if (page.length < 100) return rows;
    }
    throw new ApiClientError(502, 'Transaction history is too large to load completely.');
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
