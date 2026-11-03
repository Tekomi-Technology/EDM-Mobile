import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../auth';
import { colors } from '../../config';
import { t } from '../../i18n';
import type { AdminUser } from '../../types';
import { Button, Card, ErrorText, styles as ui } from '../../ui';
import { officeApi } from '../officeApi';
import { OfficeHeader } from '../officeUi';
import { ROLE_NAMES, roleNames } from '../roleNames';
import { describeError, useRemote } from '../remote';
import { rolesProblem } from './userRules';

/** One account (administrators): change roles and team, block or unblock, reset the password. */
export function UserScreen({ user, onBack }: { user: AdminUser; onBack: () => void }) {
  const { accessToken } = useAuth();
  const [u, setU] = useState(user);
  const [roles, setRoles] = useState<string[]>(
    user.roles.filter((r) => ROLE_NAMES.some((x) => x.role === r))
  );
  const [teamId, setTeamId] = useState<string | null>(user.teamId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const lookups = useRemote((token) => officeApi.lookups(token), []);
  const problem = rolesProblem(roles, teamId);
  const changed = roles.join() !== user.roles.join() || teamId !== user.teamId;

  async function run(what: string, fn: (token: string) => Promise<void>) {
    setBusy(what);
    setError(null);
    try {
      await fn(await accessToken());
    } catch (e) {
      setError(describeError(e).error);
    } finally {
      setBusy(null);
    }
  }
  const toggle = (role: string) =>
    setRoles((rs) => (rs.includes(role) ? rs.filter((r) => r !== role) : [...rs, role]));

  return (
    <View style={ui.screen}>
      <OfficeHeader title={u.fullName} subtitle={`${u.username} · ${roleNames(u.roles)}`} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card>
          <Text style={ui.cardTitle}>{t('Roles')}</Text>
          {roles.length === 0 && <Text style={ui.label}>{t('No role yet: choose one and save.')}</Text>}
          {ROLE_NAMES.map((r) => {
            const on = roles.includes(r.role);
            return (
              <Pressable
                key={r.role}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(r.role)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: on ? colors.brand : '#D5D8DE',
                    backgroundColor: on ? colors.brand : colors.surface
                  }}
                />
                <Text style={ui.body}>{t(r.name)}</Text>
              </Pressable>
            );
          })}
          <Text style={[ui.label, { marginTop: 8 }]}>{t('Team')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[{ id: null as string | null, name: t('No team') }, ...(lookups.data?.teams ?? [])].map((x) => (
              <Pressable
                key={x.id ?? 'none'}
                accessibilityRole="radio"
                accessibilityState={{ selected: teamId === x.id }}
                onPress={() => setTeamId(x.id)}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: teamId === x.id ? colors.brand : colors.border,
                  backgroundColor: teamId === x.id ? colors.brand : colors.surface,
                  paddingHorizontal: 12,
                  paddingVertical: 6
                }}
              >
                <Text style={{ color: teamId === x.id ? colors.brandInk : colors.text }}>{x.name}</Text>
              </Pressable>
            ))}
          </View>
          {problem && <Text style={ui.label}>{problem}</Text>}
          <Button
            label={t('Save changes')}
            busy={busy === 'save'}
            disabled={!!problem || !changed}
            onPress={() =>
              void run('save', async (token) => {
                setU(await officeApi.patchUser(token, u.id, { roles, teamId }));
              })
            }
          />
        </Card>
        <Card>
          <Text style={ui.cardTitle}>{t('Sign-in')}</Text>
          {password && (
            <View style={{ gap: 4 }}>
              <Text style={ui.label}>{t('Temporary password')}</Text>
              <Text selectable style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
                {password}
              </Text>
              <Text style={ui.label}>
                {t('Give it to the person directly. They sign in and choose a new password the first time.')}
              </Text>
            </View>
          )}
          <Button
            label={t('Reset password')}
            kind="soft"
            icon="key"
            busy={busy === 'reset'}
            onPress={() =>
              Alert.alert(
                t('Reset password'),
                t('{0} gets a temporary password and must choose a new one.', { 0: u.fullName }),
                [
                  { text: t('Not now'), style: 'cancel' },
                  {
                    text: t('Reset password'),
                    onPress: () =>
                      void run('reset', async (token) => {
                        setPassword((await officeApi.resetPassword(token, u.id)).temporaryPassword);
                      })
                  }
                ]
              )
            }
          />
          {u.status === 'active' ? (
            <Button
              label={t('Block')}
              kind="secondary"
              icon="lock"
              busy={busy === 'block'}
              onPress={() =>
                void run('block', async (token) => {
                  setU(await officeApi.block(token, u.id));
                })
              }
            />
          ) : u.status === 'blocked' ? (
            <Button
              label={t('Unblock')}
              kind="secondary"
              icon="unlock"
              busy={busy === 'unblock'}
              onPress={() =>
                void run('unblock', async (token) => {
                  setU(await officeApi.unblock(token, u.id));
                })
              }
            />
          ) : null}
        </Card>
        <ErrorText message={error} />
        <Text style={ui.label}>{t('New accounts are made on the website.')}</Text>
      </ScrollView>
    </View>
  );
}
