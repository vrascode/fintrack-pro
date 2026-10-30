import { Text, View } from 'react-native';
import { Card, EmptyState, Screen } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useTheme } from '../../src/theme';

export default function Activity() {
  const { t } = useI18n();
  const colors = useTheme();
  return (
    <Screen title={t('activity.title')} subtitle={t('activity.subtitle')}>
      <Card style={{ minHeight: 260, justifyContent: 'center' }}>
        <EmptyState
          symbol="↗"
          title={t('activity.emptyTitle')}
          description={t('activity.emptyBody')}
        />
        <View
          accessibilityRole="text"
          style={{
            backgroundColor: colors.elevated,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
            {t('nav.inDevelopment')}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}
