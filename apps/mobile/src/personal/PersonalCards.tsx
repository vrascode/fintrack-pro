import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
import {
  dateInTimeZone,
  type CreditCard,
  type CreditCardInput,
  type FinancialAccount,
  type FinancialCategory,
} from '@fintrack/shared';
import { apiClient, ApiClientError } from '../api/client';
import { useAuth } from '../auth';
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
import { parseLocalizedCents } from '../demo/input';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

export function PersonalCards() {
  const token = useAuth((state) => state.session?.accessToken);
  const { language, formatCurrency } = useI18n();
  const colors = useTheme();
  const text = (pt: string, en: string) => (language === 'pt-BR' ? pt : en);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [limit, setLimit] = useState('');
  const [closing, setClosing] = useState('10');
  const [due, setDue] = useState('20');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const sending = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [accountId, setAccountId] = useState('');
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof apiClient.cardLedger>> | null>(
    null,
  );
  const [purchaseDescription, setPurchaseDescription] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(dateInTimeZone(new Date()));
  const [installments, setInstallments] = useState('1');
  const [categoryId, setCategoryId] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const refresh = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLedger(null);
    try {
      const [items, owned, kinds] = await Promise.all([
        apiClient.cards(token),
        apiClient.accounts(token),
        apiClient.categories(token),
      ]);
      setCards(items);
      setAccounts(owned);
      setCategories(kinds);
      setAccountId((current) => current || owned.find((item) => !item.archived)?.id || '');
      const current = selected ?? items.find((item) => !item.archived)?.id ?? null;
      setSelected(current);
      setLedger(current ? await apiClient.cardLedger(token, current) : null);
      setMessage('');
    } catch (error) {
      const status = error instanceof ApiClientError ? error.status : -1;
      setMessage(
        status === 401
          ? text('Sessão expirada. Entre novamente.', 'Session expired. Sign in again.')
          : status === 404
            ? text(
                'Rota de cartões indisponível. Reinicie a API.',
                'Card route unavailable. Restart the API.',
              )
            : status === 503
              ? text('Banco indisponível.', 'Database unavailable.')
              : text('Não foi possível carregar cartões.', 'Could not load cards.'),
      );
    } finally {
      setLoading(false);
    }
  }, [token, language, selected]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  async function save() {
    if (!token || sending.current) return;
    sending.current = true;
    setSaving(true);
    setMessage('');
    try {
      const input: CreditCardInput = {
        name,
        institution,
        ...(lastFour ? { lastFour } : {}),
        limitCents: parseLocalizedCents(limit, language).toString(),
        closingDay: Number(closing),
        dueDay: Number(due),
        color: '#C84A01',
      };
      await apiClient.createCard(token, input);
      setName('');
      setInstitution('');
      setLastFour('');
      setLimit('');
      await refresh();
    } catch {
      setMessage(text('Confira os dados do cartão.', 'Check the card details.'));
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }
  async function purchase() {
    if (!token || !selected || sending.current) return;
    sending.current = true;
    setSaving(true);
    setMessage('');
    try {
      const input = {
        description: purchaseDescription,
        amountCents: parseLocalizedCents(purchaseAmount, language).toString(),
        purchasedOn: purchaseDate,
        installments: Number(installments),
        ...(categoryId ? { categoryId } : {}),
      };
      const fingerprint = `${selected}:${JSON.stringify(input)}`;
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = {
          fingerprint,
          key: `purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      await apiClient.createCardPurchase(token, selected, retry.current.key, input);
      retry.current = null;
      setPurchaseDescription('');
      setPurchaseAmount('');
      await refresh();
    } catch {
      setMessage(
        text(
          'Compra não registrada. Confira valor, limite e data.',
          'Purchase not recorded. Check amount, limit and date.',
        ),
      );
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }
  async function pay(month: string, remaining: bigint) {
    if (!token || !selected || !accountId || sending.current) return;
    sending.current = true;
    setSaving(true);
    setMessage('');
    try {
      const amount = paymentAmounts[month]?.trim()
        ? parseLocalizedCents(paymentAmounts[month]!, language)
        : remaining;
      if (amount <= 0n || amount > remaining) throw new RangeError();
      const fingerprint = `${selected}:${month}:${accountId}:${amount}`;
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = {
          fingerprint,
          key: `invoice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
      await apiClient.payCardInvoice(token, selected, retry.current.key, {
        invoiceMonth: month,
        accountId,
        amountCents: amount.toString(),
      });
      retry.current = null;
      setPaymentAmounts((current) => ({ ...current, [month]: '' }));
      await refresh();
    } catch {
      setMessage(
        text(
          'Pagamento não registrado. Confira conta e valor.',
          'Payment not recorded. Check account and amount.',
        ),
      );
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }
  return (
    <Screen
      title={text('Cartões de crédito', 'Credit cards')}
      subtitle={text(
        'Cadastre e organize seus cartões pessoais.',
        'Register and organize your personal cards.',
      )}
    >
      {message ? <StatusMessage tone="error" message={message} /> : null}
      {message ? (
        <Button
          variant="secondary"
          label={text('Tentar novamente', 'Retry')}
          onPress={() => void refresh()}
        />
      ) : null}
      <Card>
        <Label>{text('Novo cartão', 'New card')}</Label>
        <Field label={text('Nome', 'Name')} value={name} onChangeText={setName} />
        <Field
          label={text('Instituição', 'Institution')}
          value={institution}
          onChangeText={setInstitution}
        />
        <Field
          label={text('Últimos quatro dígitos (opcional)', 'Last four digits (optional)')}
          value={lastFour}
          onChangeText={setLastFour}
          keyboardType="numeric"
          maxLength={4}
        />
        <Field
          label={text('Limite total', 'Total limit')}
          value={limit}
          onChangeText={setLimit}
          keyboardType="decimal-pad"
        />
        <Field
          label={text('Dia de fechamento (1–28)', 'Closing day (1–28)')}
          value={closing}
          onChangeText={setClosing}
          keyboardType="numeric"
        />
        <Field
          label={text('Dia de vencimento (1–28)', 'Due day (1–28)')}
          value={due}
          onChangeText={setDue}
          keyboardType="numeric"
        />
        <Button
          label={text('Cadastrar cartão', 'Create card')}
          disabled={saving}
          onPress={() => void save()}
        />
      </Card>
      {loading ? (
        <Loading label={text('Carregando cartões…', 'Loading cards…')} />
      ) : cards.length === 0 && !message ? (
        <Card>
          <EmptyState
            symbol="▣"
            title={text('Nenhum cartão cadastrado.', 'No cards yet.')}
            description={text(
              'Cadastre seu primeiro cartão no formulário acima para acompanhar compras e faturas.',
              'Create your first card above to track purchases and invoices.',
            )}
          />
        </Card>
      ) : (
        cards.map((item) => (
          <Card key={item.id} style={{ borderColor: item.archived ? colors.border : item.color }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>{item.name}</Text>
            <Label muted>
              {item.institution}
              {item.lastFour ? ` · •••• ${item.lastFour}` : ''}
            </Label>
            <Label>
              {text('Limite', 'Limit')}: {formatCurrency(BigInt(item.limitCents), 'BRL', false)}
            </Label>
            <Label muted>
              {text('Fecha dia', 'Closes on day')} {item.closingDay} ·{' '}
              {text('vence dia', 'due on day')} {item.dueDay}
            </Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                variant="secondary"
                selected={selected === item.id}
                label={text('Ver faturas', 'View invoices')}
                onPress={() => setSelected(item.id)}
              />
              <Button
                variant="secondary"
                label={item.archived ? text('Reativar', 'Reactivate') : text('Arquivar', 'Archive')}
                onPress={() => {
                  if (token)
                    void apiClient
                      .updateCard(token, item.id, { archived: !item.archived })
                      .then(refresh)
                      .catch(() =>
                        setMessage(text('Falha ao alterar cartão.', 'Could not update card.')),
                      );
                }}
              />
            </View>
          </Card>
        ))
      )}
      {selected && ledger ? (
        <>
          <Card accent>
            <Label>{text('Resumo do cartão', 'Card overview')}</Label>
            <Label>
              {text('Limite total', 'Total limit')}:{' '}
              {formatCurrency(BigInt(ledger.limitCents), 'BRL', false)}
            </Label>
            <Label>
              {text('Utilizado', 'Used')}: {formatCurrency(BigInt(ledger.usedCents), 'BRL', false)}
            </Label>
            <Label>
              {text('Disponível', 'Available')}:{' '}
              {formatCurrency(BigInt(ledger.availableCents), 'BRL', false)}
            </Label>
          </Card>
          <Card>
            <Label>{text('Nova compra', 'New purchase')}</Label>
            <Field
              label={text('Descrição', 'Description')}
              value={purchaseDescription}
              onChangeText={setPurchaseDescription}
            />
            <Field
              label={text('Valor', 'Amount')}
              value={purchaseAmount}
              onChangeText={setPurchaseAmount}
              keyboardType="decimal-pad"
            />
            <Field
              label={text('Data (AAAA-MM-DD)', 'Date (YYYY-MM-DD)')}
              value={purchaseDate}
              onChangeText={setPurchaseDate}
            />
            <Field
              label={text('Parcelas (1–48)', 'Installments (1–48)')}
              value={installments}
              onChangeText={setInstallments}
              keyboardType="numeric"
            />
            <Label>{text('Categoria (opcional)', 'Category (optional)')}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {categories
                .filter((item) => item.kind === 'expense')
                .map((item) => (
                  <Button
                    key={item.id}
                    compact
                    variant="secondary"
                    selected={categoryId === item.id}
                    label={item.name}
                    onPress={() => setCategoryId(categoryId === item.id ? '' : item.id)}
                  />
                ))}
            </View>
            <Button
              label={text('Registrar compra', 'Record purchase')}
              disabled={saving || !!cards.find((item) => item.id === selected)?.archived}
              onPress={() => void purchase()}
            />
          </Card>
          <Label>{text('Conta para pagar faturas', 'Account for invoice payments')}</Label>
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
          {ledger.invoices.map((invoice) => (
            <Card key={invoice.month}>
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}>
                {text('Fatura', 'Invoice')} {invoice.month}
              </Text>
              <Label muted>
                {text('Vence em', 'Due')} {invoice.dueOn} ·{' '}
                {invoice.status === 'paid'
                  ? text('Paga', 'Paid')
                  : invoice.status === 'overdue'
                    ? text('Atrasada', 'Overdue')
                    : invoice.status === 'closed'
                      ? text('Fechada', 'Closed')
                      : text('Aberta', 'Open')}
              </Label>
              <Label>
                {text('Total', 'Total')}: {formatCurrency(BigInt(invoice.totalCents), 'BRL', false)}
              </Label>
              <Label>
                {text('Restante', 'Remaining')}:{' '}
                {formatCurrency(BigInt(invoice.remainingCents), 'BRL', false)}
              </Label>
              {invoice.installments.map((item) => (
                <Label key={`${item.purchaseId}-${item.number}`} muted>
                  {item.description} {item.number}/{item.count} ·{' '}
                  {formatCurrency(BigInt(item.amountCents), 'BRL', false)}
                </Label>
              ))}
              {invoice.payments.map((item) => (
                <Label key={item.id} muted>
                  {text('Pago', 'Paid')}: {formatCurrency(BigInt(item.amountCents), 'BRL', false)}
                </Label>
              ))}
              {BigInt(invoice.remainingCents) > 0n ? (
                <>
                  <Field
                    label={text('Pagamento parcial (opcional)', 'Partial payment (optional)')}
                    value={paymentAmounts[invoice.month] ?? ''}
                    onChangeText={(value) =>
                      setPaymentAmounts((current) => ({ ...current, [invoice.month]: value }))
                    }
                    keyboardType="decimal-pad"
                  />
                  <Button
                    label={text('Pagar fatura', 'Pay invoice')}
                    disabled={!accountId || saving}
                    onPress={() => void pay(invoice.month, BigInt(invoice.remainingCents))}
                  />
                </>
              ) : null}
            </Card>
          ))}
          <Card>
            <Label>{text('Histórico de compras', 'Purchase history')}</Label>
            {ledger.purchases.map((item) => (
              <View key={item.id} style={{ gap: 6 }}>
                <Label>
                  {item.description} · {item.purchasedOn} ·{' '}
                  {formatCurrency(BigInt(item.amountCents), 'BRL', false)}
                </Label>
                {!item.canceled ? (
                  <Button
                    compact
                    variant="quiet"
                    label={text('Cancelar compra', 'Cancel purchase')}
                    onPress={() => {
                      if (token)
                        void apiClient
                          .cancelCardPurchase(token, selected, item.id)
                          .then(refresh)
                          .catch(() =>
                            setMessage(
                              text(
                                'Fatura paga exige estorno específico.',
                                'Paid invoice requires a separate refund.',
                              ),
                            ),
                          );
                    }}
                  />
                ) : (
                  <Label muted>{text('Cancelada', 'Canceled')}</Label>
                )}
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
