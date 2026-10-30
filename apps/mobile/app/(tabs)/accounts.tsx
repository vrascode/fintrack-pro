import { Text, View, useWindowDimensions } from 'react-native';
import { calculateAccountBalance } from '@fintrack/shared';
import { Button, Card, EmptyState, Label, Screen } from '../../src/components/ui';
import { demo, useDemo } from '../../src/demo';
import { demoLabel } from '../../src/demo/labels';
import { useI18n } from '../../src/i18n';
import { usePreferences } from '../../src/preferences';
import { designTokens, useTheme } from '../../src/theme';

export default function Accounts() {
  const { language, formatCurrency, formatDate } = useI18n();
  const { value: preferences } = usePreferences();
  const { mode, dataset } = useDemo();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const pt = language === 'pt-BR';
  const text = (portuguese: string, english: string) => (pt ? portuguese : english);
  const hidden = preferences.hideAmounts;
  const data = mode === 'demo' ? dataset : null;
  return (
    <Screen
      title={text('Contas', 'Accounts')}
      subtitle={text(
        'Saldos calculados a partir do saldo inicial e das movimentações realizadas.',
        'Balances calculated from opening amounts and posted activity.',
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
                'Estas contas existem somente no conjunto demonstrativo local. Não representam contas bancárias reais.',
                'These accounts only exist in the local demo dataset. They are not real bank accounts.',
              )}
            </Label>
          </Card>
          <View
            style={{
              flexDirection: width < designTokens.breakpoints.tablet ? 'column' : 'row',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            {data.accounts.map((account) => {
              const balance = calculateAccountBalance(account, data.transactions, data.asOfDate);
              const label =
                account.type === 'checking'
                  ? text('Conta corrente', 'Checking')
                  : account.type === 'savings'
                    ? text('Poupança', 'Savings')
                    : account.type === 'wallet'
                      ? text('Carteira', 'Wallet')
                      : text('Dinheiro', 'Cash');
              return (
                <Card
                  key={account.id}
                  style={{
                    flex: 1,
                    minWidth: width < designTokens.breakpoints.tablet ? undefined : 260,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <View style={{ gap: 6, flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
                        {label}
                      </Text>
                      <Text
                        accessibilityRole="header"
                        style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}
                      >
                        {demoLabel(account.name, language)}
                      </Text>
                    </View>
                    <Text style={{ color: colors.accent, fontSize: 18 }}>◉</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {text('Saldo em', 'Balance on')} {formatDate(data.asOfDate)}
                  </Text>
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: 27,
                      fontWeight: '800',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {formatCurrency(balance, 'BRL', hidden)}
                  </Text>
                  <Label muted>
                    {text('Saldo inicial', 'Opening balance')}:{' '}
                    {formatCurrency(BigInt(account.openingBalanceCents), 'BRL', hidden)} ·{' '}
                    {formatDate(account.openingDate)}
                  </Label>
                </Card>
              );
            })}
          </View>
          <Card>
            <Text style={{ color: colors.ink, fontWeight: '800' }}>
              {text('Cadastro conectado à API', 'Accounts connected to the API')}
            </Text>
            <Label muted>
              {text(
                'Criação, edição e arquivamento de contas reais dependem dos endpoints financeiros e da persistência no servidor, ainda não disponíveis.',
                'Creating, editing, and archiving real accounts requires financial API endpoints and server persistence, which are not available yet.',
              )}
            </Label>
          </Card>
        </>
      ) : (
        <Card style={{ minHeight: 280, justifyContent: 'center' }}>
          <EmptyState
            symbol="◉"
            title={text('Nenhuma conta real conectada', 'No real accounts connected')}
            description={text(
              'Explore os saldos calculados com dados fictícios. O aplicativo ainda não consulta contas do servidor.',
              'Explore calculated balances with fictional data. The app does not read accounts from the server yet.',
            )}
          />
          <Button
            label={text('Explorar demonstração', 'Explore demo')}
            onPress={() => void demo.getState().enterDemo()}
          />
        </Card>
      )}
    </Screen>
  );
}
