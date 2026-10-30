import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { FinancialAccount, FinancialCategory, FinancialTransaction } from '@fintrack/shared';
import { useAuth } from '../auth';
import { apiClient } from '../api/client';

interface Records {
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  transactions: FinancialTransaction[];
}

export function usePersonalFinance() {
  const session = useAuth((state) => state.session);
  const [data, setData] = useState<Records | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const token = session?.accessToken;
  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    setLoading(true);
    setError(false);
    if (!token) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const [accounts, categories, transactions] = await Promise.all([
        apiClient.accounts(token),
        apiClient.categories(token),
        apiClient.transactions(token),
      ]);
      if (sequence === request.current) setData({ accounts, categories, transactions });
    } catch {
      if (sequence === request.current) setError(true);
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [token]);
  useFocusEffect(
    useCallback(() => {
      setData(null);
      void refresh();
      return () => {
        request.current++;
      };
    }, [refresh]),
  );
  return { data, loading, error, refresh, token };
}
