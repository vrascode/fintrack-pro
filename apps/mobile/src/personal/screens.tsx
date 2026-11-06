import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import {
  calculateAccountBalance,
  calendarDateSchema,
  dateInTimeZone,
  financialAccountInputSchema,
  financialTransactionInputSchema,
  type FinancialAccount,
} from '@fintrack/shared';
import { apiClient } from '../api/client';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
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
import { FinancialDashboard } from './FinancialDashboard';
import { TransactionEditor } from './TransactionEditor';
import { filterHistory } from './history';

const today = () => dateInTimeZone(new Date());
function useLabels() {
  const i18n = useI18n();
  const hidden = usePreferences().value.hideAmounts;
  return {
    ...i18n,
    hidden,
    text: (pt: string, en: string) => (i18n.language === 'pt-BR' ? pt : en),
  };
}

function AccountActions({
  account,
  busy,
  update,
}: {
  account: FinancialAccount;
  busy: boolean;
  update: (id: string, input: { name?: string; archived?: boolean }) => Promise<boolean>;
}) {
  const { text } = useLabels();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  return (
    <View style={{ gap: 8 }}>
      {account.archived ? (
        <Label muted>
          {text('Arquivada · histórico preservado', 'Archived · history preserved')}
        </Label>
      ) : null}
      {editing ? (
        <>
          <Field
            label={text('Novo nome da conta', 'New account name')}
            value={name}
            onChangeText={setName}
            maxLength={80}
            editable={!busy}
          />
          <Button
            label={text('Salvar nome', 'Save name')}
            disabled={busy || !name.trim()}
            onPress={() =>
              void update(account.id, { name }).then((saved) => saved && setEditing(false))
            }
          />
        </>
      ) : (
        <Button
          variant="quiet"
          label={text('Editar nome', 'Edit name')}
          disabled={busy}
          onPress={() => setEditing(true)}
        />
      )}
      <Button
        variant="quiet"
        disabled={busy}
        label={
          account.archived
            ? text('Reativar conta', 'Reactivate account')
            : text('Arquivar conta', 'Archive account')
        }
        onPress={() => void update(account.id, { archived: !account.archived })}
      />
    </View>
  );
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
  async function updateAccount(
    id: string,
    input: { name?: string; archived?: boolean },
  ): Promise<boolean> {
    if (!token || sending.current) return false;
    sending.current = true;
    setBusy(true);
    setMessage('');
    try {
      await apiClient.updateAccount(token, id, input);
      setFailed(false);
      setMessage(text('Conta atualizada.', 'Account updated.'));
      await refresh();
      return true;
    } catch {
      setFailed(true);
      setMessage(text('Não foi possível atualizar a conta.', 'Could not update the account.'));
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
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
                {account.openingDate > today()
                  ? text(
                      'Saldo disponível a partir da abertura',
                      'Balance available from the opening date',
                    )
                  : formatCurrency(
                      calculateAccountBalance(account, data.transactions, today()),
                      'BRL',
                      hidden,
                    )}
              </Label>
              <AccountActions account={account} busy={busy} update={updateAccount} />
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
  const activeAccounts = data?.accounts.filter((item) => !item.archived) ?? [];
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
        accountId: account || activeAccounts[0]?.id,
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
      ) : !data || !activeAccounts.length ? (
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
          {activeAccounts.map((item) => (
            <Button
              key={item.id}
              selected={(account || activeAccounts[0]?.id) === item.id}
              variant="secondary"
              label={item.name}
              disabled={busy}
              onPress={() => setAccount(item.id)}
            />
          ))}
          {kind === 'transfer' ? (
            <>
              <Label>{text('Conta de destino', 'Destination account')}</Label>
              {activeAccounts
                .filter((item) => item.id !== (account || activeAccounts[0]?.id))
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
  const { text } = useLabels();
  const { data, error, loading, refresh } = usePersonalFinance();
  const signOut = useAuth((state) => state.signOut);
  const authError = useAuth((state) => state.error);
  return (
    <Screen
      title={text('Suas finanças', 'Your finances')}
      subtitle={text('Uma visão clara do seu dinheiro.', 'A clear view of your money.')}
    >
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState
          message={text(
            'Não foi possível consultar o servidor. Seus valores não foram substituídos por zero.',
            'Could not query the server. Your balances have not been replaced with zero.',
          )}
          retry={() => void refresh()}
        />
      ) : data ? (
        !data.accounts.length ? (
          <Redirect href="/accounts" />
        ) : (
          <FinancialDashboard data={data} refresh={refresh} />
        )
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Button
          variant="quiet"
          label={text('Sair da conta', 'Sign out')}
          onPress={() => void signOut()}
        />
      </View>
      {authError === 'network' ? (
        <StatusMessage
          tone="error"
          message={text(
            'Não foi possível revogar a sessão. Verifique a conexão e tente sair novamente.',
            'Could not revoke the session. Check your connection and try signing out again.',
          )}
        />
      ) : null}
    </Screen>
  );
}
export function PersonalActivity() {
  const params = useLocalSearchParams<{
    categoryId?: string;
    from?: string;
    to?: string;
    kind?: string;
  }>();
  const { text, formatDate, formatCurrency, hidden } = useLabels();
  const { data, loading, error, refresh, token } = usePersonalFinance();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [kindFilter, setKindFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [ascending, setAscending] = useState(false);
  const editing = data?.transactions.find((entry) => entry.id === editingId);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    if (typeof params.categoryId === 'string') setCategoryFilter(params.categoryId);
    if (typeof params.from === 'string') setFrom(params.from);
    if (typeof params.to === 'string') setTo(params.to);
    if (['income', 'expense', 'transfer'].includes(params.kind ?? '')) setKindFilter(params.kind!);
  }, [params.categoryId, params.from, params.to, params.kind]);
  const valid =
    (!from || calendarDateSchema.safeParse(from).success) &&
    (!to || calendarDateSchema.safeParse(to).success) &&
    (!from || !to || from <= to);
  const rows = filterHistory(data?.transactions ?? [], {
    search,
    from,
    to,
    kind: kindFilter,
    accountId: accountFilter,
    categoryId: categoryFilter,
    ascending,
  });
  return (
    <Screen
      title={text('Movimentações salvas', 'Saved transactions')}
      subtitle={text(
        'Consulte seu histórico por descrição e período.',
        'Search your history by description and period.',
      )}
    >
      <Card>
        <Field
          label={text('Buscar movimentações', 'Search transactions')}
          value={search}
          onChangeText={setSearch}
        />
        <Field
          label={text('De (AAAA-MM-DD)', 'From (YYYY-MM-DD)')}
          value={from}
          onChangeText={setFrom}
        />
        <Field
          label={text('Até (AAAA-MM-DD)', 'To (YYYY-MM-DD)')}
          value={to}
          onChangeText={setTo}
        />
        {!valid ? (
          <StatusMessage
            tone="error"
            message={text('Confira o período informado.', 'Check the selected period.')}
          />
        ) : null}
        <Label>{text('Tipo de movimentação', 'Transaction type')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            ['', text('Todos os tipos', 'All types')],
            ['income', text('Receitas', 'Income')],
            ['expense', text('Despesas', 'Expenses')],
            ['transfer', text('Transferências', 'Transfers')],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant="quiet"
              label={label!}
              selected={kindFilter === value}
              onPress={() => setKindFilter(value!)}
            />
          ))}
        </View>
        <Label>{text('Filtrar conta', 'Filter account')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            variant="quiet"
            label={text('Todas as contas', 'All accounts')}
            selected={!accountFilter}
            onPress={() => setAccountFilter('')}
          />
          {data?.accounts.map((account) => (
            <Button
              key={account.id}
              variant="quiet"
              label={account.name}
              selected={accountFilter === account.id}
              onPress={() => setAccountFilter(account.id)}
            />
          ))}
        </View>
        <Label>{text('Filtrar categoria', 'Filter category')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            variant="quiet"
            label={text('Todas as categorias', 'All categories')}
            selected={!categoryFilter}
            onPress={() => setCategoryFilter('')}
          />
          {data?.categories.map((category) => (
            <Button
              key={category.id}
              variant="quiet"
              label={category.name}
              selected={categoryFilter === category.id}
              onPress={() => setCategoryFilter(category.id)}
            />
          ))}
        </View>
        <Button
          variant="quiet"
          label={
            ascending
              ? text('Mais antigas primeiro', 'Oldest first')
              : text('Mais recentes primeiro', 'Newest first')
          }
          onPress={() => setAscending(!ascending)}
        />
        <Button
          variant="quiet"
          label={text('Limpar filtros', 'Clear filters')}
          onPress={() => {
            setSearch('');
            setFrom('');
            setTo('');
            setKindFilter('');
            setAccountFilter('');
            setCategoryFilter('');
            setAscending(false);
          }}
        />
      </Card>
      {saved ? (
        <StatusMessage
          tone="success"
          message={text('Alteração salva no servidor.', 'Change saved on the server.')}
        />
      ) : null}
      {editing && token && data ? (
        <TransactionEditor
          key={editing.id}
          entry={editing}
          accounts={data.accounts}
          categories={data.categories}
          token={token}
          onCancel={() => setEditingId(null)}
          onSaved={async () => {
            setEditingId(null);
            setSaved(true);
            await refresh();
          }}
        />
      ) : null}
      <Button
        variant="quiet"
        label={text('Atualizar histórico', 'Refresh history')}
        disabled={loading || !!editing}
        onPress={() => void refresh()}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState
          message={text('Não foi possível carregar o histórico.', 'Could not load history.')}
          retry={() => void refresh()}
        />
      ) : valid ? (
        rows.length ? (
          rows.map((item) => (
            <Card key={item.id}>
              <SectionHeading
                title={item.description}
                detail={`${formatDate(item.date)} · ${data?.accounts.find((a) => a.id === item.accountId)?.name ?? ''}`}
              />
              <Label>
                {item.kind === 'income' ? '+' : item.kind === 'expense' ? '−' : '↔'}{' '}
                {formatCurrency(BigInt(item.amountCents), 'BRL', hidden)}
              </Label>
              <Label muted>
                {item.transferAccountId
                  ? `${text('Destino', 'Destination')}: ${data?.accounts.find((account) => account.id === item.transferAccountId)?.name ?? ''}`
                  : (data?.categories.find((c) => c.id === item.categoryId)?.name ??
                    text('Sem categoria', 'Uncategorized'))}
              </Label>
              <Button
                variant="quiet"
                label={text('Editar ou excluir', 'Edit or remove')}
                disabled={!!editing || !item.revision}
                onPress={() => {
                  setSaved(false);
                  setEditingId(item.id);
                }}
              />
            </Card>
          ))
        ) : (
          <Label muted>
            {text('Nenhuma movimentação neste período.', 'No transactions in this period.')}
          </Label>
        )
      ) : null}
    </Screen>
  );
}
