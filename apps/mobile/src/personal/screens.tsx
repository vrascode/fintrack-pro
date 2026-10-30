import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import {
  calculateAccountBalance,
  financialAccountInputSchema,
  financialTransactionInputSchema,
  type FinancialAccount,
} from '@fintrack/shared';
import { apiClient } from '../api/client';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';
import { usePreferences } from '../preferences';
import { parseLocalizedCents } from '../demo/input';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Label,
  Loading,
  Screen,
  SectionHeading,
  StatusMessage,
} from '../components/ui';
import { usePersonalFinance } from './usePersonalFinance';

const today = () => new Date().toISOString().slice(0, 10);
function useLabels() {
  const i18n = useI18n();
  const hidden = usePreferences().value.hideAmounts;
  return {
    ...i18n,
    hidden,
    text: (pt: string, en: string) => (i18n.language === 'pt-BR' ? pt : en),
  };
}

export function PersonalAccounts() {
  const { text, language, formatCurrency, formatDate, hidden } = useLabels();
  const { data, error, loading, refresh, token } = usePersonalFinance();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('0');
  const [date, setDate] = useState(today);
  const [type, setType] = useState<FinancialAccount['type']>('checking');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function save() {
    if (!token || sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const raw = amount.trim();
      const sign = raw.startsWith('-') ? -1n : 1n;
      const digits = raw.replace(/^-/, '');
      const cents = /^0([.,]0{1,2})?$/.test(digits)
        ? 0n
        : parseLocalizedCents(digits, language) * sign;
      const input = financialAccountInputSchema.parse({
        name,
        type,
        openingBalanceCents: cents.toString(),
        openingDate: date,
        includeInPlan: true,
      });
      await apiClient.createAccount(token, input);
      setName('');
      setAmount('0');
      setFailed(false);
      setMessage(text('Conta salva no servidor.', 'Account saved on the server.'));
      await refresh();
    } catch {
      setFailed(true);
      setMessage(
        text(
          'Não foi possível salvar. Confira nome, saldo e data (AAAA-MM-DD). Se houve falha de conexão, atualize a lista antes de tentar novamente.',
          'Could not save. Check name, balance and date (YYYY-MM-DD). After a connection failure, refresh the list before retrying.',
        ),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen
      title={text('Minhas contas', 'My accounts')}
      subtitle={text(
        'Contas vinculadas à sua sessão. Saldos são calculados pelo histórico salvo no servidor.',
        'Accounts linked to your session. Balances come from server records.',
      )}
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState
          message={text('Não foi possível consultar suas contas.', 'Could not load your accounts.')}
          retry={() => void refresh()}
        />
      ) : data ? (
        <>
          {!data.accounts.length ? (
            <Card accent>
              <SectionHeading
                title={text('Cadastre sua primeira conta', 'Create your first account')}
                detail={text(
                  'Informe o saldo existente e sua data de referência. Você pode continuar depois sem perder o que salvar.',
                  'Enter the existing balance and its reference date. Saved information remains available when you return.',
                )}
              />
            </Card>
          ) : null}
          {data.accounts.map((account) => (
            <Card key={account.id}>
              <SectionHeading
                title={account.name}
                detail={`${account.type} · ${text('Saldo inicial em', 'Opening balance on')} ${formatDate(account.openingDate)}`}
              />
              <Label>
                {formatCurrency(
                  calculateAccountBalance(account, data.transactions, today()),
                  'BRL',
                  hidden,
                )}
              </Label>
            </Card>
          ))}
        </>
      ) : null}
      <Card>
        <SectionHeading title={text('Nova conta financeira', 'New financial account')} />
        <Field
          label={text('Nome da conta', 'Account name')}
          value={name}
          onChangeText={setName}
          editable={!busy}
          maxLength={80}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['checking', 'savings', 'wallet', 'cash'] as const).map((value, index) => (
            <Button
              key={value}
              variant="secondary"
              selected={type === value}
              disabled={busy}
              label={
                [
                  text('Corrente', 'Checking'),
                  text('Poupança', 'Savings'),
                  text('Carteira', 'Wallet'),
                  text('Dinheiro', 'Cash'),
                ][index] ?? value
              }
              onPress={() => setType(value)}
            />
          ))}
        </View>
        <Field
          label={text('Saldo inicial (R$)', 'Opening balance (BRL)')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          editable={!busy}
        />
        <Field
          label={text('Data de referência (AAAA-MM-DD)', 'Reference date (YYYY-MM-DD)')}
          value={date}
          onChangeText={setDate}
          editable={!busy}
        />
        {message ? <StatusMessage message={message} tone={failed ? 'error' : 'success'} /> : null}
        <Button
          label={busy ? text('Salvando…', 'Saving…') : text('Salvar conta', 'Save account')}
          disabled={busy || !name.trim()}
          onPress={() => void save()}
        />
      </Card>
      <Button
        label={text('Abrir dashboard', 'Open dashboard')}
        variant="secondary"
        onPress={() => router.push('/')}
      />
    </Screen>
  );
}

export function PersonalTransaction() {
  const { text, language } = useLabels();
  const { data, error, loading, refresh, token } = usePersonalFinance();
  const [kind, setKind] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [account, setAccount] = useState('');
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function save() {
    if (!token || !data || sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const input = financialTransactionInputSchema.parse({
        kind,
        description,
        amountCents: parseLocalizedCents(amount, language).toString(),
        date,
        accountId: account || data.accounts[0]?.id,
        ...(kind === 'transfer'
          ? { transferAccountId: target }
          : category
            ? { categoryId: category }
            : {}),
      });
      const fingerprint = JSON.stringify(input);
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = {
          fingerprint,
          key: `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      await apiClient.createTransaction(token, retry.current.key, input);
      retry.current = null;
      setDescription('');
      setAmount('');
      setFailed(false);
      setMessage(text('Lançamento salvo no servidor.', 'Entry saved on the server.'));
      await refresh();
    } catch {
      setFailed(true);
      setMessage(
        text(
          'Não foi possível salvar. Confira os campos, contas e data. Tente novamente; uma repetição do mesmo envio não duplica o lançamento.',
          'Could not save. Check fields, accounts and date. Retrying the same request does not duplicate the entry.',
        ),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function addCategory() {
    if (!token || kind === 'transfer' || sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const saved = await apiClient.createCategory(token, {
        name: categoryName,
        kind,
        essentialForReserve: false,
      });
      setCategory(saved.id);
      setCategoryName('');
      setMessage('');
      await refresh();
    } catch {
      setFailed(true);
      setMessage(
        text(
          'Não foi possível criar a categoria. Confira se o nome já existe.',
          'Could not create the category. Check whether its name already exists.',
        ),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen
      title={text('Novo registro', 'New entry')}
      subtitle={text(
        'Receitas recebidas, despesas pagas e transferências próprias. Apenas datas já realizadas; valores não movimentam um banco externo.',
        'Received income, paid expenses and internal transfers. Posted dates only; this does not move money in an external bank.',
      )}
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState
          message={text(
            'Não foi possível carregar seus registros.',
            'Could not load your records.',
          )}
          retry={() => void refresh()}
        />
      ) : !data?.accounts.length ? (
        <Card>
          <Label>
            {text(
              'Cadastre uma conta antes de lançar valores.',
              'Create an account before recording entries.',
            )}
          </Label>
          <Button
            label={text('Cadastrar conta', 'Create account')}
            onPress={() => router.push('/accounts')}
          />
        </Card>
      ) : (
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['income', 'expense', 'transfer'] as const).map((value) => (
              <Button
                key={value}
                variant="secondary"
                selected={kind === value}
                disabled={busy}
                label={
                  value === 'income'
                    ? text('+ Receita', '+ Income')
                    : value === 'expense'
                      ? text('− Despesa', '− Expense')
                      : text('↔ Transferência', '↔ Transfer')
                }
                onPress={() => {
                  setKind(value);
                  setCategory('');
                }}
              />
            ))}
          </View>
          <Field
            label={text('Descrição', 'Description')}
            value={description}
            onChangeText={setDescription}
            maxLength={160}
            editable={!busy}
          />
          <Field
            label={text('Valor (R$)', 'Amount (BRL)')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            editable={!busy}
          />
          <Field
            label={text('Data (AAAA-MM-DD)', 'Date (YYYY-MM-DD)')}
            value={date}
            onChangeText={setDate}
            editable={!busy}
          />
          <Label>{text('Conta de origem / recebimento', 'Source / receiving account')}</Label>
          {data.accounts.map((item) => (
            <Button
              key={item.id}
              selected={(account || data.accounts[0]?.id) === item.id}
              variant="secondary"
              label={item.name}
              disabled={busy}
              onPress={() => setAccount(item.id)}
            />
          ))}
          {kind === 'transfer' ? (
            <>
              <Label>{text('Conta de destino', 'Destination account')}</Label>
              {data.accounts
                .filter((item) => item.id !== (account || data.accounts[0]?.id))
                .map((item) => (
                  <Button
                    key={item.id}
                    variant="secondary"
                    selected={target === item.id}
                    label={item.name}
                    disabled={busy}
                    onPress={() => setTarget(item.id)}
                  />
                ))}
            </>
          ) : (
            <>
              <Label>{text('Categoria (opcional)', 'Category (optional)')}</Label>
              <Button
                variant="secondary"
                label={text('Sem categoria', 'No category')}
                selected={!category}
                disabled={busy}
                onPress={() => setCategory('')}
              />
              {data.categories
                .filter((item) => item.kind === kind)
                .map((item) => (
                  <Button
                    key={item.id}
                    variant="secondary"
                    selected={category === item.id}
                    label={item.name}
                    disabled={busy}
                    onPress={() => setCategory(item.id)}
                  />
                ))}
              <Field
                label={text('Nova categoria', 'New category')}
                value={categoryName}
                onChangeText={setCategoryName}
                editable={!busy}
                maxLength={60}
              />
              <Button
                variant="secondary"
                label={text('Criar categoria', 'Create category')}
                disabled={busy || !categoryName.trim()}
                onPress={() => void addCategory()}
              />
            </>
          )}
          <Button
            label={busy ? text('Salvando…', 'Saving…') : text('Salvar lançamento', 'Save entry')}
            disabled={busy || !description.trim() || !amount}
            onPress={() => void save()}
          />
        </Card>
      )}
      {message ? (
        <Card>
          <StatusMessage message={message} tone={failed ? 'error' : 'success'} />
        </Card>
      ) : null}
      <Button
        label={text('Abrir dashboard', 'Open dashboard')}
        variant="secondary"
        onPress={() => router.push('/')}
      />
    </Screen>
  );
}

export function PersonalOverview() {
  const { text, formatCurrency, formatDate, hidden } = useLabels();
  const { data, error, loading, refresh } = usePersonalFinance();
  const colors = useTheme();
  const signOut = useAuth((state) => state.signOut);
  const month = today().slice(0, 7);
  const received =
    data?.transactions
      .filter((item) => item.kind === 'income' && item.date.startsWith(month))
      .reduce((sum, item) => sum + BigInt(item.amountCents), 0n) ?? 0n;
  const paid =
    data?.transactions
      .filter((item) => item.kind === 'expense' && item.date.startsWith(month))
      .reduce((sum, item) => sum + BigInt(item.amountCents), 0n) ?? 0n;
  const balance =
    data?.accounts.reduce(
      (sum, item) => sum + calculateAccountBalance(item, data.transactions, today()),
      0n,
    ) ?? 0n;
  const scale = received > paid ? received : paid;
  const money = (value: bigint) => formatCurrency(value, 'BRL', hidden);
  return (
    <Screen
      title={text('Seu dashboard', 'Your dashboard')}
      subtitle={text(
        'Dados próprios recuperados do servidor. Saldo = saldos iniciais + receitas − despesas; transferências não alteram o total.',
        'Your own server records. Balance = opening balances + income − expenses; transfers do not change the total.',
      )}
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState
          message={text(
            'Não foi possível consultar o servidor. Os saldos não foram substituídos por zero.',
            'Could not query the server. Balances have not been replaced with zero.',
          )}
          retry={() => void refresh()}
        />
      ) : data ? (
        <>
          {!data.accounts.length ? (
            <Redirect href="/accounts" />
          ) : (
            <>
              <Card accent>
                <SectionHeading title={text('Saldo disponível', 'Available balance')} />
                <Text
                  accessibilityLabel={text('Saldo disponível', 'Available balance')}
                  style={{
                    color: colors.ink,
                    fontSize: 32,
                    fontWeight: '800',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {money(balance)}
                </Text>
              </Card>
              <Card>
                <SectionHeading title={text('Resultado do mês', 'Monthly result')} detail={month} />
                <Label>
                  {text('Receitas recebidas', 'Received income')}: {money(received)}
                </Label>
                <Label>
                  {text('Despesas pagas', 'Paid expenses')}: {money(paid)}
                </Label>
                <Label>
                  {text('Resultado', 'Net')}: {money(received - paid)}
                </Label>
                {[
                  { label: text('+ Entradas', '+ Income'), value: received, color: colors.accent },
                  { label: text('− Saídas', '− Expenses'), value: paid, color: colors.ink },
                ].map((item) => (
                  <View key={item.label} style={{ gap: 8 }}>
                    <Label>
                      {item.label}: {money(item.value)}
                    </Label>
                    <View
                      accessibilityLabel={`${item.label}: ${money(item.value)}`}
                      style={{ height: 12, borderWidth: 1, borderColor: colors.border }}
                    >
                      <View
                        style={{
                          height: 10,
                          width: `${scale > 0n ? Number((item.value * 100n) / scale) : 0}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </Card>
              <Card>
                <SectionHeading title={text('Histórico salvo', 'Saved history')} />
                {data.transactions.length ? (
                  data.transactions.map((item) => (
                    <View
                      key={item.id}
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        paddingVertical: 10,
                        gap: 4,
                      }}
                    >
                      <Label>{item.description}</Label>
                      <Label muted>
                        {formatDate(item.date)} ·{' '}
                        {data.accounts.find((a) => a.id === item.accountId)?.name} ·{' '}
                        {item.kind === 'income'
                          ? text('Entrada', 'Income')
                          : item.kind === 'expense'
                            ? text('Saída', 'Expense')
                            : text('Transferência', 'Transfer')}
                      </Label>
                      <Label>
                        {item.kind === 'expense' ? '−' : item.kind === 'income' ? '+' : '↔'}{' '}
                        {money(BigInt(item.amountCents))}
                      </Label>
                    </View>
                  ))
                ) : (
                  <Label muted>
                    {text('Nenhuma movimentação registrada.', 'No entries recorded yet.')}
                  </Label>
                )}
              </Card>
            </>
          )}
        </>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Button
          label={text('Nova receita ou despesa', 'New income or expense')}
          onPress={() => router.push('/transaction')}
        />
        <Button
          variant="secondary"
          label={text('Minhas contas', 'My accounts')}
          onPress={() => router.push('/accounts')}
        />
        <Button
          variant="quiet"
          label={text('Sair da conta', 'Sign out')}
          onPress={() => void signOut()}
        />
      </View>
    </Screen>
  );
}
