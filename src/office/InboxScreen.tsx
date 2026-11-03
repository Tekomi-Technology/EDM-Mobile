import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { colors } from '../config';
import { t } from '../i18n';
import type { InboxItem } from '../types';
import { ago, styles as ui } from '../ui';
import { openTarget } from './inbox';
import type { OfficeNav } from './OfficeApp';
import { officeApi } from './officeApi';
import { LoadState, OfficeHeader } from './officeUi';
import { useRemote } from './remote';

/** The bell of the website: newest first, unread in bold; tapping one marks it read and opens it. */
export function InboxScreen({ nav, onOpenHome }: { nav: OfficeNav; onOpenHome: () => void }) {
  const { accessToken } = useAuth();
  const inbox = useRemote((token) => officeApi.inbox(token), []);

  async function open(item: InboxItem) {
    try {
      if (!item.read) await officeApi.inboxRead(await accessToken(), { ids: [item.id] });
    } catch {
      // Marking as read can wait.
    }
    nav.refreshUnread();
    const target = openTarget(item.link);
    if (target?.kind === 'ticket') nav.openTicket(target.id);
    else if (target?.kind === 'help') onOpenHome();
    else inbox.reload();
  }

  return (
    <View style={ui.screen}>
      <OfficeHeader
        title={t('Notifications')}
        subtitle={inbox.data ? t('{0} unread', { 0: inbox.data.unread }) : null}
      />
      <LoadState loading={inbox.loading} error={inbox.error} hasData={!!inbox.data} onRetry={inbox.reload} />
      {inbox.data && (
        <FlatList
          data={inbox.data.items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={inbox.loading} onRefresh={inbox.reload} />}
          ListEmptyComponent={
            <Text style={[ui.label, { textAlign: 'center', marginTop: 32 }]}>{t('No notifications.')}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => void open(item)}
              style={{
                backgroundColor: item.read ? colors.surface : colors.brandSoft,
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
                padding: 16,
                gap: 4
              }}
            >
              <Text style={[ui.body, { fontWeight: item.read ? '400' : '700' }]}>{item.title}</Text>
              <Text style={ui.label}>{ago(item.createdAt)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
