import { useMemo, useState } from 'react';
import { Platform, Share, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { exportTransactionsCsv } from '@fintrack/shared';
import { Button, Card, EmptyState, Label, Screen } from '../../src/components/ui';
import { useDemo } from '../../src/demo';
import { demoLabel } from '../../src/demo/labels';
import { useI18n } from '../../src/i18n';
import { usePreferences } from '../../src/preferences';
import { designTokens, useTheme } from '../../src/theme';

type Filter = 'all' | 'income' | 'expense' | 'transfer' | 'planned';

export default function Activity() {
  const { language, formatCurrency, formatDate } = useI18n();
  const { value: preferences } = usePreferences();
  const { mode, dataset } = useDemo();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const pt = language === 'pt-BR';
  const text = (portuguese: string, english: string) => (pt ? portuguese : english);
  const data = mode === 'demo' ? dataset : null;
  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLocaleLowerCase(language === 'pt-BR' ? 'pt-BR' : 'en');
    return [...data.transactions]
      .filter(
        (item) =>
          filter === 'all' ||
          (filter === 'planned' ? item.status === 'planned' : item.kind === filter),
      )
      .filter(
        (item) =>
          !needle ||
          `${item.description} ${demoLabel(item.description, language)} ${item.date} ${item.categoryId ?? ''} ${demoLabel(item.categoryId ?? '', language)}`
            .toLocaleLowerCase()
            .includes(needle),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, filter, language, query]);
  const downloadCsv = async () => {
    if (!data) return;
    const csv = exportTransactionsCsv(
      filtered,
      {
        category: new Map(
          data.categories.map((category) => [category.id, demoLabel(category.name, language)]),
        ),
        account: new Map(
          data.accounts.map((account) => [account.id, demoLabel(account.name, language)]),
        ),
      },
      language,
    );
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'fintrack-demo-transactions.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ title: 'FinTrack Pro CSV', message: csv });
    }
  };

  return (
    <Screen
      title={text('Movimentações', 'Activity')}
      subtitle={text(
        'Histórico do conjunto demonstrativo com busca, filtros e exportação.',
        'Demo history with search, filters, and export.',
      )}
    >
      {data ? (
        <>
          <Card style={{ gap: 8, borderColor: colors.warning }}>
            <Text style={{ color: colors.warning, fontWeight: '800', fontSize: 12 }}>
              {text('DEMONSTRAÇÃO · DADOS FICTÍCIOS', 'DEMO · FICTIONAL DATA')}
            </Text>
            <Label muted>
              {text(
                'A busca e a exportação usam somente os dados fictícios armazenados para a demonstração.',
                'Search and export use only fictional data stored for the demo.',
              )}
            </Label>
          </Card>
          <View
            style={{
              flexDirection: width < designTokens.breakpoints.tablet ? 'column' : 'row',
              alignItems: width < designTokens.breakpoints.tablet ? 'stretch' : 'center',
              gap: 12,
            }}
          >
            <TextInput
              accessibilityLabel={text('Buscar movimentações', 'Search activity')}
              value={query}
              onChangeText={setQuery}
              placeholder={text(
                'Buscar descrição, categoria ou data',
                'Search description, category, or date',
              )}
              placeholderTextColor={colors.muted}
              style={{
                flex: 1,
                minHeight: 48,
                color: colors.ink,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 13,
                paddingHorizontal: 14,
              }}
            />
            <Button
              label={text('Exportar CSV', 'Export CSV')}
              variant="secondary"
              onPress={() => void downloadCsv()}
            />
          </View>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {(['all', 'income', 'expense', 'transfer', 'planned'] as const).map((item) => (
              <Button
                key={item}
                compact
                variant="secondary"
                selected={filter === item}
                label={
                  item === 'all'
                    ? text('Todas', 'All')
                    : item === 'income'
                      ? text('Receitas', 'Income')
                      : item === 'expense'
                        ? text('Despesas', 'Expenses')
                        : item === 'transfer'
                          ? text('Transferências', 'Transfers')
                          : text('Previstas', 'Planned')
                }
                onPress={() => setFilter(item)}
              />
            ))}
          </View>
          <Card style={{ gap: 0, padding: width < designTokens.breakpoints.tablet ? 12 : 20 }}>
            {filtered.length ? (
              filtered.map((transaction) => {
                const category = data.categories.find(
                  (item) => item.id === transaction.categoryId,
                )?.name;
                const account = data.accounts.find(
                  (item) => item.id === transaction.accountId,
                )?.name;
                const sign =
                  transaction.kind === 'income' ? '+' : transaction.kind === 'expense' ? '−' : '↔';
                const color =
                  transaction.kind === 'income'
                    ? colors.positive
                    : transaction.kind === 'expense'
                      ? colors.ink
                      : colors.accent;
                return (
                  <View
                    key={transaction.id}
                    style={{
                      minHeight: 68,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.ink, fontWeight: '700' }}>
                        {demoLabel(transaction.description, language)}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {category
                          ? demoLabel(category, language)
                          : text('Transferência', 'Transfer')}{' '}
                        · {demoLabel(account ?? '', language)} · {formatDate(transaction.date)} ·{' '}
                        {transaction.status === 'planned'
                          ? text('Prevista', 'Planned')
                          : text('Realizada', 'Posted')}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color,
                        fontWeight: '800',
                        fontVariant: ['tabular-nums'],
                        textAlign: 'right',
                      }}
                    >
                      {sign}{' '}
                      {formatCurrency(
                        BigInt(transaction.amountCents),
                        'BRL',
                        preferences.hideAmounts,
                      )}
                    </Text>
                  </View>
                );
              })
            ) : (
              <EmptyState
                symbol="⌕"
                title={text('Nenhum resultado', 'No results')}
                description={text(
                  'Altere a busca ou o filtro para ver outros registros.',
                  'Change the search or filter to see other records.',
                )}
              />
            )}
          </Card>
        </>
      ) : (
        <Card style={{ minHeight: 260, justifyContent: 'center' }}>
          <EmptyState
            symbol="↗"
            title={text('Histórico real indisponível', 'Real activity is unavailable')}
            description={text(
              'A API de movimentações e a persistência de registros ainda não estão integradas. Explore o histórico fictício sem misturar dados.',
              'The activity API and record persistence are not integrated yet. Explore fictional history without mixing data.',
            )}
          />
          <Button
            label={text('Explorar demonstração', 'Explore demo')}
            onPress={() =>
              void import('../../src/demo').then(({ demo }) => demo.getState().enterDemo())
            }
          />
        </Card>
      )}
    </Screen>
  );
}
