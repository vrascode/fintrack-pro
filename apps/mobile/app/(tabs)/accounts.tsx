import { Text, View } from 'react-native';
import { Card, EmptyState, Screen } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useTheme } from '../../src/theme';

export default function Accounts() {
  const { t } = useI18n();
  const colors = useTheme();
  return (
    <Screen title={t('accounts.title')} subtitle={t('accounts.subtitle')}>
      <Card style={{ minHeight: 280, justifyContent: 'center' }}>
        <EmptyState
          symbol="◫"
          title={t('accounts.emptyTitle')}
          description={t('accounts.emptyBody')}
        />
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.elevated,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
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
