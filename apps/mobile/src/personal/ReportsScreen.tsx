import { useState } from 'react';
import { router } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';
import { addMonths, dateInTimeZone, daysInMonth } from '@fintrack/shared';
import { Button, Card, ErrorState, Label, Loading, Screen, SectionHeading } from '../components/ui';
import { useI18n } from '../i18n';
import { usePreferences } from '../preferences';
import { useTheme } from '../theme';
import { usePersonalFinance } from './usePersonalFinance';
import { personalReport, reportCsv } from './reports';

export function ReportsScreen() {
  const { data, error, loading, refresh, token } = usePersonalFinance();
  const { language, formatCurrency } = useI18n();
  const hidden = usePreferences().value.hideAmounts;
  const colors = useTheme();
  const text = (pt: string, en: string) => (language === 'pt-BR' ? pt : en);
  const money = (cents: bigint) => formatCurrency(cents, 'BRL', hidden);
  const [endMonth, setEndMonth] = useState(() => dateInTimeZone(new Date()).slice(0, 7));
  const [period, setPeriod] = useState<6 | 12>(6);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const startMonth = addMonths(`${endMonth}-01`, 1 - period).slice(0, 7);
  const report = data
    ? personalReport(data.transactions, data.categories, startMonth, endMonth, categoryId)
    : null;
  const maximum =
    report?.months.reduce(
      (max, month) =>
        month.income > max ? month.income : month.expense > max ? month.expense : max,
      0n,
    ) ?? 0n;
  const monthTitle = (month: string) =>
    new Intl.DateTimeFormat(language === 'pt-BR' ? 'pt-BR' : 'en', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${month}-01T12:00:00Z`));
  function download() {
    if (!data || !report || Platform.OS !== 'web') return;
    const blob = new Blob([reportCsv(report.rows, data.categories)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fintrack-relatorio-${startMonth}-${endMonth}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Screen
      title={text('Relatórios', 'Reports')}
      subtitle={text(
        'Entenda receitas, despesas e categorias com base nos lançamentos pagos.',
        'Review income, expenses and categories from posted transactions.',
      )}
    >
      {!token ? (
        <Card>
          <Label>
            {text('Entre na sua conta para consultar relatórios.', 'Sign in to view reports.')}
          </Label>
          <Button
            label={text('Ir para login', 'Go to sign in')}
            onPress={() => router.push('/login')}
          />
        </Card>
      ) : loading ? (
        <Loading />
      ) : error || !data || !report ? (
        <ErrorState
          message={text('Não foi possível carregar o relatório.', 'Could not load report.')}
          retry={() => void refresh()}
        />
      ) : (
        <>
          <Card>
            <SectionHeading
              title={text('Período', 'Period')}
              detail={`${monthTitle(startMonth)} – ${monthTitle(endMonth)}`}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Button
                compact
                variant="secondary"
                label="‹"
                accessibilityLabel={text('Período anterior', 'Previous period')}
                onPress={() => setEndMonth(addMonths(`${endMonth}-01`, -period).slice(0, 7))}
              />
              <Button
                compact
                variant="secondary"
                label="›"
                accessibilityLabel={text('Próximo período', 'Next period')}
                onPress={() => setEndMonth(addMonths(`${endMonth}-01`, period).slice(0, 7))}
              />
              <Button
                compact
                variant="secondary"
                selected={period === 6}
                label={text('6 meses', '6 months')}
                onPress={() => setPeriod(6)}
              />
              <Button
                compact
                variant="secondary"
                selected={period === 12}
                label={text('12 meses', '12 months')}
                onPress={() => setPeriod(12)}
              />
              {Platform.OS === 'web' ? (
                <Button
                  compact
                  variant="secondary"
                  label={text('Exportar CSV', 'Export CSV')}
                  disabled={!report.rows.length || hidden}
                  onPress={download}
                />
              ) : null}
            </View>
            <Label muted>{text('Categoria', 'Category')}</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button
                compact
                variant="secondary"
                selected={!categoryId}
                label={text('Todas', 'All')}
                onPress={() => setCategoryId(null)}
              />
              {data.categories.map((category) => (
                <Button
                  key={category.id}
                  compact
                  variant="secondary"
                  selected={categoryId === category.id}
                  label={category.name}
                  onPress={() => setCategoryId(category.id)}
                />
              ))}
            </View>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {[
              { label: text('Receitas', 'Income'), value: report.income },
              { label: text('Despesas', 'Expenses'), value: report.expense },
              { label: text('Resultado', 'Net result'), value: report.income - report.expense },
            ].map((metric) => (
              <Card key={metric.label} style={{ flexGrow: 1, minWidth: 220 }}>
                <SectionHeading title={metric.label} />
                <Label style={{ fontSize: 24, fontWeight: '700' }}>{money(metric.value)}</Label>
              </Card>
            ))}
          </View>
          <Card>
            <SectionHeading
              title={text('Receitas versus despesas', 'Income versus expenses')}
              detail={text(
                'Meses sem movimento aparecem com valor zero.',
                'Months without activity show zero.',
              )}
            />
            {report.months.map((month) => (
              <Pressable
                key={month.month}
                accessibilityRole="button"
                accessibilityLabel={`${month.month}: ${money(month.net)}`}
                accessibilityState={{ selected: selectedMonth === month.month }}
                onPress={() => setSelectedMonth(month.month)}
                style={{
                  gap: 6,
                  padding: 8,
                  borderRadius: 8,
                  borderWidth: selectedMonth === month.month ? 1 : 0,
                  borderColor: colors.accent,
                }}
              >
                <Label style={{ fontWeight: '700' }}>
                  {monthTitle(month.month)} · {money(month.net)}
                </Label>
                <View
                  accessibilityLabel={`${monthTitle(month.month)}: ${text('receitas', 'income')} ${money(month.income)}`}
                  style={{
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: colors.elevated,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 9,
                      width: `${maximum ? Number((month.income * 100n) / maximum) : 0}%`,
                      backgroundColor: colors.incomeSeries,
                    }}
                  />
                </View>
                <View
                  accessibilityLabel={`${monthTitle(month.month)}: ${text('despesas', 'expenses')} ${money(month.expense)}`}
                  style={{
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: colors.elevated,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: 9,
                      width: `${maximum ? Number((month.expense * 100n) / maximum) : 0}%`,
                      backgroundColor: colors.accent,
                    }}
                  />
                </View>
              </Pressable>
            ))}
            {selectedMonth
              ? (() => {
                  const selected = report.months.find((month) => month.month === selectedMonth);
                  const [year, monthNumber] = selectedMonth.split('-').map(Number);
                  const lastDay = String(daysInMonth(year!, monthNumber!)).padStart(2, '0');
                  return selected ? (
                    <View style={{ gap: 8 }}>
                      <Label>
                        {monthTitle(selected.month)} · {text('Receitas', 'Income')}:{' '}
                        {money(selected.income)} · {text('Despesas', 'Expenses')}:{' '}
                        {money(selected.expense)}
                      </Label>
                      <Button
                        compact
                        variant="secondary"
                        label={text('Ver lançamentos do mês', 'View month transactions')}
                        onPress={() =>
                          router.push({
                            pathname: '/activity',
                            params: {
                              from: `${selected.month}-01`,
                              to: `${selected.month}-${lastDay}`,
                              ...(categoryId ? { categoryId } : {}),
                            },
                          })
                        }
                      />
                    </View>
                  ) : null;
                })()
              : null}
            <Label muted>
              {text('Verde: receitas · Laranja: despesas', 'Green: income · Orange: expenses')}
            </Label>
          </Card>
          <Card>
            <SectionHeading title={text('Gastos por categoria', 'Spending by category')} />
            {report.byCategory.length ? (
              report.byCategory.map((category) => (
                <Label key={category.id}>
                  {category.name}: {money(category.amount)}
                </Label>
              ))
            ) : (
              <Label muted>{text('Sem gastos no período.', 'No spending in this period.')}</Label>
            )}
          </Card>
          <Card>
            <SectionHeading
              title={text('Histórico de lançamentos', 'Transaction history')}
              detail={String(report.rows.length)}
            />
            {report.rows.length ? (
              report.rows.map((row) => (
                <View
                  key={row.id}
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    justifyContent: 'space-between',
                  }}
                >
                  <Label>
                    {row.date} · {row.description}
                  </Label>
                  <Label style={{ color: row.kind === 'expense' ? colors.danger : colors.ink }}>
                    {row.kind === 'expense' ? '−' : row.kind === 'income' ? '+' : ''}
                    {money(BigInt(row.amountCents))}
                  </Label>
                </View>
              ))
            ) : (
              <Label muted>
                {text('Sem lançamentos no período.', 'No transactions in this period.')}
              </Label>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
