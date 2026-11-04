import { Text, View } from 'react-native';
import { Card, EmptyState, Screen } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/auth';
import { PersonalCards } from '../../src/personal/PersonalCards';

export default function Cards() {
  const session = useAuth((state) => state.session);
  return session ? <PersonalCards /> : <CardsPending />;
}

function CardsPending() {
  const { t } = useI18n();
  const colors = useTheme();
  return (
    <Screen title={t('cards.title')} subtitle={t('cards.subtitle')}>
      <Card style={{ minHeight: 280, justifyContent: 'center' }}>
        <EmptyState symbol="▱" title={t('cards.emptyTitle')} description={t('cards.emptyBody')} />
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
