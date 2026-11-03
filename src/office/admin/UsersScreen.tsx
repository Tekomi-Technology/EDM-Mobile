import { useEffect, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { t } from '../../i18n';
import { styles as ui } from '../../ui';
import { officeApi } from '../officeApi';
import { LoadState, OfficeHeader, Row } from '../officeUi';
import { roleNames } from '../roleNames';
import { useRemote } from '../remote';
import { UserScreen } from './UserScreen';

const STATUS: Record<string, string> = { active: 'Active', blocked: 'Blocked', cancelled: 'Removed' };

/** Accounts and roles (administrators): search, then open an account to change it. */
export function UsersScreen({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const users = useRemote((token) => officeApi.users(token, { search: query || undefined }), [query]);

  const chosen = users.data?.find((u) => u.id === open);
  if (chosen) {
    return (
      <UserScreen
        user={chosen}
        onBack={() => {
          setOpen(null);
          users.reload();
        }}
      />
    );
  }

  return (
    <View style={ui.screen}>
      <OfficeHeader title={t('Accounts and roles')} onBack={onBack}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('Name or username')}
          style={[ui.input, { minHeight: 44, padding: 10 }]}
        />
      </OfficeHeader>
      <LoadState loading={users.loading} error={users.error} hasData={!!users.data} onRetry={users.reload} />
      {users.data && (
        <FlatList
          data={users.data}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <Row
              title={item.fullName}
              detail={[roleNames(item.roles), item.teamName].filter(Boolean).join(' · ')}
              right={t(STATUS[item.status] ?? item.status)}
              onPress={() => setOpen(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}
