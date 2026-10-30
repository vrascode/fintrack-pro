import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Card, Label, Screen } from '../../src/components/ui';
import { useDemo } from '../../src/demo';
import { demoLabel } from '../../src/demo/labels';
import { parseLocalizedCents } from '../../src/demo/input';
import { useI18n } from '../../src/i18n';
import { useTheme } from '../../src/theme';

type Kind = 'income' | 'expense' | 'transfer';

export default function TransactionForm() {
  const { language } = useI18n();
  const { mode, dataset, updateDataset, saving } = useDemo();
  const colors = useTheme();
  const pt = language === 'pt-BR';
  const text = (a: string, b: string) => (pt ? a : b);
  const [kind, setKind] = useState<Kind>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(dataset?.asOfDate ?? '');
  const [categoryId, setCategoryId] = useState('rent');
  const [accountId, setAccountId] = useState('checking');
  const [targetAccountId, setTargetAccountId] = useState('savings');
  const [message, setMessage] = useState('');
  const data = mode === 'demo' ? dataset : null;

  async function save() {
    if (!data) return;
    setMessage('');
    try {
      const cents = parseLocalizedCents(amount, language);
      const cleanDescription = description.trim();
      if (cleanDescription.length < 1 || cleanDescription.length > 160) throw new RangeError();
      const category =
        kind === 'transfer'
          ? undefined
          : data.categories.find((item) => item.id === categoryId && item.kind === kind);
      if (kind !== 'transfer' && !category) throw new RangeError();
      if (kind === 'transfer' && (!targetAccountId || targetAccountId === accountId))
        throw new RangeError();
      const status = date <= data.asOfDate ? 'posted' : 'planned';
      const ok = await updateDataset((current) => ({
        ...current,
        transactions: [
          ...current.transactions,
          {
            id: `demo-entry-${Date.now()}`,
            kind,
            amountCents: cents.toString(),
            date,
            status,
            accountId,
            ...(kind === 'transfer' ? { transferAccountId: targetAccountId } : { categoryId }),
            description: cleanDescription,
          },
        ],
      }));
      setMessage(
        ok
          ? text(
              'Registro adicionado à demonstração fictícia.',
              'Entry added to the fictional demo.',
            )
          : text('Não foi possível salvar este registro.', 'Could not save this entry.'),
      );
      if (ok) {
        setDescription('');
        setAmount('');
      }
    } catch {
      setMessage(
        text(
          'Confira descrição, valor, data, categoria e contas selecionadas.',
          'Check the description, amount, date, category, and selected accounts.',
        ),
      );
    }
  }

  return (
    <Screen
      title={text('Novo registro', 'New entry')}
      subtitle={text(
        'Adicione um lançamento ao conjunto de demonstração. Valores futuros ficam previstos.',
        'Add an entry to the demo dataset. Future dates remain planned.',
      )}
    >
      {data ? (
        <>
          <Card style={{ gap: 8, borderColor: colors.warning }}>
            <Text style={{ color: colors.warning, fontWeight: '800' }}>
              {text('DADOS FICTÍCIOS · ARMAZENAMENTO ISOLADO', 'FICTIONAL DATA · ISOLATED STORAGE')}
            </Text>
            <Label muted>
              {text(
                'Esta operação não grava no servidor nem altera uma conta bancária.',
                'This action does not write to the server or change a bank account.',
              )}
            </Label>
          </Card>
          <Card style={{ gap: 16 }}>
            <View
              accessibilityRole="radiogroup"
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
            >
              {(['expense', 'income', 'transfer'] as const).map((item) => (
                <Button
                  key={item}
                  compact
                  selected={kind === item}
                  variant="secondary"
                  label={
                    item === 'expense'
                      ? text('Despesa', 'Expense')
                      : item === 'income'
                        ? text('Receita', 'Income')
                        : text('Transferência', 'Transfer')
                  }
                  onPress={() => {
                    setKind(item);
                    const firstCategory = data.categories.find(
                      (category) => category.kind === item,
                    );
                    if (firstCategory) setCategoryId(firstCategory.id);
                  }}
                />
              ))}
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.ink, fontWeight: '700' }}>
                {text('Descrição', 'Description')}
              </Text>
              <TextInput
                accessibilityLabel={text('Descrição', 'Description')}
                value={description}
                maxLength={160}
                onChangeText={setDescription}
                placeholder={text('Ex.: compra do mercado', 'E.g. groceries')}
                placeholderTextColor={colors.muted}
                style={{
                  minHeight: 48,
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                }}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.ink, fontWeight: '700' }}>
                {text('Valor', 'Amount')}
              </Text>
              <TextInput
                accessibilityLabel={text('Valor', 'Amount')}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={colors.muted}
                style={{
                  minHeight: 48,
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                }}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.ink, fontWeight: '700' }}>
                {text('Data (AAAA-MM-DD)', 'Date (YYYY-MM-DD)')}
              </Text>
              <TextInput
                accessibilityLabel={text('Data', 'Date')}
                value={date}
                onChangeText={setDate}
                placeholder="2026-10-20"
                placeholderTextColor={colors.muted}
                style={{
                  minHeight: 48,
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                }}
              />
            </View>
            {kind !== 'transfer' ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.ink, fontWeight: '700' }}>
                  {text('Categoria', 'Category')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {data.categories
                    .filter((item) => item.kind === kind)
                    .map((category) => (
                      <Button
                        key={category.id}
                        compact
                        selected={categoryId === category.id}
                        variant="secondary"
                        label={demoLabel(category.name, language)}
                        onPress={() => setCategoryId(category.id)}
                      />
                    ))}
                </View>
              </View>
            ) : null}
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.ink, fontWeight: '700' }}>
                {text('Conta de origem', 'Source account')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {data.accounts.map((account) => (
                  <Button
                    key={account.id}
                    compact
                    selected={accountId === account.id}
                    variant="secondary"
                    label={demoLabel(account.name, language)}
                    onPress={() => setAccountId(account.id)}
                  />
                ))}
              </View>
            </View>
            {kind === 'transfer' ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.ink, fontWeight: '700' }}>
                  {text('Conta de destino', 'Destination account')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {data.accounts.map((account) => (
                    <Button
                      key={account.id}
                      compact
                      selected={targetAccountId === account.id}
                      variant="secondary"
                      label={demoLabel(account.name, language)}
                      disabled={account.id === accountId}
                      onPress={() => setTargetAccountId(account.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {message ? (
              <Text
                accessibilityRole="alert"
                style={{
                  color:
                    message.includes(text('Não foi possível', 'Could not')) ||
                    message.includes(text('Confira', 'Check'))
                      ? colors.danger
                      : colors.positive,
                }}
              >
                {message}
              </Text>
            ) : null}
            <Button
              label={text('Salvar na demonstração', 'Save in demo')}
              disabled={saving}
              onPress={() => void save()}
            />
          </Card>
        </>
      ) : (
        <Card>
          <Label>
            {text(
              'Ative a demonstração para adicionar registros fictícios.',
              'Start the demo to add fictional entries.',
            )}
          </Label>
        </Card>
      )}
    </Screen>
  );
}
