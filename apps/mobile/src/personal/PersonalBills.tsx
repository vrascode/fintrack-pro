import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Platform, Text, View } from 'react-native';
import {
  billDueOn,
  dateInTimeZone,
  type Bill,
  type BillInput,
  type FinancialAccount,
} from '@fintrack/shared';
import { apiClient } from '../api/client';
import { ApiClientError } from '../api/client';
import { useAuth } from '../auth';
import { parseLocalizedCents } from '../demo/input';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Label,
  Loading,
  Screen,
  StatusMessage,
} from '../components/ui';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

export function PersonalBills() {
  const token = useAuth((state) => state.session?.accessToken);
  const { language, formatCurrency } = useI18n();
  const colors = useTheme();
  const pt = language === 'pt-BR';
  const text = (a: string, b: string) => (pt ? a : b);
  const [bills, setBills] = useState<Bill[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'open' | 'paid' | 'all'>('open');
  const [editing, setEditing] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState(dateInTimeZone(new Date()));
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [frequency, setFrequency] = useState<'once' | 'weekly' | 'monthly'>('monthly');
  const [accountId, setAccountId] = useState('');
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const paymentRetry = useRef<{ fingerprint: string; key: string } | null>(null);
  const reload = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setBills([]);
    setAccounts([]);
    try {
      const [items, owned] = await Promise.all([apiClient.bills(token), apiClient.accounts(token)]);
      setBills(items);
      setAccounts(owned);
      setMessage('');
      setAccountId((current) => current || owned.find((item) => !item.archived)?.id || '');
    } catch (error) {
      const status = error instanceof ApiClientError ? error.status : -1;
      setMessage(
        status === 401
          ? text('Sessão expirada. Entre novamente.', 'Session expired. Sign in again.')
          : status === 403
            ? text('Acesso às contas negado.', 'Bill access denied.')
            : status === 404
              ? text(
                  'Rota de contas não encontrada. Reinicie a API atualizada.',
                  'Bills route missing. Restart the updated API.',
                )
              : status === 503
                ? text('Banco indisponível. Tente novamente.', 'Database unavailable. Try again.')
                : status >= 500
                  ? text(
                      'Erro da API ao carregar contas. Tente novamente.',
                      'API error loading bills. Try again.',
                    )
                  : text('Falha de conexão com a API.', 'Could not connect to the API.'),
      );
    } finally {
      setLoading(false);
    }
  }, [token, language]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  const today = dateInTimeZone(new Date());
  async function save() {
    if (!token) return;
    try {
      const input: BillInput = {
        description,
        kind,
        amountCents: parseLocalizedCents(amount, language).toString(),
        accountId,
        firstDueOn: due,
        frequency,
      };
      if (editing) await apiClient.updateBill(token, editing, input);
      else await apiClient.createBill(token, input);
      setEditing(null);
      setDescription('');
      setAmount('');
      await reload();
    } catch {
      setMessage(
        text(
          'Confira descrição, valor, conta e data.',
          'Check description, amount, account and date.',
        ),
      );
    }
  }
  async function pay(bill: Bill, index: number, remaining: bigint) {
    if (!token) return;
    try {
      const value = payAmounts[bill.id]?.trim()
        ? parseLocalizedCents(payAmounts[bill.id]!, language)
        : remaining;
      if (value <= 0n || value > remaining) throw new RangeError();
      const fingerprint = `${bill.id}:${index}:${value}`;
      if (paymentRetry.current?.fingerprint !== fingerprint)
        paymentRetry.current = {
          fingerprint,
          key: `bill-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      await apiClient.payBill(token, bill.id, index, value.toString(), paymentRetry.current.key);
      paymentRetry.current = null;
      setPayAmounts((current) => ({ ...current, [bill.id]: '' }));
      await reload();
    } catch {
      setMessage(
        text(
          'Pagamento não registrado. Confira o valor e tente novamente.',
          'Payment was not recorded. Check the amount and retry.',
        ),
      );
    }
  }
  function cancel(bill: Bill) {
    const perform = () => {
      if (token)
        void apiClient
          .cancelBill(token, bill.id)
          .then(reload)
          .catch(() => setMessage(text('Falha ao cancelar.', 'Could not cancel.')));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`${text('Cancelar recorrência?', 'Cancel bill?')} ${bill.description}`))
        perform();
      return;
    }
    Alert.alert(text('Cancelar recorrência?', 'Cancel bill?'), bill.description, [
      { text: text('Voltar', 'Back'), style: 'cancel' },
      {
        text: text('Cancelar conta', 'Cancel bill'),
        style: 'destructive',
        onPress: perform,
      },
    ]);
  }
  return (
    <Screen
      title={text('Contas mensais', 'Bills')}
      subtitle={text(
        'Cobranças e pagamentos da sua conta pessoal.',
        'Your personal bills and payments.',
      )}
    >
      {message ? <StatusMessage message={message} tone="error" /> : null}
      {message ? (
        <Button
          variant="secondary"
          label={text('Tentar novamente', 'Retry')}
          onPress={() => void reload()}
        />
      ) : null}
      <Card>
        <Label>
          {editing ? text('Editar conta', 'Edit bill') : text('Nova conta', 'New bill')}
        </Label>
        <Field
          label={text('Descrição', 'Description')}
          value={description}
          onChangeText={setDescription}
        />
        <Field
          label={text('Valor', 'Amount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <Field
          label={text('Primeiro vencimento (AAAA-MM-DD)', 'First due date (YYYY-MM-DD)')}
          value={due}
          onChangeText={setDue}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['expense', 'income'] as const).map((value) => (
            <Button
              key={value}
              compact
              variant="secondary"
              selected={kind === value}
              label={
                value === 'expense' ? text('A pagar', 'Payable') : text('A receber', 'Receivable')
              }
              onPress={() => setKind(value)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['once', 'weekly', 'monthly'] as const).map((value) => (
            <Button
              key={value}
              compact
              variant="secondary"
              selected={frequency === value}
              label={
                value === 'once'
                  ? text('Única', 'Once')
                  : value === 'weekly'
                    ? text('Semanal', 'Weekly')
                    : text('Mensal', 'Monthly')
              }
              onPress={() => setFrequency(value)}
            />
          ))}
        </View>
        <Label>{text('Conta financeira', 'Financial account')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {accounts
            .filter((item) => !item.archived)
            .map((item) => (
              <Button
                key={item.id}
                compact
                variant="secondary"
                selected={accountId === item.id}
                label={item.name}
                onPress={() => setAccountId(item.id)}
              />
            ))}
        </View>
        <Button
          label={
            editing
              ? text('Salvar alterações', 'Save changes')
              : text('Cadastrar conta', 'Create bill')
          }
          disabled={!accountId}
          onPress={() => void save()}
        />
        {editing ? (
          <Button
            variant="quiet"
            label={text('Descartar edição', 'Discard edit')}
            onPress={() => {
              setEditing(null);
              setDescription('');
              setAmount('');
            }}
          />
        ) : null}
      </Card>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(['open', 'paid', 'all'] as const).map((value) => (
          <Button
            key={value}
            compact
            variant="secondary"
            selected={filter === value}
            label={
              value === 'open'
                ? text('Pendentes', 'Open')
                : value === 'paid'
                  ? text('Pagas', 'Paid')
                  : text('Todas', 'All')
            }
            onPress={() => setFilter(value)}
          />
        ))}
      </View>
      {!loading && !message && bills.length === 0 ? (
        <Card>
          <EmptyState
            symbol="≡"
            title={text('Nenhuma conta mensal cadastrada.', 'No bills yet.')}
            description={text(
              'Use o formulário acima para organizar seu primeiro vencimento.',
              'Use the form above to organize your first due date.',
            )}
          />
        </Card>
      ) : null}
      {loading ? (
        <Loading label={text('Carregando contas mensais…', 'Loading bills…')} />
      ) : (
        bills.flatMap((bill) => {
          const occurrences = Array.from(
            { length: bill.frequency === 'once' ? 1 : 1201 },
            (_, index) => ({ index, dueOn: billDueOn(bill.firstDueOn, bill.frequency, index) }),
          ).filter((item) => item.dueOn <= today || item.index === 0);
          return occurrences.map(({ index, dueOn }) => {
            const paid = bill.payments
              .filter((item) => item.occurrenceOn === dueOn)
              .reduce((sum, item) => sum + BigInt(item.amountCents), 0n);
            const remaining = BigInt(bill.amountCents) - paid;
            if (filter === 'open' && (remaining === 0n || bill.canceledAt)) return null;
            if (filter === 'paid' && remaining !== 0n) return null;
            return (
              <Card
                key={`${bill.id}-${index}`}
                style={{
                  borderColor: remaining > 0n && dueOn < today ? colors.accent : colors.border,
                }}
              >
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700' }}>
                  {bill.description}
                </Text>
                <Label muted>
                  {dueOn} ·{' '}
                  {remaining === 0n
                    ? text('Pago', 'Paid')
                    : paid > 0n
                      ? text('Parcial', 'Partial')
                      : dueOn < today
                        ? text('Atrasado', 'Overdue')
                        : text('Pendente', 'Pending')}
                </Label>
                <Label>
                  {formatCurrency(remaining, 'BRL', false)} {text('restantes', 'remaining')}
                </Label>
                {bill.payments
                  .filter((item) => item.occurrenceOn === dueOn)
                  .map((item) => (
                    <Label key={item.id} muted>
                      {text('Pagamento', 'Payment')}:{' '}
                      {formatCurrency(BigInt(item.amountCents), 'BRL', false)}
                    </Label>
                  ))}
                {!bill.canceledAt && remaining > 0n ? (
                  <>
                    <Field
                      label={text('Pagamento parcial (opcional)', 'Partial payment (optional)')}
                      value={payAmounts[bill.id] ?? ''}
                      onChangeText={(value) =>
                        setPayAmounts((current) => ({ ...current, [bill.id]: value }))
                      }
                      keyboardType="decimal-pad"
                    />
                    <Button
                      label={text('Registrar pagamento', 'Record payment')}
                      onPress={() => void pay(bill, index, remaining)}
                    />
                  </>
                ) : null}
                {!bill.payments.length && !bill.canceledAt ? (
                  <Button
                    variant="secondary"
                    label={text('Editar', 'Edit')}
                    onPress={() => {
                      setEditing(bill.id);
                      setDescription(bill.description);
                      const cents = BigInt(bill.amountCents);
                      setAmount(
                        `${cents / 100n}${pt ? ',' : '.'}${String(cents % 100n).padStart(2, '0')}`,
                      );
                      setDue(bill.firstDueOn);
                      setKind(bill.kind);
                      setFrequency(bill.frequency);
                      setAccountId(bill.accountId);
                    }}
                  />
                ) : null}
                {!bill.canceledAt ? (
                  <Button
                    variant="quiet"
                    label={text('Cancelar recorrência', 'Cancel bill')}
                    onPress={() => cancel(bill)}
                  />
                ) : null}
              </Card>
            );
          });
        })
      )}
    </Screen>
  );
}
