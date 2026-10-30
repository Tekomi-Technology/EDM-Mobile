import type { HelpRequestView } from '../types';
import { useState } from 'react';
import { Alert, Linking, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth';
import { colors } from '../config';
import { ACTION_LABEL } from '../offline/engine';
import { useOffline } from '../offline/OfflineProvider';
import { Button, Card, ErrorText, OfflineBanner, styles } from '../ui';
import { HELP_LABEL } from './FinishForms';
import { locale, t } from '../i18n';
import { LanguagePicker } from './LanguagePicker';

const HELP_STATUS = {
  new: 'Waiting for the office',
  in_progress: 'Being handled',
  solved: 'Solved'
} as const;

/** What the person asked the back office for, with the answers. Loaded on demand: it needs a connection. */
function MyHelpRequests() {
  const offline = useOffline();
  const [items, setItems] = useState<HelpRequestView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Something went wrong'));
    } finally {
      setBusy(false);
    }
  };
  const load = () => run(async () => setItems(await offline.helpRequests()));
  const reply = (id: string) =>
    run(async () => {
      const body = replies[id]?.trim();
      if (!body) throw new Error(t('Write a reply first.'));
      await offline.replyToHelp(id, body);
      setReplies((r) => ({ ...r, [id]: '' }));
      setItems(await offline.helpRequests());
    });

  return (
    <Card>
      <Text style={styles.cardTitle}>{t('My help requests')}</Text>
      <ErrorText message={error} />
      {items === null ? (
        <Button
          kind="soft"
          icon="life-buoy"
          label={t('Show answers from the office')}
          busy={busy}
          onPress={() => void load()}
        />
      ) : items.length === 0 ? (
        <Text style={styles.label}>{t('You have not asked for help recently.')}</Text>
      ) : (
        items.map((h) => (
          <View
            key={h.id}
            style={{ gap: 4, paddingVertical: 6, borderTopWidth: 1, borderColor: colors.border }}
          >
            <Text style={styles.body}>
              {t(HELP_LABEL[h.kind])}
              {h.ticket ? ` · ${h.ticket.code}` : ''}
            </Text>
            <Text style={{ color: h.status === 'solved' ? '#067647' : colors.brandText, fontWeight: '700' }}>
              {t(HELP_STATUS[h.status])}
            </Text>
            {h.messages.map((m) => (
              <Text key={m.id} style={[styles.label, m.fromField ? null : { color: colors.text }]}>
                {m.fromField ? t('You') : m.authorName}: {m.body}
              </Text>
            ))}
            {h.status !== 'solved' && (
              <>
                <TextInput
                  accessibilityLabel={t('Reply')}
                  value={replies[h.id] ?? ''}
                  onChangeText={(t) => setReplies((r) => ({ ...r, [h.id]: t }))}
                  placeholder={t('Reply')}
                  style={styles.input}
                />
                <Button
                  kind="secondary"
                  icon="send"
                  label={t('Send reply')}
                  busy={busy}
                  onPress={() => void reply(h.id)}
                />
              </>
            )}
          </View>
        ))
      )}
      {items !== null && (
        <Button
          kind="secondary"
          icon="refresh-cw"
          label={t('Refresh')}
          busy={busy}
          onPress={() => void load()}
        />
      )}
    </Card>
  );
}

/** The person's account, duty switch, and changes still waiting to be sent. */
export function MeScreen() {
  const auth = useAuth();
  const offline = useOffline();
  const { me, queue } = offline;

  const signOut = () => {
    if (queue.length === 0) return void auth.signOut();
    Alert.alert(
      t('Changes not sent yet'),
      t(
        queue.length === 1
          ? '{0} change has not reached the office. If you sign out now, it is lost.'
          : '{0} changes have not reached the office. If you sign out now, they are lost.',
        { 0: queue.length }
      ),
      [
        { text: t('Stay signed in'), style: 'cancel' },
        { text: t('Sign out anyway'), style: 'destructive', onPress: () => void auth.signOut() }
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{me?.fullName ?? t('Me')}</Text>
        <Text style={styles.label}>
          {me?.username}
          {me?.teamName ? ` · ${t('Team {0}', { 0: me.teamName })}` : ''}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <OfflineBanner online={offline.online} savedAt={offline.savedAt} waiting={queue.length} />
        <ErrorText message={offline.error} />
        {me && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{me.onDuty ? t('On duty') : t('Off duty')}</Text>
                <Text style={styles.label}>
                  {me.onDuty
                    ? t('New jobs in your area come to you automatically.')
                    : t('Switch on when your shift starts to receive jobs.')}
                </Text>
              </View>
              <Switch
                accessibilityLabel={t('On duty')}
                value={me.onDuty}
                disabled={offline.busy}
                onValueChange={(v) => void offline.setDuty(v)}
                trackColor={{ true: colors.brand }}
              />
            </View>
          </Card>
        )}
        <Card>
          <Text style={styles.cardTitle}>{t('Location')}</Text>
          <Text style={styles.label}>
            {offline.locationStatus === 'on'
              ? t(
                  'Shared with your team while you are on duty, also with the screen off. It stops when you go off duty.'
                )
              : offline.locationStatus === 'denied'
                ? t('Not allowed. Open the phone settings and allow location “all the time” for EDM Field.')
                : t('Not shared now. It starts when you go on duty.')}
          </Text>
          {me?.onDuty && offline.locationStatus !== 'on' && (
            <Button
              kind="secondary"
              icon="map-pin"
              label={offline.locationStatus === 'denied' ? t('Open phone settings') : t('Allow location')}
              onPress={() =>
                void (offline.locationStatus === 'denied' ? Linking.openSettings() : offline.enableLocation())
              }
            />
          )}
        </Card>
        {offline.van?.vehicle && (
          <Card>
            <Text style={styles.cardTitle}>{t('My van · {0}', { 0: offline.van.vehicle.plate })}</Text>
            {offline.van.lines.length === 0 ? (
              <Text style={styles.label}>{t('Nothing in the van. Ask your manager for material.')}</Text>
            ) : (
              offline.van.lines.map((l) => (
                <View
                  key={l.itemId}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
                >
                  <Text style={[styles.body, { flex: 1 }]}>{l.name}</Text>
                  <Text style={[styles.body, { fontWeight: '700' }]}>
                    {l.quantity} {l.unit}
                  </Text>
                </View>
              ))
            )}
            <Text style={styles.label}>
              {t('As the office last saw it. Material you use is taken off when the job closes.')}
            </Text>
          </Card>
        )}
        <MyHelpRequests />
        <Card>
          <Text style={styles.cardTitle}>{t('Waiting to be sent')}</Text>
          {queue.length === 0 ? (
            <Text style={styles.label}>{t('Everything you did has reached the office.')}</Text>
          ) : (
            <>
              {queue.map((a) => (
                <Text key={a.id} style={styles.body}>
                  •{' '}
                  {t('{0} {1} at {2}', {
                    0: t(ACTION_LABEL[a.kind])[0]!.toUpperCase() + t(ACTION_LABEL[a.kind]).slice(1),
                    1: a.ticketCode,
                    2: new Date(a.occurredAt).toLocaleTimeString(locale(), {
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  })}
                </Text>
              ))}
              <Button
                kind="soft"
                icon="upload-cloud"
                label={t('Send now')}
                busy={offline.busy}
                onPress={() => void offline.sendNow()}
              />
            </>
          )}
        </Card>
        <Card>
          <Text style={styles.cardTitle}>{t('Language')}</Text>
          <LanguagePicker />
        </Card>
        <Button kind="secondary" icon="log-out" label={t('Sign out')} onPress={signOut} />
        <Text style={[styles.label, { textAlign: 'center', marginTop: 8 }]}>
          {t('EDM Field · version 1.0')}
        </Text>
      </ScrollView>
    </View>
  );
}
