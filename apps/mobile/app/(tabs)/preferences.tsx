import { Switch, Text, View } from 'react-native';
import { Button, Card, ErrorState, Label, Screen } from '../../src/components/ui';
import { usePreferences } from '../../src/preferences';
import { useTheme } from '../../src/theme';

export default function Preferences() {
  const { value, update, error, saving } = usePreferences();
  const colors = useTheme();
  return (
    <Screen title="Do seu jeito" subtitle="Preferências salvas apenas neste dispositivo.">
      {error ? (
        <ErrorState message="Não foi possível salvar. Sua última preferência salva foi mantida; tente alterar novamente." />
      ) : null}
      <Card>
        <Text
          accessibilityRole="header"
          style={{ color: colors.ink, fontSize: 22, fontWeight: '600' }}
        >
          Aparência
        </Text>
        <Label muted>Escolha um tema ou acompanhe a configuração do dispositivo.</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {(
            [
              { theme: 'system', label: 'Automático' },
              { theme: 'light', label: 'Claro' },
              { theme: 'dark', label: 'Escuro' },
            ] as const
          ).map(({ theme, label }) => (
            <Button
              key={theme}
              label={label}
              selected={value.theme === theme}
              secondary={value.theme !== theme}
              disabled={saving}
              onPress={() => {
                void update({ theme });
              }}
            />
          ))}
        </View>
      </Card>
      <Card>
        <Text
          accessibilityRole="header"
          style={{ color: colors.ink, fontSize: 22, fontWeight: '600' }}
        >
          Privacidade na tela
        </Text>
        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Label>Ocultar valores por padrão</Label>
            <Label muted>Preferência para quando houver valores financeiros disponíveis.</Label>
          </View>
          <Switch
            accessibilityLabel="Ocultar valores por padrão"
            value={value.hideAmounts}
            disabled={saving}
            onValueChange={(hideAmounts) => {
              void update({ hideAmounts });
            }}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>
      </Card>
      <Card>
        <Label>Português (Brasil) · Real brasileiro</Label>
        <Label muted>
          Esta versão oferece navegação e personalização local. Conta de acesso e registros
          financeiros ainda não estão disponíveis.
        </Label>
      </Card>
    </Screen>
  );
}
