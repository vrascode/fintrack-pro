import { EmptyState, Screen } from '../../src/components/ui';
export default function Activity() {
  return (
    <Screen title="Atividade" subtitle="Cada movimento conta uma parte da sua história.">
      <EmptyState
        symbol="↗"
        title="Sem movimentações disponíveis"
        description="Receitas, despesas e transferências aparecerão aqui quando o registro financeiro estiver disponível."
      />
    </Screen>
  );
}
