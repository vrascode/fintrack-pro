import { EmptyState, Screen } from '../../src/components/ui';
export default function Cards() {
  return (
    <Screen title="Seus cartões" subtitle="Mais clareza sobre compras, parcelas e faturas.">
      <EmptyState
        symbol="▱"
        title="Nenhum cartão disponível"
        description="O acompanhamento de cartões está em preparação. Faturas e limites serão apresentados quando houver dados registrados."
      />
    </Screen>
  );
}
