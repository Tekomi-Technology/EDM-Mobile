import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { APP_NAME } from '../appName';
import { platformVersion, shortVersion } from '../version';
import { useAuth } from '../auth';
import { PRIVACY_URL } from '../config';
import { t } from '../i18n';
import { LanguagePicker } from '../screens/LanguagePicker';
import { Button, Card, styles as ui } from '../ui';
import { UsersScreen } from './admin/UsersScreen';
import type { OfficeNav } from './OfficeApp';
import { officeApi } from './officeApi';
import { OfficeHeader, s } from './officeUi';
import { roleNames } from './roleNames';
import { useRemote } from './remote';

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Me for office roles: who I am, a short report, language, privacy, sign out; administrators also manage accounts. */
export function MeScreen({ nav }: { nav: OfficeNav }) {
  const auth = useAuth();
  const me = useRemote((token) => officeApi.me(token), []);
  const report = useRemote((token) => {
    const to = new Date();
    return officeApi.report(token, day(new Date(to.getTime() - 29 * 86_400_000)), day(to));
  }, []);
  const [admin, setAdmin] = useState(false);

  if (admin) return <UsersScreen onBack={() => setAdmin(false)} />;

  const r = report.data;
  return (
    <View style={ui.screen}>
      <OfficeHeader
        title={me.data?.fullName ?? t('Me')}
        subtitle={me.data ? [roleNames(me.data.roles), me.data.teamName].filter(Boolean).join(' · ') : null}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {r && (
          <Card>
            <Text style={ui.cardTitle}>{t('Last 30 days')}</Text>
            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statValue}>{r.closed}</Text>
                <Text style={s.statLabel}>{t('Closed')}</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statValue}>{r.onTimePct == null ? '—' : `${Math.round(r.onTimePct)}%`}</Text>
                <Text style={s.statLabel}>{t('On time')}</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statValue}>
                  {r.mttrMinutes == null ? '—' : `${Math.round(r.mttrMinutes / 60)} h`}
                </Text>
                <Text style={s.statLabel}>{t('Time to fix')}</Text>
              </View>
            </View>
            <Text style={ui.label}>{t('The full reports are on the website.')}</Text>
          </Card>
        )}
        {nav.layout === 'admin' && (
          <Card>
            <Text style={ui.cardTitle}>{t('Administration')}</Text>
            <Button label={t('Accounts and roles')} kind="soft" icon="users" onPress={() => setAdmin(true)} />
            <Text style={ui.label}>
              {t('Areas and teams, API keys and sign-in security are on the website.')}
            </Text>
          </Card>
        )}
        <Card>
          <Text style={ui.cardTitle}>{t('Language')}</Text>
          <LanguagePicker />
        </Card>
        <Button
          kind="secondary"
          icon="shield"
          label={t('Privacy policy')}
          onPress={() => void Linking.openURL(PRIVACY_URL)}
        />
        <Button kind="secondary" icon="log-out" label={t('Sign out')} onPress={() => void auth.signOut()} />
        <Text style={[ui.label, { textAlign: 'center', marginTop: 8 }]}>
          {t('{app} · version {version}', {
            app: APP_NAME,
            version: shortVersion(platformVersion(Constants.expoConfig, Platform.OS))
          })}
        </Text>
      </ScrollView>
    </View>
  );
}
