import { router } from 'expo-router';
import { Text, View, useWindowDimensions } from 'react-native';
import { Button, Card, EmptyState, Label, Screen } from '../../src/components/ui';
import { useTheme } from '../../src/theme';

export default function Overview() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  return (
    <Screen
      title="Clareza para o seu dinheiro."
      subtitle="Um espaço para acompanhar suas escolhas e construir os próximos passos."
    >
      <View style={{ flexDirection: width >= 760 ? 'row' : 'column', gap: 20 }}>
        <View style={width >= 760 ? { flex: 1.5 } : {}}>
          <EmptyState
            symbol="◫"
            title="Sua história começa aqui"
            description="Você ainda não tem dados financeiros disponíveis. Suas contas, movimentações e objetivos vão compor esta visão geral."
          />
        </View>
        <View style={width >= 760 ? { flex: 1 } : {}}>
          <Card>
            <Text
              style={{ color: colors.accent, fontSize: 12, letterSpacing: 2, fontWeight: '700' }}
            >
              DO SEU JEITO
            </Text>
            <Text style={{ color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '600' }}>
              Pequenas escolhas. Mais clareza.
            </Text>
            <Label muted>Escolha a aparência e a privacidade dos valores neste dispositivo.</Label>
            <Button label="Personalizar meu espaço" onPress={() => router.push('/preferences')} />
          </Card>
        </View>
      </View>
      <Card>
        <Text
          accessibilityRole="header"
          style={{ color: colors.ink, fontSize: 20, fontWeight: '600' }}
        >
          Tudo no seu lugar
        </Text>
        <Label muted>
          Explore os espaços para contas, atividade e cartões. Os recursos financeiros estão em
          preparação; nenhum saldo foi consultado.
        </Label>
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          <Button label="Explorar contas" secondary onPress={() => router.push('/accounts')} />
          <Button label="Ver atividade" secondary onPress={() => router.push('/activity')} />
        </View>
      </Card>
    </Screen>
  );
}
