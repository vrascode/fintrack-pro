import { EmptyState, Screen } from '../../src/components/ui';
export default function Accounts() {
  return (
    <Screen title="Suas contas" subtitle="Uma visão organizada dos lugares onde seu dinheiro está.">
      <EmptyState
        symbol="▤"
        title="Nenhuma conta disponível"
        description="O cadastro de contas está em preparação. Ainda não há saldos para exibir e nenhuma conexão bancária foi realizada."
      />
    </Screen>
  );
}
