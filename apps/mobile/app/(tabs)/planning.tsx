import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import {
  applyFinancialScenario,
  simulateSavingsPlan,
  type FinancialScenario,
} from '@fintrack/shared';
import { Button, Card, Label, Screen } from '../../src/components/ui';
import { useDemo } from '../../src/demo';
import { parseLocalizedCents } from '../../src/demo/input';
import { useI18n } from '../../src/i18n';
import { usePreferences } from '../../src/preferences';
import { useTheme } from '../../src/theme';

const scenarioNames: Record<FinancialScenario, [string, string]> = {
  'reduce-subscriptions': ['Reduzir assinaturas em R$ 30', 'Reduce subscriptions by R$ 30'],
  'reduce-groceries': ['Reduzir mercado em R$ 100', 'Reduce groceries by R$ 100'],
  'extra-income': ['Receber R$ 300 extras', 'Add R$ 300 income'],
  'unexpected-expense': ['Imprevisto de R$ 500', 'Add a R$ 500 surprise expense'],
};

export default function Planning() {
  const { language, formatCurrency } = useI18n();
  const { value: preferences } = usePreferences();
  const { mode, dataset } = useDemo();
  const colors = useTheme();
  const [scenario, setScenario] = useState<FinancialScenario | null>(null);
  const [incomeInput, setIncomeInput] = useState('5.000,00');
  const [expenseInput, setExpenseInput] = useState('4.200,00');
  const [reserveInput, setReserveInput] = useState('500,00');
  const [goalInput, setGoalInput] = useState('200,00');
  const pt = language === 'pt-BR';
  const text = (a: string, b: string) => (pt ? a : b);
  const data = mode === 'demo' ? dataset : null;
  const result = useMemo(() => {
    try {
      const current = {
        incomeCents: parseLocalizedCents(incomeInput, language),
        expenseCents: parseLocalizedCents(expenseInput, language),
      };
      const adjusted = scenario ? applyFinancialScenario(scenario, current) : current;
      const reserve = parseLocalizedCents(reserveInput, language);
      const goal = parseLocalizedCents(goalInput, language);
      return {
        value: simulateSavingsPlan({
          incomeCents: adjusted.incomeCents,
          expensesCents: adjusted.expenseCents,
          reserveContributionCents: reserve,
          goalContributionCents: goal,
          bufferTargetCents: 10000n,
          goalRemainingCents: 600000n,
        }),
        invalid: false,
      };
    } catch {
      return { value: null, invalid: true };
    }
  }, [expenseInput, goalInput, incomeInput, language, reserveInput, scenario]);
  const simulation = result.value;
  const invalid = result.invalid;
  const input = (label: string, value: string, change: (value: string) => void) => (
    <View style={{ flex: 1, minWidth: 150, gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        keyboardType="decimal-pad"
        placeholder="0,00"
        placeholderTextColor={colors.muted}
        style={{
          minHeight: 46,
          color: colors.ink,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
        }}
      />
    </View>
  );
  return (
    <Screen
      title={text('O que posso fazer com minha sobra?', 'What can I do with my surplus?')}
      subtitle={text(
        'Teste cenários sem gravar movimentações. Os resultados são simulações, não previsões garantidas.',
        'Try scenarios without recording transactions. Results are simulations, not guaranteed forecasts.',
      )}
    >
      {data ? (
        <>
          <Card style={{ gap: 8, borderColor: colors.warning }}>
            <Text style={{ color: colors.warning, fontWeight: '800' }}>
              {text('SIMULAÇÃO SOBRE DADOS FICTÍCIOS', 'SIMULATION USING FICTIONAL DATA')}
            </Text>
            <Label muted>
              {text(
                'Os campos começam com o exemplo mensal de R$ 5.000 de receita e R$ 4.200 de despesas. Nada é salvo no histórico.',
                'Inputs start from the R$ 5,000 income and R$ 4,200 expense example. Nothing is saved to activity.',
              )}
            </Label>
          </Card>
          <Card style={{ gap: 16 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>
              {text('Ajuste os valores', 'Adjust the amounts')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {input(text('Receita mensal', 'Monthly income'), incomeInput, setIncomeInput)}
              {input(text('Despesas mensais', 'Monthly expenses'), expenseInput, setExpenseInput)}
              {input(
                text('Reserva de emergência', 'Emergency reserve'),
                reserveInput,
                setReserveInput,
              )}
              {input(
                text('Aporte em meta pessoal', 'Personal goal contribution'),
                goalInput,
                setGoalInput,
              )}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(scenarioNames) as FinancialScenario[]).map((key) => (
                <Button
                  key={key}
                  compact
                  selected={scenario === key}
                  variant="secondary"
                  label={text(scenarioNames[key][0], scenarioNames[key][1])}
                  onPress={() => setScenario((current) => (current === key ? null : key))}
                />
              ))}
            </View>
            <Label muted>
              {scenario
                ? text(
                    `Cenário ativo: ${scenarioNames[scenario][0]}.`,
                    `Active scenario: ${scenarioNames[scenario][1]}.`,
                  )
                : text(
                    'Selecione um cenário para aplicar uma alteração temporária.',
                    'Choose a scenario to apply a temporary change.',
                  )}
            </Label>
            {invalid ? (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {text(
                  'Use valores positivos com até duas casas decimais.',
                  'Enter positive values with up to two decimal places.',
                )}
              </Text>
            ) : null}
          </Card>
          {simulation ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[
                [
                  text('Sobra mensal simulada', 'Simulated monthly surplus'),
                  simulation.monthlySurplusCents,
                ],
                [
                  text('Total destinado às metas', 'Total assigned to goals'),
                  simulation.goalContributionsCents,
                ],
                [
                  text('Livre após aportes', 'Free after contributions'),
                  simulation.freeAfterGoalsCents,
                ],
              ].map(([label, amount]) => (
                <Card key={String(label)} style={{ flex: 1, minWidth: 190 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
                  <Text
                    style={{
                      color: typeof amount === 'bigint' && amount < 0n ? colors.danger : colors.ink,
                      fontSize: 23,
                      fontWeight: '800',
                    }}
                  >
                    {formatCurrency(amount as bigint, 'BRL', preferences.hideAmounts)}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
          <Card>
            <Label muted>
              {text(
                `Com aportes mensais de R$ 700, a meta de R$ 6.000 leva cerca de ${simulation?.estimatedMonths ?? '—'} meses, sem rendimento. A simulação não modela juros, impostos ou taxas.`,
                `At R$ 700 monthly, the R$ 6,000 goal takes about ${simulation?.estimatedMonths ?? '—'} months, excluding returns. This simulation does not model interest, taxes, or fees.`,
              )}
            </Label>
          </Card>
        </>
      ) : (
        <Card>
          <Label>
            {text(
              'Ative a demonstração para testar o simulador.',
              'Start the demo to use the simulator.',
            )}
          </Label>
        </Card>
      )}
    </Screen>
  );
}
