import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import {
  addMonths,
  dateInTimeZone,
  monthlyBudgetInputSchema,
  type FinancialCategory,
  type MonthlyBudget,
} from '@fintrack/shared';
import { apiClient } from '../api/client';
import { useAuth } from '../auth';
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
import { parseLocalizedCents } from '../demo/input';
import { useI18n } from '../i18n';
import { usePreferences } from '../preferences';
import { useTheme } from '../theme';

export function BudgetsScreen() {
  const token = useAuth((state) => state.session?.accessToken);
  const { language, formatCurrency } = useI18n();
  const hidden = usePreferences().value.hideAmounts;
  const colors = useTheme();
  const compact = useWindowDimensions().width < 700;
  const text = (pt: string, en: string) => (language === 'pt-BR' ? pt : en);
  const [month, setMonth] = useState(() => dateInTimeZone(new Date()).slice(0, 7));
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const sending = useRef(false);
  const money = (cents: bigint) => formatCurrency(cents, 'BRL', hidden);
  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const [items, options] = await Promise.all([
        apiClient.budgets(token, month),
        apiClient.categories(token),
      ]);
      if (sequence === request.current) {
        setBudgets(items);
        setCategories(options.filter((item) => item.kind === 'expense'));
      }
    } catch {
      if (sequence === request.current) setError(true);
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [token, month]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        request.current++;
      };
    }, [refresh]),
  );
  const monthTitle = new Intl.DateTimeFormat(language === 'pt-BR' ? 'pt-BR' : 'en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00Z`));
  const available = categories.filter(
    (item) => !budgets.some((budget) => budget.categoryId === item.id),
  );

  async function save() {
    if (!token || sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage('');
    try {
      const limitCents = parseLocalizedCents(amount, language).toString();
      if (editingId) await apiClient.updateBudget(token, editingId, limitCents);
      else
        await apiClient.createBudget(
          token,
          monthlyBudgetInputSchema.parse({ categoryId: selectedCategory, month, limitCents }),
        );
      setEditingId(null);
      setSelectedCategory('');
      setAmount('');
      setFailed(false);
      setMessage(text('Orçamento salvo.', 'Budget saved.'));
      await refresh();
    } catch {
      setFailed(true);
      setMessage(
        text(
          'Não foi possível salvar. Confira categoria, valor e conexão. Os dados permanecem no formulário.',
          'Could not save. Check category, amount and connection. Your input remains in the form.',
        ),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!token || sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage('');
    try {
      await apiClient.removeBudget(token, id);
      setRemovingId(null);
      setFailed(false);
      setMessage(
        text(
          'Orçamento excluído. Seus lançamentos foram preservados.',
          'Budget removed. Your transactions were preserved.',
        ),
      );
      await refresh();
    } catch {
      setFailed(true);
      setMessage(text('Não foi possível excluir o orçamento.', 'Could not remove the budget.'));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  function edit(item: MonthlyBudget) {
    setEditingId(item.id);
    setSelectedCategory(item.categoryId);
    const cents = BigInt(item.limitCents);
    setAmount(
      `${cents / 100n}${language === 'pt-BR' ? ',' : '.'}${String(cents % 100n).padStart(2, '0')}`,
    );
    setMessage('');
  }
  return (
    <Screen
      title={text('Orçamentos', 'Budgets')}
      subtitle={text(
        'Defina limites por categoria. O gasto vem dos lançamentos pagos; orçamentos não movimentam contas.',
        'Set category limits. Spending comes from posted entries; budgets do not move account money.',
      )}
    >
      {!token ? (
        <Card>
          <Label>
            {text(
              'Entre na sua conta para criar orçamentos pessoais.',
              'Sign in to create personal budgets.',
            )}
          </Label>
          <Button
            label={text('Ir para login', 'Go to sign in')}
            onPress={() => router.push('/login')}
          />
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Button
              compact
              variant="secondary"
              label="‹"
              accessibilityLabel={text('Mês anterior', 'Previous month')}
              onPress={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}
            />
            <Label
              style={{
                fontWeight: '700',
                textTransform: 'capitalize',
                minWidth: 150,
                textAlign: 'center',
              }}
            >
              {monthTitle}
            </Label>
            <Button
              compact
              variant="secondary"
              label="›"
              accessibilityLabel={text('Próximo mês', 'Next month')}
              onPress={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}
            />
          </View>
          {loading ? (
            <Loading />
          ) : error ? (
            <ErrorState
              message={text('Não foi possível carregar os orçamentos.', 'Could not load budgets.')}
              retry={() => void refresh()}
            />
          ) : (
            <>
              {budgets.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                  {budgets.map((item) => {
                    const limit = BigInt(item.limitCents);
                    const spent = BigInt(item.spentCents);
                    const remaining = limit - spent;
                    const used = (spent * 100n) / limit;
                    const usedLabel = used > 999n ? '999+' : used.toString();
                    return (
                      <Card
                        key={item.id}
                        style={{
                          width: compact ? '100%' : '48%',
                          minWidth: compact ? undefined : 280,
                          flexGrow: 1,
                        }}
                      >
                        <SectionHeading
                          title={item.categoryName}
                          detail={`${monthTitle} · ${usedLabel}% ${text('utilizado', 'used')}`}
                        />
                        <View
                          style={{
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: colors.elevated,
                            overflow: 'hidden',
                          }}
                          accessibilityLabel={`${item.categoryName}: ${usedLabel}%`}
                        >
                          <View
                            style={{
                              width: `${Number(used > 100n ? 100n : used)}%`,
                              height: 10,
                              backgroundColor: remaining < 0n ? colors.danger : colors.accent,
                            }}
                          />
                        </View>
                        <Label>
                          {text('Limite', 'Limit')}: {money(limit)}
                        </Label>
                        <Label>
                          {text('Gasto', 'Spent')}: {money(spent)}
                        </Label>
                        <Label
                          style={{
                            color: remaining < 0n ? colors.danger : colors.ink,
                            fontWeight: '700',
                          }}
                        >
                          {remaining < 0n
                            ? text('Acima do limite', 'Over budget')
                            : text('Disponível no orçamento', 'Budget remaining')}
                          : {money(remaining < 0n ? -remaining : remaining)}
                        </Label>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          <Button
                            compact
                            variant="secondary"
                            label={text('Editar', 'Edit')}
                            disabled={busy}
                            onPress={() => edit(item)}
                          />
                          <Button
                            compact
                            variant="quiet"
                            label={text('Excluir', 'Remove')}
                            disabled={busy}
                            onPress={() => setRemovingId(item.id)}
                          />
                        </View>
                        {removingId === item.id ? (
                          <View style={{ gap: 8 }}>
                            <Label>
                              {text(
                                'Excluir apenas este limite mensal?',
                                'Remove this monthly limit only?',
                              )}
                            </Label>
                            <Button
                              compact
                              label={text('Confirmar exclusão', 'Confirm removal')}
                              disabled={busy}
                              onPress={() => void remove(item.id)}
                            />
                            <Button
                              compact
                              variant="quiet"
                              label={text('Cancelar', 'Cancel')}
                              onPress={() => setRemovingId(null)}
                            />
                          </View>
                        ) : null}
                      </Card>
                    );
                  })}
                </View>
              ) : (
                <Card>
                  <SectionHeading
                    title={text('Nenhum orçamento neste mês', 'No budgets this month')}
                    detail={text(
                      'Escolha uma categoria de despesa para começar.',
                      'Choose an expense category to begin.',
                    )}
                  />
                </Card>
              )}
              <Card>
                <SectionHeading
                  title={
                    editingId
                      ? text('Editar limite', 'Edit limit')
                      : text('Novo orçamento', 'New budget')
                  }
                />
                {editingId ? (
                  <Label muted>{budgets.find((item) => item.id === editingId)?.categoryName}</Label>
                ) : available.length ? (
                  <>
                    <Label>{text('Categoria', 'Category')}</Label>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {available.map((item) => (
                        <Button
                          key={item.id}
                          compact
                          variant="secondary"
                          selected={selectedCategory === item.id}
                          label={item.name}
                          onPress={() => setSelectedCategory(item.id)}
                        />
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Label muted>
                      {categories.length
                        ? text(
                            'Todas as categorias de despesa já têm orçamento neste mês.',
                            'Every expense category already has a budget this month.',
                          )
                        : text(
                            'Crie uma categoria de despesa para definir um orçamento.',
                            'Create an expense category to set a budget.',
                          )}
                    </Label>
                    {!categories.length ? (
                      <Button
                        compact
                        variant="secondary"
                        label={text('Criar categoria', 'Create category')}
                        onPress={() => router.push('/transaction')}
                      />
                    ) : null}
                  </>
                )}
                <Field
                  label={text('Limite mensal (R$)', 'Monthly limit (BRL)')}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  editable={!busy}
                />
                {message ? (
                  <StatusMessage tone={failed ? 'error' : 'success'} message={message} />
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button
                    label={
                      busy ? text('Salvando…', 'Saving…') : text('Salvar orçamento', 'Save budget')
                    }
                    disabled={busy || (!editingId && !selectedCategory) || !amount.trim()}
                    onPress={() => void save()}
                  />
                  {editingId ? (
                    <Button
                      variant="quiet"
                      label={text('Cancelar edição', 'Cancel edit')}
                      onPress={() => {
                        setEditingId(null);
                        setAmount('');
                        setSelectedCategory('');
                      }}
                    />
                  ) : null}
                </View>
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
