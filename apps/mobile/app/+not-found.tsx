import { router } from 'expo-router';
import { Button, EmptyState, Screen } from '../src/components/ui';
export default function NotFound() {
  return (
    <Screen title="Página não encontrada" subtitle="Este endereço não faz parte do seu espaço.">
      <EmptyState
        symbol="?"
        title="Vamos voltar ao início"
        description="A visão geral reúne os espaços disponíveis."
      />
      <Button label="Voltar para visão geral" onPress={() => router.replace('/')} />
    </Screen>
  );
}
