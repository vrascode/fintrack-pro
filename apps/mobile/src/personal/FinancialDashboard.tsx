import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import {
  addMonths,
  dateInTimeZone,
  type FinancialAccount,
  type FinancialCategory,
  type FinancialTransaction,
} from '@fintrack/shared';
import { Button, Card, Label, SectionHeading } from '../components/ui';
import { useI18n } from '../i18n';
import { usePreferences } from '../preferences';
import { useTheme } from '../theme';
import { dashboardSeries, percentChange, periodEnd } from './analytics';
import { summarizePersonalFinance } from './summary';

interface Records {
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  transactions: FinancialTransaction[];
}

function SeriesBar({
  value,
  maximum,
  color,
  label,
}: {
  value: bigint;
  maximum: bigint;
  color: string;
  label: string;
}) {
  const colors = useTheme();
  const width = maximum > 0n ? Number((value * 100n) / maximum) : 0;
  return (
    <View
      accessibilityLabel={label}
      style={{ height: 10, borderRadius: 5, backgroundColor: colors.elevated, overflow: 'hidden' }}
    >
      <View style={{ height: 10, width: `${width}%`, borderRadius: 5, backgroundColor: color }} />
    </View>
  );
}

export function FinancialDashboard({
  data,
  refresh,
}: {
  data: Records;
  refresh: () => Promise<void>;
}) {
  const colors = useTheme();
  const { language, formatCurrency, formatDate } = useI18n();
  const hidden = usePreferences().value.hideAmounts;
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const today = dateInTimeZone(new Date());
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const asOf = periodEnd(selectedMonth, today);
  const summary = summarizePersonalFinance(data.accounts, data.categories, data.transactions, asOf);
  const series = dashboardSeries(
    data.accounts,
    data.categories,
    data.transactions,
    selectedMonth,
    today,
  );
  const money = (value: bigint) => formatCurrency(value, 'BRL', hidden);
  const text = (pt: string, en: string) => (language === 'pt-BR' ? pt : en);
  const monthTitle = new Intl.DateTimeFormat(language === 'pt-BR' ? 'pt-BR' : 'en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${selectedMonth}-01T12:00:00Z`));
  const previous = addMonths(`${selectedMonth}-01`, -1).slice(0, 7);
  const next = addMonths(`${selectedMonth}-01`, 1).slice(0, 7);
  const categoryMax = summary.categories.reduce(
    (max, row) => (row.amount > max ? row.amount : max),
    0n,
  );
  const monthlyMax = series.reduce(
    (max, row) => (row.income > max ? row.income : row.expense > max ? row.expense : max),
    0n,
  );
  const balanceMax = series.reduce((max, row) => {
    const magnitude = row.balance < 0n ? -row.balance : row.balance;
    return magnitude > max ? magnitude : max;
  }, 0n);
  const recent = data.transactions
    .filter((row) => row.status === 'posted' && row.date <= asOf)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 5);
  const cardWidth = compact ? '100%' : '48.5%';
  const metrics = [
    {
      label: text('Saldo disponível', 'Available balance'),
      value: summary.balance,
      detail: text(
        'Todas as contas até a data selecionada',
        'All accounts through the selected date',
      ),
      prominent: true,
    },
    {
      label: text('Receitas do mês', 'Monthly income'),
      value: summary.current.income,
      detail: text('Recebidas no período', 'Received in this period'),
    },
    {
      label: text('Despesas do mês', 'Monthly expenses'),
      value: summary.current.expense,
      detail: text('Pagas no período', 'Paid in this period'),
    },
    {
      label: text('Resultado do mês', 'Monthly result'),
      value: summary.current.net,
      detail:
        percentChange(summary.current.net, summary.previous.net) ??
        text('Sem base no mês anterior', 'No previous month baseline'),
    },
  ];
  return (
    <View style={{ gap: 24 }}>
      <View
        style={{
          flexDirection: compact ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: compact ? 'stretch' : 'center',
          gap: 16,
        }}
      >
        <View style={{ gap: 5 }}>
          <Label style={{ fontWeight: '700', fontSize: 17 }}>
            {text('Sua visão financeira', 'Your financial overview')}
          </Label>
          <Label muted>
            {text('Dados reais da sua conta', 'Live records from your account')} · {monthTitle}
          </Label>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            compact
            variant="secondary"
            label={text('Configurações', 'Settings')}
            onPress={() => router.push('/preferences')}
          />
          <Button
            compact
            variant="secondary"
            label={text('Atualizar', 'Refresh')}
            onPress={() => void refresh()}
          />
          <Button
            compact
            label={text('+ Lançamento', '+ Entry')}
            onPress={() => router.push('/transaction')}
          />
        </View>
      </View>
      <View
        accessibilityLabel={text('Selecionar mês', 'Select month')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <Button
          compact
          variant="secondary"
          label="‹"
          accessibilityLabel={text('Mês anterior', 'Previous month')}
          onPress={() => setSelectedMonth(previous)}
        />
        <Label
          style={{
            fontWeight: '700',
            minWidth: 145,
            textAlign: 'center',
            textTransform: 'capitalize',
          }}
        >
          {monthTitle}
        </Label>
        <Button
          compact
          variant="secondary"
          label="›"
          accessibilityLabel={text('Próximo mês', 'Next month')}
          disabled={next > today.slice(0, 7)}
          onPress={() => setSelectedMonth(next)}
        />
        {selectedMonth !== today.slice(0, 7) ? (
          <Button
            compact
            variant="quiet"
            label={text('Mês atual', 'Current month')}
            onPress={() => setSelectedMonth(today.slice(0, 7))}
          />
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {metrics.map((item) => (
          <Card
            key={item.label}
            accent={!!item.prominent}
            style={{
              width: cardWidth,
              minWidth: compact ? undefined : 260,
              flexGrow: 1,
              padding: 22,
              gap: 10,
            }}
          >
            <Label muted style={{ fontSize: 13, fontWeight: '700' }}>
              {item.label}
            </Label>
            <Text
              accessibilityLabel={`${item.label}: ${money(item.value)}`}
              style={{
                color: item.prominent ? colors.accentText : colors.ink,
                fontSize: compact ? 27 : 32,
                fontWeight: '800',
                fontVariant: ['tabular-nums'],
              }}
            >
              {money(item.value)}
            </Text>
            <Label muted style={{ fontSize: 13 }}>
              {item.detail}
            </Label>
          </Card>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ width: cardWidth, flexGrow: 1, minWidth: compact ? undefined : 290 }}>
          <SectionHeading
            title={text('Receitas versus despesas', 'Income versus expenses')}
            detail={monthTitle}
          />
          {summary.current.income === 0n && summary.current.expense === 0n ? (
            <Label muted>{text('Nenhum lançamento neste mês.', 'No entries this month.')}</Label>
          ) : (
            [
              {
                label: text('Receitas', 'Income'),
                value: summary.current.income,
                color: colors.accent,
              },
              {
                label: text('Despesas', 'Expenses'),
                value: summary.current.expense,
                color: colors.expenseSeries,
              },
            ].map((row) => (
              <View key={row.label} style={{ gap: 8 }}>
                <Label>
                  {row.label} · {money(row.value)}
                </Label>
                <SeriesBar
                  value={row.value}
                  maximum={
                    summary.current.income > summary.current.expense
                      ? summary.current.income
                      : summary.current.expense
                  }
                  color={row.color}
                  label={`${row.label}: ${money(row.value)}`}
                />
              </View>
            ))
          )}
        </Card>
        <Card style={{ width: cardWidth, flexGrow: 1, minWidth: compact ? undefined : 290 }}>
          <SectionHeading
            title={text('Gastos por categoria', 'Spending by category')}
            detail={monthTitle}
          />
          {summary.categories.length ? (
            summary.categories.slice(0, 6).map((row) => (
              <View key={row.id} style={{ gap: 8 }}>
                <Label>
                  {row.name ?? text('Sem categoria', 'Uncategorized')} · {money(row.amount)}
                </Label>
                <SeriesBar
                  value={row.amount}
                  maximum={categoryMax}
                  color={colors.accent}
                  label={`${row.name ?? text('Sem categoria', 'Uncategorized')}: ${money(row.amount)}`}
                />
              </View>
            ))
          ) : (
            <Label muted>{text('Nenhuma despesa neste mês.', 'No expenses this month.')}</Label>
          )}
        </Card>
      </View>
      <Card>
        <SectionHeading
          title={text('Evolução do saldo', 'Balance evolution')}
          detail={text('Saldo ao fim de cada mês', 'Balance at each month end')}
        />
        {series.map((row) => (
          <Pressable
            key={row.month}
            accessibilityRole="button"
            accessibilityLabel={`${row.month}: ${money(row.balance)}`}
            accessibilityState={{ selected: row.month === selectedMonth }}
            onPress={() => setSelectedMonth(row.month)}
            style={{ gap: 6, paddingVertical: 4 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Label muted>{row.month}</Label>
              <Label style={{ fontWeight: '700' }}>{money(row.balance)}</Label>
            </View>
            <SeriesBar
              value={row.balance < 0n ? -row.balance : row.balance}
              maximum={balanceMax}
              color={row.month === selectedMonth ? colors.accent : colors.expenseSeries}
              label={`${row.month}: ${money(row.balance)}`}
            />
          </Pressable>
        ))}
      </Card>
      <Card>
        <SectionHeading
          title={text('Comparativo mensal', 'Monthly comparison')}
          detail={text(
            'Últimos seis meses até o período selecionado',
            'Six months through the selected period',
          )}
        />
        {series.every((row) => row.income === 0n && row.expense === 0n) ? (
          <Label muted>
            {text('Ainda não há movimentações para comparar.', 'No activity to compare yet.')}
          </Label>
        ) : (
          series.map((row) => (
            <View
              key={row.month}
              style={{
                flexDirection: compact ? 'column' : 'row',
                alignItems: compact ? 'stretch' : 'center',
                gap: 10,
              }}
            >
              <Label muted style={{ width: 70 }}>
                {row.month.slice(5)}/{row.month.slice(2, 4)}
              </Label>
              <View style={{ flex: 1, gap: 5 }}>
                <SeriesBar
                  value={row.income}
                  maximum={monthlyMax}
                  color={colors.accent}
                  label={`${row.month} · ${text('Receitas', 'Income')}: ${money(row.income)}`}
                />
                <SeriesBar
                  value={row.expense}
                  maximum={monthlyMax}
                  color={colors.expenseSeries}
                  label={`${row.month} · ${text('Despesas', 'Expenses')}: ${money(row.expense)}`}
                />
              </View>
              <Label
                style={{
                  width: compact ? undefined : 130,
                  textAlign: compact ? 'left' : 'right',
                  fontSize: 13,
                }}
              >
                {money(row.net)}
              </Label>
            </View>
          ))
        )}
      </Card>
      <Card>
        <View
          style={{
            flexDirection: compact ? 'column' : 'row',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <SectionHeading
            title={text('Últimas transações', 'Recent transactions')}
            detail={text('Até a data selecionada', 'Through the selected date')}
          />
          <Button
            compact
            variant="quiet"
            label={text('Ver histórico', 'View history')}
            onPress={() => router.push('/activity')}
          />
        </View>
        {recent.length ? (
          recent.map((row) => (
            <View
              key={row.id}
              style={{
                flexDirection: compact ? 'column' : 'row',
                justifyContent: 'space-between',
                borderTopWidth: 1,
                borderColor: colors.border,
                paddingTop: 12,
                gap: 4,
              }}
            >
              <View>
                <Label style={{ fontWeight: '700' }}>{row.description}</Label>
                <Label muted style={{ fontSize: 13 }}>
                  {formatDate(row.date)} ·{' '}
                  {data.accounts.find((account) => account.id === row.accountId)?.name ?? ''}
                </Label>
              </View>
              <Label
                style={{
                  color: row.kind === 'income' ? colors.accentText : colors.ink,
                  fontWeight: '700',
                }}
              >
                {row.kind === 'expense' ? '−' : row.kind === 'income' ? '+' : '↔'}{' '}
                {money(BigInt(row.amountCents))}
              </Label>
            </View>
          ))
        ) : (
          <Label muted>
            {text(
              'Nenhuma movimentação registrada até esta data.',
              'No entries recorded through this date.',
            )}
          </Label>
        )}
      </Card>
    </View>
  );
}
