import { Switch, Text, View, useWindowDimensions } from 'react-native';
import { Button, Card, ErrorState, Label, Screen, SectionHeading } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { usePreferences } from '../../src/preferences';
import { designTokens } from '../../src/theme';
import { useTheme } from '../../src/theme';

export default function Preferences() {
  const { value, update, error, saving } = usePreferences();
  const { t } = useI18n();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < designTokens.breakpoints.tablet;

  return (
    <Screen title={t('settings.title')} subtitle={t('settings.subtitle')}>
      {error ? <ErrorState message={t('settings.saveError')} /> : null}
      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 18, alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }}>
          <SectionHeading title={t('settings.appearance')} detail={t('settings.appearanceHelp')} />
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
          >
            {(['system', 'light', 'dark'] as const).map((theme) => (
              <Button
                key={theme}
                label={t(`theme.${theme}`)}
                selected={value.theme === theme}
                variant="secondary"
                disabled={saving}
                onPress={() => void update({ theme })}
              />
            ))}
          </View>
        </Card>

        <Card style={{ flex: 1 }}>
          <SectionHeading title={t('settings.language')} detail={t('settings.languageHelp')} />
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
          >
            {(
              [
                ['pt-BR', t('settings.portuguese')],
                ['en', t('settings.english')],
              ] as const
            ).map(([language, label]) => (
              <Button
                key={language}
                label={label}
                selected={value.language === language}
                variant="secondary"
                disabled={saving}
                onPress={() => void update({ language })}
              />
            ))}
          </View>
        </Card>
      </View>

      <Card>
        <SectionHeading title={t('settings.privacy')} detail={t('settings.hideAmountsHelp')} />
        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Label>{t('settings.hideAmounts')}</Label>
          </View>
          <Switch
            accessibilityLabel={t('settings.hideAmounts')}
            value={value.hideAmounts}
            disabled={saving}
            onValueChange={(hideAmounts) => void update({ hideAmounts })}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.surface}
          />
        </View>
      </Card>

      <Card>
        <SectionHeading title={t('settings.accountStatus')} />
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
          {t('settings.accountHelp')}
        </Text>
      </Card>
    </Screen>
  );
}
