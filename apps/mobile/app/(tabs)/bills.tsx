import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { calculateObligationRemaining } from '@fintrack/shared';
import { Button, Card, Label, Screen } from '../../src/components/ui';
import { useDemo } from '../../src/demo';
import { demoLabel } from '../../src/demo/labels';
import { parseLocalizedCents } from '../../src/demo/input';
import { useI18n } from '../../src/i18n';
import { usePreferences } from '../../src/preferences';
import { useTheme } from '../../src/theme';

export default function Bills() {
  const { language, formatCurrency, formatDate } = useI18n();
  const { value: preferences } = usePreferences();
  const { mode, dataset, updateDataset, saving } = useDemo();
  const colors = useTheme();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const pt = language === 'pt-BR';
  const text = (a: string, b: string) => (pt ? a : b);
  const data = mode === 'demo' ? dataset : null;
  const bills =
    data?.obligations
      .map((bill) => ({
        bill,
        remaining: calculateObligationRemaining(bill, data.transactions, data.asOfDate),
      }))
      .filter(({ remaining }) => remaining > 0n)
      .sort((a, b) => a.bill.dueOn.localeCompare(b.bill.dueOn)) ?? [];

  async function pay(billId: string) {
    if (!data) return;
    setMessage('');
    try {
      const bill = data.obligations.find((item) => item.id === billId);
      if (!bill) throw new Error();
      const remaining = calculateObligationRemaining(bill, data.transactions, data.asOfDate);
      const amount = amounts[billId]?.trim()
        ? parseLocalizedCents(amounts[billId] ?? '', language)
        : remaining;
      if (amount > remaining) throw new RangeError();
      const ok = await updateDataset((current) => ({
        ...current,
        transactions: [
          ...current.transactions,
          {
            id: `demo-payment-${billId}-${Date.now()}`,
            kind: 'expense',
            amountCents: amount.toString(),
            date: current.asOfDate,
            status: 'posted',
            accountId: 'checking',
            categoryId: bill.categoryId,
            obligationId: bill.id,
            description: bill.description,
          },
        ],
      }));
      setMessage(
        ok
          ? text(
              'Pagamento registrado somente na demonstração.',
              'Payment recorded in the demo only.',
            )
          : text('Não foi possível salvar o pagamento.', 'Could not save the payment.'),
      );
      if (ok) setAmounts((current) => ({ ...current, [billId]: '' }));
    } catch {
      setMessage(
        text(
          'Informe um valor válido que não exceda o restante da obrigação.',
          'Enter a valid amount no greater than the remaining bill.',
        ),
      );
    }
  }

  return (
    <Screen
      title={text('Contas a pagar', 'Bills')}
      subtitle={text(
        'Acompanhe vencimentos e pagamentos da demonstração isolada.',
        'Track due dates and payments in the isolated demo.',
      )}
    >
      {data ? (
        <>
          <Card style={{ gap: 8, borderColor: colors.warning }}>
            <Text style={{ color: colors.warning, fontWeight: '800' }}>
              {text('DADOS FICTÍCIOS', 'FICTIONAL DATA')}
            </Text>
            <Label muted>
              {text(
                'Pagamentos alteram apenas o conjunto demonstrativo deste dispositivo; não movem dinheiro em banco.',
                'Payments only change this device’s demo dataset; no money moves at a bank.',
              )}
            </Label>
          </Card>
          {message ? (
            <Text
              accessibilityRole="alert"
              style={{
                color:
                  message.toLowerCase().includes('não') ||
                  message.toLowerCase().includes('could') ||
                  message.toLowerCase().includes('valid')
                    ? colors.danger
                    : colors.positiveText,
              }}
            >
              {message}
            </Text>
          ) : null}
          {bills.length ? (
            bills.map(({ bill, remaining }) => {
              const overdue = bill.dueOn < data.asOfDate;
              return (
                <Card key={bill.id} style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 17 }}>
                        {demoLabel(bill.description, language)}
                      </Text>
                      <Text style={{ color: overdue ? colors.danger : colors.muted }}>
                        {overdue ? text('Vencida', 'Overdue') : text('Vence', 'Due')} ·{' '}
                        {formatDate(bill.dueOn)}
                      </Text>
                    </View>
                    <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 19 }}>
                      {formatCurrency(remaining, 'BRL', preferences.hideAmounts)}
                    </Text>
                  </View>
                  <Label muted>
                    {text('Total', 'Total')}:{' '}
                    {formatCurrency(BigInt(bill.amountCents), 'BRL', preferences.hideAmounts)} ·{' '}
                    {text('Pagamento parcial permitido', 'Partial payment supported')}
                  </Label>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TextInput
                      accessibilityLabel={text('Valor a pagar', 'Payment amount')}
                      value={amounts[bill.id] ?? ''}
                      onChangeText={(value) =>
                        setAmounts((current) => ({ ...current, [bill.id]: value }))
                      }
                      keyboardType="decimal-pad"
                      placeholder={text('Valor parcial (opcional)', 'Partial amount (optional)')}
                      placeholderTextColor={colors.muted}
                      style={{
                        flex: 1,
                        minHeight: 46,
                        color: colors.ink,
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                      }}
                    />
                    <Button
                      label={text('Registrar pagamento', 'Record payment')}
                      disabled={saving}
                      compact
                      onPress={() => void pay(bill.id)}
                    />
                  </View>
                </Card>
              );
            })
          ) : (
            <Card>
              <Label>
                {text('Nenhuma obrigação pendente neste mês.', 'No outstanding bills this month.')}
              </Label>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <Label>
            {text(
              'Ative a demonstração para explorar os vencimentos fictícios.',
              'Start the demo to explore fictional bills.',
            )}
          </Label>
        </Card>
      )}
    </Screen>
  );
}
