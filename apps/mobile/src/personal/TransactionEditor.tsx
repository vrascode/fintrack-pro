import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { FinancialAccount, FinancialCategory, FinancialTransaction } from '@fintrack/shared';
import { apiClient, ApiClientError } from '../api/client';
import { useI18n } from '../i18n';
import { parseLocalizedCents } from '../demo/input';
import { Button, Card, Field, Label, StatusMessage } from '../components/ui';

export function TransactionEditor({
  entry,
  accounts,
  categories,
  token,
  onSaved,
  onCancel,
}: {
  entry: FinancialTransaction;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  token: string;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const { language } = useI18n();
  const text = (pt: string, en: string) => (language === 'pt-BR' ? pt : en);
  const [description, setDescription] = useState(entry.description);
  const [date, setDate] = useState(entry.date);
  const [amount, setAmount] = useState(() => {
    const cents = BigInt(entry.amountCents);
    return `${cents / 100n}${language === 'pt-BR' ? ',' : '.'}${String(cents % 100n).padStart(2, '0')}`;
  });
  const [kind, setKind] = useState(entry.kind);
  const [accountId, setAccountId] = useState(entry.accountId);
  const [destination, setDestination] = useState(entry.transferAccountId ?? '');
  const [categoryId, setCategoryId] = useState(entry.categoryId ?? '');
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  async function save(remove = false) {
    if (sending.current || !entry.revision) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      if (remove) await apiClient.removeTransaction(token, entry.id, entry.revision);
      else
        await apiClient.editTransaction(token, entry.id, entry.revision, {
          description,
          date,
          amountCents: parseLocalizedCents(amount, language).toString(),
          kind,
          accountId,
          ...(kind === 'transfer'
            ? { transferAccountId: destination }
            : categoryId
              ? { categoryId }
              : {}),
        });
      await onSaved();
    } catch (failure) {
      setError(
        failure instanceof ApiClientError && failure.status === 409
          ? text(
              'Este lançamento mudou. Feche a edição e atualize o histórico antes de tentar novamente.',
              'This entry changed. Close the editor and refresh history before retrying.',
            )
          : text(
              'Não foi possível salvar. Confira valor, data, contas ativas e conexão. Suas alterações continuam no formulário.',
              'Could not save. Check amount, date, active accounts and connection. Your changes remain in the form.',
            ),
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <Card>
      <Field
        label={text('Descrição do lançamento', 'Transaction description')}
        value={description}
        onChangeText={setDescription}
        editable={!busy}
        maxLength={160}
      />
      <Field
        label={text('Valor (R$)', 'Amount (BRL)')}
        value={amount}
        onChangeText={setAmount}
        editable={!busy}
      />
      <Field
        label={text('Data (AAAA-MM-DD)', 'Date (YYYY-MM-DD)')}
        value={date}
        onChangeText={setDate}
        editable={!busy}
      />
      <View style={{ gap: 8 }}>
        {(['income', 'expense', 'transfer'] as const).map((value) => (
          <Button
            key={value}
            variant="quiet"
            selected={kind === value}
            disabled={busy}
            label={
              value === 'income'
                ? text('Receita', 'Income')
                : value === 'expense'
                  ? text('Despesa', 'Expense')
                  : text('Transferência', 'Transfer')
            }
            onPress={() => {
              setKind(value);
              setCategoryId('');
            }}
          />
        ))}
        <Label>{text('Conta de origem', 'Source account')}</Label>
        {accounts
          .filter((account) => !account.archived)
          .map((account) => (
            <Button
              key={account.id}
              variant="quiet"
              label={account.name}
              selected={accountId === account.id}
              disabled={busy}
              onPress={() => setAccountId(account.id)}
            />
          ))}
        {kind === 'transfer' ? (
          <>
            <Label>{text('Conta de destino', 'Destination account')}</Label>
            {accounts
              .filter((account) => !account.archived && account.id !== accountId)
              .map((account) => (
                <Button
                  key={account.id}
                  variant="quiet"
                  label={account.name}
                  selected={destination === account.id}
                  disabled={busy}
                  onPress={() => setDestination(account.id)}
                />
              ))}
          </>
        ) : (
          <>
            <Label>{text('Categoria', 'Category')}</Label>
            <Button
              variant="quiet"
              label={text('Sem categoria', 'Uncategorized')}
              selected={!categoryId}
              disabled={busy}
              onPress={() => setCategoryId('')}
            />
            {categories
              .filter((category) => category.kind === kind)
              .map((category) => (
                <Button
                  key={category.id}
                  variant="quiet"
                  label={category.name}
                  selected={categoryId === category.id}
                  disabled={busy}
                  onPress={() => setCategoryId(category.id)}
                />
              ))}
          </>
        )}
      </View>
      {error ? <StatusMessage tone="error" message={error} /> : null}
      <Button
        label={text('Salvar alterações', 'Save changes')}
        disabled={busy || !entry.revision}
        onPress={() => void save()}
      />
      {removing ? (
        <>
          <Label>
            {text(
              'Excluir este lançamento recalcula os saldos das contas envolvidas. O registro será preservado para auditoria.',
              'Removing this entry recalculates the affected account balances. The record is retained for audit.',
            )}
          </Label>
          <Button
            label={text('Confirmar exclusão', 'Confirm removal')}
            disabled={busy}
            onPress={() => void save(true)}
          />
          <Button
            variant="quiet"
            label={text('Manter lançamento', 'Keep entry')}
            disabled={busy}
            onPress={() => setRemoving(false)}
          />
        </>
      ) : (
        <Button
          variant="quiet"
          label={text('Excluir lançamento', 'Remove entry')}
          disabled={busy || !entry.revision}
          onPress={() => setRemoving(true)}
        />
      )}
      <Button
        variant="quiet"
        label={text('Fechar edição', 'Close editor')}
        disabled={busy}
        onPress={onCancel}
      />
    </Card>
  );
}
