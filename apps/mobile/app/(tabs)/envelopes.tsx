import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { calculateEnvelopeBalance, calculateGoalPlan } from '@fintrack/shared';
import { Button, Card, Label, Screen } from '../../src/components/ui';
import { useDemo } from '../../src/demo';
import { demoLabel } from '../../src/demo/labels';
import { parseLocalizedCents } from '../../src/demo/input';
import { useI18n } from '../../src/i18n';
import { usePreferences } from '../../src/preferences';
import { useTheme } from '../../src/theme';

export default function Envelopes() {
  const { language, formatCurrency, formatDate } = useI18n();
  const { value: preferences } = usePreferences();
  const { mode, dataset, updateDataset, saving } = useDemo();
  const colors = useTheme();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const pt = language === 'pt-BR';
  const text = (a: string, b: string) => (pt ? a : b);
  const data = mode === 'demo' ? dataset : null;
  async function record(envelopeId: string, kind: 'contribute' | 'withdraw') {
    if (!data) return;
    setMessage('');
    try {
      const amount = parseLocalizedCents(amounts[envelopeId] ?? '', language);
      const envelope = data.envelopes.find((item) => item.id === envelopeId);
      if (!envelope) throw new Error();
      if (
        kind === 'withdraw' &&
        amount > calculateEnvelopeBalance(envelope, data.envelopeEvents, data.asOfDate)
      )
        throw new RangeError();
      const ok = await updateDataset((current) => ({
        ...current,
        envelopeEvents: [
          ...current.envelopeEvents,
          {
            id: `demo-${kind}-${envelopeId}-${Date.now()}`,
            envelopeId,
            kind,
            amountCents: amount.toString(),
            date: current.asOfDate,
          },
        ],
      }));
      setMessage(
        ok
          ? text(
              'Movimentação registrada na caixinha fictícia.',
              'Recorded in the fictional envelope.',
            )
          : text('Não foi possível salvar.', 'Could not save.'),
      );
      if (ok) setAmounts((current) => ({ ...current, [envelopeId]: '' }));
    } catch {
      setMessage(
        text(
          'Confira o valor e o saldo reservado disponível.',
          'Check the amount and the available reserved balance.',
        ),
      );
    }
  }
  return (
    <Screen
      title={text('Caixinhas e metas', 'Envelopes and goals')}
      subtitle={text(
        'Organização virtual dentro da demonstração; não movimenta uma conta bancária.',
        'Virtual planning inside the demo; it does not move money in a bank account.',
      )}
    >
      {data ? (
        <>
          <Card style={{ gap: 8, borderColor: colors.warning }}>
            <Text style={{ color: colors.warning, fontWeight: '800' }}>
              {text('DADOS FICTÍCIOS · RESERVA VIRTUAL', 'FICTIONAL DATA · VIRTUAL RESERVE')}
            </Text>
            <Label muted>
              {text(
                'A reserva reduz o valor livre no planejamento, mas não reduz patrimônio nem saldo bancário.',
                'Reserves reduce planned free money, but do not reduce net worth or bank balances.',
              )}
            </Label>
          </Card>
          {message ? (
            <Text accessibilityRole="alert" style={{ color: colors.positive }}>
              {message}
            </Text>
          ) : null}
          {data.envelopes.map((envelope) => {
            const saved = calculateEnvelopeBalance(envelope, data.envelopeEvents, data.asOfDate);
            const goal = calculateGoalPlan(
              BigInt(envelope.targetCents),
              saved,
              BigInt(envelope.plannedMonthlyCents),
            );
            const percent = Number(goal.progressBps / 100n);
            return (
              <Card key={envelope.id} style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 19 }}>
                      {demoLabel(envelope.name, language)}
                    </Text>
                    <Label muted>
                      {text('Meta', 'Target')}:{' '}
                      {formatCurrency(BigInt(envelope.targetCents), 'BRL', preferences.hideAmounts)}
                    </Label>
                  </View>
                  <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 23 }}>
                    {percent}%
                  </Text>
                </View>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel={`${percent}%`}
                  style={{
                    height: 10,
                    borderRadius: 6,
                    backgroundColor: colors.elevated,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.min(100, percent)}%`,
                      height: 10,
                      backgroundColor: colors.accent,
                    }}
                  />
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <Text style={{ color: colors.ink, fontWeight: '700' }}>
                    {formatCurrency(saved, 'BRL', preferences.hideAmounts)}{' '}
                    {text('reservados', 'reserved')}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {text('Faltam', 'Remaining')}:{' '}
                    {formatCurrency(goal.remainingCents, 'BRL', preferences.hideAmounts)}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {text('Plano mensal', 'Monthly plan')}:{' '}
                    {formatCurrency(
                      BigInt(envelope.plannedMonthlyCents),
                      'BRL',
                      preferences.hideAmounts,
                    )}
                  </Text>
                </View>
                {envelope.deadline ? (
                  <Label muted>
                    {text('Data desejada', 'Desired date')}: {formatDate(envelope.deadline)}
                  </Label>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 9, flexWrap: 'wrap' }}>
                  <TextInput
                    accessibilityLabel={text(
                      'Valor do aporte ou resgate',
                      'Contribution or withdrawal amount',
                    )}
                    value={amounts[envelope.id] ?? ''}
                    onChangeText={(value) =>
                      setAmounts((current) => ({ ...current, [envelope.id]: value }))
                    }
                    keyboardType="decimal-pad"
                    placeholder={text('Valor', 'Amount')}
                    placeholderTextColor={colors.muted}
                    style={{
                      flex: 1,
                      minWidth: 120,
                      minHeight: 44,
                      color: colors.ink,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                    }}
                  />
                  <Button
                    compact
                    label={text('Reservar', 'Contribute')}
                    disabled={saving}
                    onPress={() => void record(envelope.id, 'contribute')}
                  />
                  <Button
                    compact
                    variant="secondary"
                    label={text('Resgatar', 'Withdraw')}
                    disabled={saving}
                    onPress={() => void record(envelope.id, 'withdraw')}
                  />
                </View>
              </Card>
            );
          })}
          <Card>
            <Label muted>
              {text(
                'Aportes anteriores somam R$ 6.000 em 12 meses para a reserva de emergência, sem rendimento. Os registros do exemplo são fictícios e a meta usa despesas essenciais selecionadas.',
                'At R$ 500 monthly, emergency contributions total R$ 6,000 in 12 months, with no return assumed. Historical demo entries are fictional and the target uses selected essential expenses.',
              )}
            </Label>
          </Card>
        </>
      ) : (
        <Card>
          <Label>
            {text(
              'Ative a demonstração para explorar caixinhas fictícias.',
              'Start the demo to explore fictional envelopes.',
            )}
          </Label>
        </Card>
      )}
    </Screen>
  );
}
