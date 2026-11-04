import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import {
  dateInTimeZone,
  goalContributionInputSchema,
  savingsGoalInputSchema,
  type SavingsGoal,
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

function decimal(cents: string, separator: string): string {
  const amount = BigInt(cents);
  return `${amount / 100n}${separator}${String(amount % 100n).padStart(2, '0')}`;
}

export function GoalsScreen() {
  const token = useAuth((state) => state.session?.accessToken);
  const { language, formatCurrency } = useI18n();
  const hidden = usePreferences().value.hideAmounts;
  const colors = useTheme();
  const compact = useWindowDimensions().width < 700;
  const text = (pt: string, en: string) => (language === 'pt-BR' ? pt : en);
  const money = (cents: bigint) => formatCurrency(cents, 'BRL', hidden);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contributingId, setContributingId] = useState<string | null>(null);
  const [contribution, setContribution] = useState('');
  const [contributionDate, setContributionDate] = useState(() => dateInTimeZone(new Date()));
  const [contributionNote, setContributionNote] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const sending = useRef(false);
  const contributionRetry = useRef<{ fingerprint: string; key: string } | null>(null);
  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const rows = await apiClient.goals(token);
      if (sequence === request.current) setGoals(rows);
    } catch {
      if (sequence === request.current) setError(true);
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [token]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        request.current++;
      };
    }, [refresh]),
  );

  async function mutate(operation: () => Promise<unknown>, success: string, reset?: () => void) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage('');
    try {
      await operation();
      reset?.();
      setFailed(false);
      setMessage(success);
      await refresh();
    } catch {
      setFailed(true);
      setMessage(
        text(
          'Não foi possível salvar. Confira os dados e a conexão; o formulário foi preservado.',
          'Could not save. Check the values and connection; your input was preserved.',
        ),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  function edit(goal: SavingsGoal) {
    setEditingId(goal.id);
    setName(goal.name);
    setTarget(decimal(goal.targetCents, language === 'pt-BR' ? ',' : '.'));
    setDeadline(goal.targetOn ?? '');
    setMessage('');
  }
  function clearForm() {
    setEditingId(null);
    setName('');
    setTarget('');
    setDeadline('');
  }
  function save() {
    if (!token) return;
    void mutate(
      async () => {
        const input = savingsGoalInputSchema.parse({
          name,
          targetCents: parseLocalizedCents(target, language).toString(),
          targetOn: deadline.trim() || null,
        });
        if (editingId) await apiClient.updateGoal(token, editingId, input);
        else await apiClient.createGoal(token, input);
      },
      text('Meta salva.', 'Goal saved.'),
      clearForm,
    );
  }
  function contribute(goalId: string) {
    if (!token) return;
    void mutate(
      async () => {
        const input = goalContributionInputSchema.parse({
          amountCents: parseLocalizedCents(contribution, language).toString(),
          contributedOn: contributionDate,
          note: contributionNote.trim() || null,
        });
        const fingerprint = `${goalId}:${JSON.stringify(input)}`;
        if (contributionRetry.current?.fingerprint !== fingerprint)
          contributionRetry.current = {
            fingerprint,
            key: `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          };
        await apiClient.addGoalContribution(token, goalId, contributionRetry.current.key, input);
      },
      text(
        'Valor registrado na meta; saldo das contas inalterado.',
        'Amount recorded in goal; account balances unchanged.',
      ),
      () => {
        setContributingId(null);
        setContribution('');
        setContributionNote('');
        contributionRetry.current = null;
      },
    );
  }
  return (
    <Screen
      title={text('Metas', 'Goals')}
      subtitle={text(
        'Planeje objetivos pessoais. Valores registrados aqui são informativos e não reservam dinheiro nas contas.',
        'Plan personal goals. Amounts recorded here are informational and do not reserve account money.',
      )}
    >
      {!token ? (
        <Card>
          <Label>
            {text('Entre na sua conta para acompanhar metas.', 'Sign in to track goals.')}
          </Label>
          <Button
            label={text('Ir para login', 'Go to sign in')}
            onPress={() => router.push('/login')}
          />
        </Card>
      ) : loading ? (
        <Loading />
      ) : error ? (
        <ErrorState
          message={text('Não foi possível carregar metas.', 'Could not load goals.')}
          retry={() => void refresh()}
        />
      ) : (
        <>
          {message ? <StatusMessage tone={failed ? 'error' : 'success'} message={message} /> : null}
          {goals.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              {goals.map((goal) => {
                const current = BigInt(goal.contributedCents);
                const targetCents = BigInt(goal.targetCents);
                const percent = (current * 100n) / targetCents;
                const percentLabel = percent > 999n ? '999+' : percent.toString();
                return (
                  <Card
                    key={goal.id}
                    style={{
                      width: compact ? '100%' : '48%',
                      minWidth: compact ? undefined : 280,
                      flexGrow: 1,
                    }}
                  >
                    <SectionHeading
                      title={goal.name}
                      detail={
                        goal.status === 'active'
                          ? text('Em andamento', 'In progress')
                          : text('Encerrada', 'Closed')
                      }
                    />
                    <Label>
                      {money(current)} / {money(targetCents)} · {percentLabel}%
                    </Label>
                    <View
                      style={{
                        height: 10,
                        borderRadius: 5,
                        overflow: 'hidden',
                        backgroundColor: colors.elevated,
                      }}
                      accessibilityLabel={`${goal.name}: ${percentLabel}%`}
                    >
                      <View
                        style={{
                          height: 10,
                          width: `${Number(percent > 100n ? 100n : percent)}%`,
                          backgroundColor: colors.accent,
                        }}
                      />
                    </View>
                    <Label muted>
                      {goal.targetOn
                        ? `${text('Prazo', 'Target date')}: ${goal.targetOn}`
                        : text('Sem prazo definido', 'No target date')}
                    </Label>
                    <Label muted>
                      {text(
                        'Registro informativo; não altera o saldo.',
                        'Informational record; does not affect balance.',
                      )}
                    </Label>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Button
                        compact
                        variant="secondary"
                        label={text('Editar', 'Edit')}
                        disabled={busy}
                        onPress={() => edit(goal)}
                      />
                      {goal.status === 'active' ? (
                        <>
                          <Button
                            compact
                            variant="secondary"
                            label={text('Registrar valor', 'Record amount')}
                            disabled={busy}
                            onPress={() => setContributingId(goal.id)}
                          />
                          <Button
                            compact
                            variant="quiet"
                            label={text('Encerrar', 'Close')}
                            disabled={busy}
                            onPress={() =>
                              token &&
                              void mutate(
                                () => apiClient.updateGoal(token, goal.id, { status: 'closed' }),
                                text('Meta encerrada.', 'Goal closed.'),
                              )
                            }
                          />
                        </>
                      ) : (
                        <Button
                          compact
                          variant="quiet"
                          label={text('Reabrir', 'Reopen')}
                          disabled={busy}
                          onPress={() =>
                            token &&
                            void mutate(
                              () => apiClient.updateGoal(token, goal.id, { status: 'active' }),
                              text('Meta reaberta.', 'Goal reopened.'),
                            )
                          }
                        />
                      )}
                      <Button
                        compact
                        variant="quiet"
                        label={text('Excluir', 'Delete')}
                        disabled={busy}
                        onPress={() => setConfirm(goal.id)}
                      />
                    </View>
                    {confirm === goal.id ? (
                      <View style={{ gap: 8 }}>
                        <Label>
                          {text(
                            'Excluir esta meta e seus registros?',
                            'Delete this goal and its records?',
                          )}
                        </Label>
                        <Button
                          compact
                          label={text('Confirmar exclusão', 'Confirm deletion')}
                          disabled={busy}
                          onPress={() =>
                            token &&
                            void mutate(
                              () => apiClient.removeGoal(token, goal.id),
                              text('Meta excluída.', 'Goal deleted.'),
                              () => setConfirm(null),
                            )
                          }
                        />
                        <Button
                          compact
                          variant="quiet"
                          label={text('Cancelar', 'Cancel')}
                          onPress={() => setConfirm(null)}
                        />
                      </View>
                    ) : null}
                    {contributingId === goal.id ? (
                      <View style={{ gap: 8 }}>
                        <Field
                          label={text('Valor destinado (R$)', 'Amount toward goal (BRL)')}
                          value={contribution}
                          onChangeText={setContribution}
                          keyboardType="decimal-pad"
                          editable={!busy}
                        />
                        <Field
                          label={text('Data (AAAA-MM-DD)', 'Date (YYYY-MM-DD)')}
                          value={contributionDate}
                          onChangeText={setContributionDate}
                          editable={!busy}
                        />
                        <Field
                          label={text('Observação opcional', 'Optional note')}
                          value={contributionNote}
                          onChangeText={setContributionNote}
                          maxLength={160}
                          editable={!busy}
                        />
                        <Button
                          label={text('Salvar registro', 'Save record')}
                          disabled={busy || !contribution.trim()}
                          onPress={() => contribute(goal.id)}
                        />
                        <Button
                          variant="quiet"
                          label={text('Cancelar', 'Cancel')}
                          onPress={() => setContributingId(null)}
                        />
                      </View>
                    ) : null}
                    {goal.contributions.length ? (
                      <View style={{ gap: 8 }}>
                        <Label style={{ fontWeight: '700' }}>{text('Registros', 'Records')}</Label>
                        {goal.contributions.map((entry) => (
                          <View
                            key={entry.id}
                            style={{
                              flexDirection: 'row',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <Label style={{ flexGrow: 1 }}>
                              {entry.contributedOn} · {money(BigInt(entry.amountCents))}
                              {entry.note ? ` · ${entry.note}` : ''}
                            </Label>
                            <Button
                              compact
                              variant="quiet"
                              label={text('Remover', 'Remove')}
                              disabled={busy}
                              onPress={() => setConfirm(entry.id)}
                            />
                            {confirm === entry.id ? (
                              <>
                                <Button
                                  compact
                                  label={text('Confirmar', 'Confirm')}
                                  disabled={busy}
                                  onPress={() =>
                                    token &&
                                    void mutate(
                                      () =>
                                        apiClient.removeGoalContribution(token, goal.id, entry.id),
                                      text('Registro removido.', 'Record removed.'),
                                      () => setConfirm(null),
                                    )
                                  }
                                />
                                <Button
                                  compact
                                  variant="quiet"
                                  label={text('Cancelar', 'Cancel')}
                                  onPress={() => setConfirm(null)}
                                />
                              </>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          ) : (
            <Card>
              <SectionHeading
                title={text('Nenhuma meta ainda', 'No goals yet')}
                detail={text(
                  'Crie sua primeira meta para acompanhar o progresso.',
                  'Create your first goal to track progress.',
                )}
              />
            </Card>
          )}
          <Card>
            <SectionHeading
              title={editingId ? text('Editar meta', 'Edit goal') : text('Nova meta', 'New goal')}
            />
            <Field
              label={text('Nome da meta', 'Goal name')}
              value={name}
              onChangeText={setName}
              maxLength={100}
              editable={!busy}
            />
            <Field
              label={text('Valor desejado (R$)', 'Target amount (BRL)')}
              value={target}
              onChangeText={setTarget}
              keyboardType="decimal-pad"
              editable={!busy}
            />
            <Field
              label={text('Prazo opcional (AAAA-MM-DD)', 'Optional deadline (YYYY-MM-DD)')}
              value={deadline}
              onChangeText={setDeadline}
              editable={!busy}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button
                label={busy ? text('Salvando…', 'Saving…') : text('Salvar meta', 'Save goal')}
                disabled={busy || !name.trim() || !target.trim()}
                onPress={save}
              />
              {editingId ? (
                <Button
                  variant="quiet"
                  label={text('Cancelar edição', 'Cancel edit')}
                  onPress={clearForm}
                />
              ) : null}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}
