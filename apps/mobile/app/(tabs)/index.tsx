import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import {
  calculateAccountBalance,
  calculateMonthlySummary,
  calculateObligationRemaining,
} from '@fintrack/shared';
import {
  Button,
  Card,
  Label,
  NegativeGradientBar,
  Screen,
  SectionHeading,
} from '../../src/components/ui';
import { useDemo } from '../../src/demo';
import { demoLabel } from '../../src/demo/labels';
import { useI18n } from '../../src/i18n';
import { usePreferences } from '../../src/preferences';
import { designTokens, useTheme } from '../../src/theme';

export default function Overview() {
  const colors = useTheme();
  const { language, formatCurrency, formatDate } = useI18n();
  const { value: preferences } = usePreferences();
  const demo = useDemo();
  const { width } = useWindowDimensions();
  const compact = width < designTokens.breakpoints.tablet;
  const [showBalance, setShowBalance] = useState(true);
  const data = demo.mode === 'demo' ? demo.dataset : null;
  const hidden = preferences.hideAmounts || !showBalance;
  const text = (pt: string, en: string) => (language === 'pt-BR' ? pt : en);

  if (!data) {
    return (
      <Screen
        eyebrow={text('VISÃO GERAL', 'OVERVIEW')}
        title={text('Seu dinheiro, com mais clareza.', 'Your money, with more clarity.')}
        subtitle={text(
          'Uma visão financeira aparece quando você usa a demonstração ou conecta registros reais.',
          'Your financial overview appears when you explore the demo or connect real records.',
        )}
      >
        <Card accent style={{ padding: compact ? 22 : 32, gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.accentText, fontWeight: '800', letterSpacing: 1 }}>
              FINTRACK PRO
            </Text>
            <SectionHeading
              title={text('Explore com dados fictícios', 'Explore with fictional data')}
              detail={text(
                'Veja um planejamento de seis meses. A demonstração fica isolada dos seus dados pessoais.',
                'Explore a six-month plan. The demo stays isolated from your personal data.',
              )}
            />
          </View>
          {demo.error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {demo.error === 'read'
                ? text(
                    'Não foi possível ler a demonstração deste dispositivo.',
                    'Could not read the demo from this device.',
                  )
                : demo.error === 'invalid'
                  ? text(
                      'A demonstração salva está inválida. Restaure o exemplo para continuar.',
                      'The saved demo is invalid. Restore the example to continue.',
                    )
                  : text(
                      'Não foi possível salvar a demonstração local.',
                      'Could not save the local demo.',
                    )}
            </Text>
          ) : null}
          <Button
            label={
              demo.error === 'read'
                ? text('Tentar novamente', 'Retry')
                : demo.error === 'invalid'
                  ? text('Restaurar exemplo', 'Restore example')
                  : text('Explorar demonstração', 'Explore demo')
            }
            disabled={
              demo.saving ||
              demo.status === 'loading' ||
              (demo.status !== 'ready' && demo.error !== 'read')
            }
            onPress={() =>
              void (demo.error === 'read'
                ? demo.hydrate()
                : demo.error === 'invalid'
                  ? demo.restoreDemo()
                  : demo.enterDemo())
            }
          />
          <Label muted>
            {text(
              'A API financeira e o PostgreSQL ainda não estão conectados. Não há saldos reais nesta tela.',
              'The financial API and PostgreSQL are not connected yet. No real balances are shown here.',
            )}
          </Label>
        </Card>
      </Screen>
    );
  }

  const summary = calculateMonthlySummary(data, data.referenceMonth, data.asOfDate);
  const checking = data.accounts.find((account) => account.id === 'checking');
  const available = checking
    ? calculateAccountBalance(checking, data.transactions, data.asOfDate)
    : 0n;
  const obligations = data.obligations
    .map((obligation) => ({
      ...obligation,
      remaining: calculateObligationRemaining(obligation, data.transactions, data.asOfDate),
    }))
    .filter((obligation) => obligation.remaining > 0n)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const categories = data.categories
    .filter((category) => category.kind === 'expense')
    .map((category) => {
      const spent = data.transactions
        .filter(
          (transaction) =>
            transaction.kind === 'expense' &&
            transaction.status === 'posted' &&
            transaction.date.startsWith(data.referenceMonth) &&
            transaction.categoryId === category.id,
        )
        .reduce((sum, transaction) => sum + BigInt(transaction.amountCents), 0n);
      const budget = BigInt(
        data.monthlyBudget.find((item) => item.categoryId === category.id)?.amountCents ?? '0',
      );
      return { category, spent, budget };
    })
    .filter(({ budget }) => budget > 0n)
    .sort((a, b) => (a.spent > b.spent ? -1 : a.spent < b.spent ? 1 : 0));
  const recent = [...data.transactions]
    .filter((transaction) => transaction.status === 'posted')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const history = [...new Set(data.transactions.map((transaction) => transaction.date.slice(0, 7)))]
    .filter((month) => month <= data.referenceMonth)
    .sort()
    .slice(-6)
    .map((month) => {
      const monthTransactions = data.transactions.filter(
        (transaction) =>
          transaction.status === 'posted' &&
          transaction.date.startsWith(month) &&
          (month !== data.referenceMonth || transaction.date <= data.asOfDate),
      );
      return {
        month,
        income: monthTransactions
          .filter((transaction) => transaction.kind === 'income')
          .reduce((sum, transaction) => sum + BigInt(transaction.amountCents), 0n),
        expenses: monthTransactions
          .filter((transaction) => transaction.kind === 'expense')
          .reduce((sum, transaction) => sum + BigInt(transaction.amountCents), 0n),
      };
    });
  const historyScale = history.reduce((max, item) => (item.income > max ? item.income : max), 1n);
  const cards = [
    {
      label: text('Saldo disponível', 'Available balance'),
      amount: available,
      note: text('Saldo inicial e movimentos realizados', 'Opening balance and posted activity'),
      color: colors.accentText,
    },
    {
      label: text('Receita recebida', 'Income received'),
      amount: summary.incomeReceivedCents,
      note: text('Neste mês até 20/out', 'This month through Oct 20'),
      color: colors.positive,
    },
    {
      label: text('Despesas pagas', 'Expenses paid'),
      amount: summary.expensesPaidCents,
      note: text('Obrigações ainda pendentes', 'Bills still outstanding'),
      color: colors.negative,
    },
    {
      label: text('Saldo projetado', 'Projected balance'),
      amount: summary.balanceProjectedCents,
      note: text(
        'Após receita prevista e contas restantes',
        'After expected income and remaining bills',
      ),
      color: colors.ink,
    },
  ];

  return (
    <Screen
      eyebrow={text('DADOS FICTÍCIOS · OUTUBRO 2026', 'FICTIONAL DATA · OCTOBER 2026')}
      title={text('Visão geral', 'Overview')}
      subtitle={text(
        'Um retrato demonstrativo até 20 de outubro. A sobra de R$ 800 é planejamento do mês completo, não saldo disponível hoje.',
        'A demo snapshot through October 20. The R$ 800 surplus is a full-month plan, not today’s available balance.',
      )}
    >
      <Card style={{ padding: 16, gap: 14, borderColor: colors.accent }}>
        <View
          style={{
            flexDirection: compact ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: compact ? 'stretch' : 'center',
            gap: 12,
          }}
        >
          <View style={{ gap: 5 }}>
            <Text
              style={{
                color: colors.accentText,
                fontWeight: '800',
                fontSize: 12,
                letterSpacing: 0.7,
              }}
            >
              {text('DEMONSTRAÇÃO · DADOS FICTÍCIOS', 'DEMO · FICTIONAL DATA')}
            </Text>
            <Label muted>
              {text(
                'Alterações ficam somente nesta demonstração neste dispositivo.',
                'Changes stay inside this demo on this device.',
              )}
            </Label>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button
              label={text('Restaurar exemplo', 'Restore example')}
              variant="secondary"
              compact
              disabled={demo.saving}
              onPress={() => void demo.restoreDemo()}
            />
            <Button
              label={text('Sair da demonstração', 'Exit demo')}
              variant="quiet"
              compact
              disabled={demo.saving}
              onPress={() => void demo.exitDemo()}
            />
          </View>
        </View>
        {demo.error === 'write' ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {text(
              'Não foi possível salvar a alteração local.',
              'The local change could not be saved.',
            )}
          </Text>
        ) : null}
      </Card>

      <View style={{ flexDirection: compact ? 'column' : 'row', flexWrap: 'wrap', gap: 14 }}>
        {cards.map((item) => (
          <Card
            key={item.label}
            style={{
              flex: compact ? undefined : 1,
              flexBasis: compact ? undefined : '23%',
              minWidth: compact ? undefined : 190,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>
              {item.label}
            </Text>
            <Text
              style={{
                color: item.color,
                fontSize: compact ? 25 : 24,
                lineHeight: 36,
                fontWeight: '800',
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatCurrency(item.amount, 'BRL', hidden)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{item.note}</Text>
          </Card>
        ))}
      </View>

      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 16, alignItems: 'stretch' }}>
        <Card style={{ flex: 1.3, gap: 18 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <SectionHeading
              title={text('Planejamento do mês', 'Monthly plan')}
              detail={text(
                'Valores planejados comparados ao que já foi pago.',
                'Planned values compared with posted payments.',
              )}
            />
            <Button
              compact
              variant="secondary"
              label={
                hidden
                  ? text('Mostrar valores', 'Show values')
                  : text('Ocultar valores', 'Hide values')
              }
              onPress={() => setShowBalance(!showBalance)}
            />
          </View>
          <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14 }}>
            {[
              {
                label: text('Receita planejada', 'Planned income'),
                value: BigInt(data.monthlyIncomePlanCents),
                color: colors.positive,
              },
              {
                label: text('Orçamento de despesas', 'Expense budget'),
                value: summary.expenseBudgetCents,
                color: colors.negative,
              },
              {
                label: text('Sobra planejada', 'Planned surplus'),
                value: summary.plannedSurplusCents,
                color: colors.accentText,
              },
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  backgroundColor: colors.elevated,
                  borderRadius: 14,
                  padding: 12,
                  gap: 7,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.label}</Text>
                <Text style={{ color: item.color, fontWeight: '800', fontSize: 16 }}>
                  {formatCurrency(item.value, 'BRL', hidden)}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Label muted>
              {text('84% da renda em despesas planejadas', '84% of income planned for expenses')}
            </Label>
            <Label muted>·</Label>
            <Label muted>{text('16% de sobra planejada', '16% planned surplus')}</Label>
          </View>
          <View
            style={{
              flexDirection: 'row',
              height: 12,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: colors.elevated,
            }}
          >
            <View accessibilityLabel="84% expenses" style={{ width: '84%' }}>
              <NegativeGradientBar height={12} radius={0} />
            </View>
            <View
              accessibilityLabel="16% surplus"
              style={{ width: '16%', backgroundColor: colors.positive }}
            />
          </View>
          <Label muted>
            {text(
              'Dos R$ 800 planejados, R$ 700 são aportes sugeridos e R$ 100 ficam como margem. Nenhum aporte é feito automaticamente.',
              'Of the R$ 800 planned surplus, R$ 700 are suggested contributions and R$ 100 remains as buffer. No contribution happens automatically.',
            )}
          </Label>
        </Card>
        <Card style={{ flex: 1, gap: 16 }}>
          <SectionHeading
            title={text('Compromissos pendentes', 'Outstanding bills')}
            detail={text(
              'Valor restante em obrigações deste mês.',
              'Remaining amount on this month’s obligations.',
            )}
          />
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '800' }}>
            {formatCurrency(summary.obligationsRemainingCents, 'BRL', hidden)}
          </Text>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>
            {text('Vencido', 'Overdue')}:{' '}
            {formatCurrency(summary.overdueObligationsCents, 'BRL', hidden)}
          </Text>
          {obligations.slice(0, 3).map((bill) => (
            <View
              key={bill.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
            >
              <Text style={{ color: colors.ink, flex: 1 }}>
                {bill.description} · {formatDate(bill.dueOn)}
              </Text>
              <Text style={{ color: colors.ink, fontWeight: '700' }}>
                {formatCurrency(bill.remaining, 'BRL', hidden)}
              </Text>
            </View>
          ))}
          <Button
            label={text('Ver movimentações', 'View activity')}
            variant="secondary"
            onPress={() => router.push('/activity')}
          />
        </Card>
      </View>

      <Card style={{ gap: 16 }}>
        <SectionHeading
          title={text('Flux mensal · últimos seis meses', 'Monthly cash flow · last six months')}
          detail={text(
            'Receitas e despesas realizadas no histórico fictício.',
            'Posted income and expenses in fictional history.',
          )}
        />
        {history.map((item) => {
          const incomeWidth = Number((item.income * 100n) / historyScale);
          const expenseWidth = Number((item.expenses * 100n) / historyScale);
          return (
            <View
              key={item.month}
              style={{
                flexDirection: compact ? 'column' : 'row',
                alignItems: compact ? 'stretch' : 'center',
                gap: 10,
              }}
            >
              <Text style={{ color: colors.muted, width: compact ? undefined : 96, fontSize: 12 }}>
                {formatDate(`${item.month}-01`)}
              </Text>
              <View style={{ flex: 1, gap: 5 }}>
                <View
                  accessibilityLabel={`${text('Receita', 'Income')} ${formatCurrency(item.income, 'BRL', hidden)}`}
                  style={{
                    height: 8,
                    width: `${Math.max(1, incomeWidth)}%`,
                    maxWidth: '100%',
                    borderRadius: 5,
                    backgroundColor: colors.positive,
                  }}
                />
                <NegativeGradientBar
                  accessibilityLabel={`${text('Despesas', 'Expenses')} ${formatCurrency(item.expenses, 'BRL', hidden)}`}
                  width={`${Math.max(1, expenseWidth)}%`}
                />
              </View>
              <View
                style={{
                  width: compact ? undefined : 205,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.positive, fontSize: 11, fontWeight: '700' }}>
                  {formatCurrency(item.income, 'BRL', hidden)}
                </Text>
                <Text style={{ color: colors.negative, fontSize: 11, fontWeight: '700' }}>
                  {formatCurrency(item.expenses, 'BRL', hidden)}
                </Text>
              </View>
            </View>
          );
        })}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Label muted>● {text('Receitas realizadas', 'Posted income')}</Label>
          <Label muted>● {text('Despesas realizadas', 'Posted expenses')}</Label>
        </View>
      </Card>

      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 16 }}>
        <Card style={{ flex: 1, gap: 16 }}>
          <SectionHeading
            title={text('Despesas por categoria', 'Expenses by category')}
            detail={text(
              'Pagamentos realizados neste mês versus orçamento.',
              'Payments posted this month versus budget.',
            )}
          />
          {categories.slice(0, 7).map(({ category, spent, budget }) => {
            const ratio = budget > 0n ? Number((spent * 100n) / budget) : 0;
            return (
              <View key={category.id} style={{ gap: 7 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ color: colors.ink, flex: 1 }}>
                    {demoLabel(category.name, language)}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {formatCurrency(spent, 'BRL', hidden)} / {formatCurrency(budget, 'BRL', hidden)}
                  </Text>
                </View>
                <View
                  style={{
                    height: 8,
                    backgroundColor: colors.elevated,
                    borderRadius: 5,
                    overflow: 'hidden',
                  }}
                >
                  <NegativeGradientBar height={8} width={`${Math.min(100, ratio)}%`} />
                </View>
              </View>
            );
          })}
        </Card>
        <Card style={{ flex: 1, gap: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <SectionHeading
              title={text('Atividade recente', 'Recent activity')}
              detail={text(
                'Últimos registros do conjunto demonstrativo.',
                'Latest records in this demo dataset.',
              )}
            />
            <Pressable accessibilityRole="link" onPress={() => router.push('/activity')}>
              <Text style={{ color: colors.accentText, fontWeight: '800' }}>
                {text('Ver tudo', 'View all')}
              </Text>
            </Pressable>
          </View>
          {recent.map((transaction) => (
            <View
              key={transaction.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingBottom: 10,
              }}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: colors.ink, fontWeight: '700' }}>
                  {demoLabel(transaction.description, language)}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {formatDate(transaction.date)}
                </Text>
              </View>
              <Text
                style={{
                  color: transaction.kind === 'income' ? colors.positive : colors.ink,
                  fontWeight: '800',
                }}
              >
                {transaction.kind === 'expense' ? '−' : '+'}
                {formatCurrency(BigInt(transaction.amountCents), 'BRL', hidden)}
              </Text>
            </View>
          ))}
        </Card>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Button
          label={text('Novo registro', 'New entry')}
          onPress={() => router.push('/transaction')}
        />
        <Button
          label={text('Contas', 'Accounts')}
          variant="secondary"
          onPress={() => router.push('/accounts')}
        />
        <Button
          label={text('Contas a pagar', 'Bills')}
          variant="secondary"
          onPress={() => router.push('/bills')}
        />
        <Button
          label={text('Caixinhas e metas', 'Envelopes and goals')}
          variant="secondary"
          onPress={() => router.push('/envelopes')}
        />
        <Button
          label={text('Simular sobra', 'Simulate surplus')}
          variant="secondary"
          onPress={() => router.push('/planning')}
        />
      </View>
    </Screen>
  );
}
