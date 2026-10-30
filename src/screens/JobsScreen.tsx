import type { TeamOffer, TicketSummary } from '../types';
import { useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { EDM_EMBLEM } from '../assets';
import { colors } from '../config';
import { locale, t, ticketTitle } from '../i18n';
import { useOffline } from '../offline/OfflineProvider';
import {
  ago,
  Badge,
  Button,
  Card,
  clock,
  distanceText,
  ErrorText,
  Icon,
  OfflineBanner,
  styles,
  timeLeft,
  TYPE_ICON
} from '../ui';

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? t('Good morning') : hour < 18 ? t('Good afternoon') : t('Good evening');
}

function Stat({ value, label, alert }: { value: number; label: string; alert?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#F6F6F7', borderRadius: 14, padding: 12 }}>
      <Text
        style={{ fontSize: 26, fontWeight: '700', color: alert && value > 0 ? colors.late : colors.text }}
      >
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** M02: jobs waiting for someone of the team on top, then what the field staff member has to do. */
export function JobsScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const offline = useOffline();
  const { me, jobs, queue } = offline;
  // The spinner shows only for a pull; refreshes the app does by itself stay out of sight.
  const [pulling, setPulling] = useState(false);
  const pull = async () => {
    setPulling(true);
    try {
      await offline.refresh();
    } finally {
      setPulling(false);
    }
  };

  const offers = offline.offers;
  // Jobs the office sent to this person by name; they still accept or give them back.
  const named = jobs.filter((j) => j.status === 'assigned');
  const current =
    jobs.find((j) => j.status === 'in_progress' || j.status === 'on_hold') ??
    jobs.find((j) => j.status === 'accepted');
  const next = jobs.filter((j) => j !== current && j.status === 'accepted');
  const sending = jobs.filter((j) => j.status === 'resolved');
  const toGo = jobs.filter((j) => j.status !== 'resolved').length;
  const late = jobs.filter((j) => j.status !== 'resolved' && timeLeft(j.dueAt)?.late).length;
  const today = new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={EDM_EMBLEM} style={{ width: 46, height: 46 }} accessibilityLabel={t('EDM logo')} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
              {greeting()}
              {me ? `, ${me.fullName.split(' ')[0]}` : ''}
            </Text>
            <Text style={styles.label}>
              {today}
              {me?.teamName ? ` · ${t('Team {0}', { 0: me.teamName })}` : ''}
            </Text>
          </View>
          {me && (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: me.onDuty }}
              accessibilityLabel={t('On duty')}
              onPress={() => void offline.setDuty(!me.onDuty)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: me.onDuty ? '#ECFDF3' : '#F2F4F7',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 8
              }}
            >
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: me.onDuty ? '#12B76A' : '#98A2B3'
                }}
              />
              <Text style={{ fontWeight: '700', color: me.onDuty ? '#067647' : colors.muted }}>
                {me.onDuty ? t('On duty') : t('Off duty')}
              </Text>
            </Pressable>
          )}
        </View>
        {me?.onDuty && offline.locationStatus === 'on' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="navigation" size={14} color="#067647" />
            <Text style={{ color: '#067647', fontSize: 13, fontWeight: '500' }}>
              {t('Sharing your location while on duty')}
            </Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat value={offline.doneToday} label={t('done')} />
          <Stat value={toGo} label={t('to go')} />
          <Stat value={late} label={t('late')} alert />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} />}
      >
        <OfflineBanner online={offline.online} savedAt={offline.savedAt} waiting={queue.length} />
        <ErrorText message={offline.error} />
        {offline.conflicts.map((c) => (
          <Card key={c.id} style={{ backgroundColor: '#FEF3F2', borderColor: '#FECDCA' }}>
            <Text style={styles.body}>{c.message}</Text>
            <Pressable accessibilityRole="button" onPress={() => offline.dismissConflict(c.id)}>
              <Text style={{ color: colors.late, fontWeight: '700' }}>{t('OK')}</Text>
            </Pressable>
          </Card>
        ))}

        {me?.onDuty && offline.locationStatus !== 'on' && (
          <Card style={{ backgroundColor: '#FEF3F2', borderColor: '#FECDCA' }}>
            <Text style={styles.cardTitle}>{t('Location is off')}</Text>
            <Text style={styles.body}>
              {t(
                'Allow location “all the time”, so the office sees where you are and jobs show how far away they are. It is only shared while you are on duty.'
              )}
            </Text>
            <Button
              kind="secondary"
              icon="map-pin"
              label={offline.locationStatus === 'denied' ? t('Open phone settings') : t('Allow location')}
              onPress={() =>
                void (offline.locationStatus === 'denied' ? Linking.openSettings() : offline.enableLocation())
              }
            />
          </Card>
        )}

        {me && !me.onDuty && (
          <Card style={{ backgroundColor: colors.brandSoft, borderColor: '#FBE3C8' }}>
            <Text style={styles.cardTitle}>{t('You are off duty')}</Text>
            <Text style={styles.body}>
              {t('Switch on duty when your shift starts, so the office sees you are working.')}
            </Text>
            <Button label={t('Start my shift')} onPress={() => void offline.setDuty(true)} />
          </Card>
        )}

        {offers.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.section, { color: colors.brandText }]}>
              {t('Waiting for someone of the team')}
            </Text>
            <View
              style={{
                backgroundColor: colors.brand,
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 1
              }}
            >
              <Text style={{ color: colors.brandInk, fontWeight: '700', fontSize: 13 }}>{offers.length}</Text>
            </View>
          </View>
        )}
        {offers.map((o) => (
          <OfferCard key={o.id} offer={o} onOpen={onOpen} />
        ))}
        {offers.length > 0 && (jobs.length > 0 || named.length > 0) && (
          <Text style={styles.section}>{t('My jobs')}</Text>
        )}

        {named.map((j) => (
          <Pressable key={j.id} accessibilityRole="button" onPress={() => onOpen(j.id)}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                backgroundColor: colors.brandSoft,
                borderColor: '#F9CB94',
                borderWidth: 1,
                borderRadius: 18,
                padding: 16
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: colors.brand,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Icon name="bell" color={colors.brandInk} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.brandInk }}>
                  {t('New job for you')}
                </Text>
                <Text style={{ color: colors.brandText, fontSize: 15 }} numberOfLines={2}>
                  {ticketTitle(j.title)}
                  {j.areaName ? ` · ${j.areaName}` : ''}
                </Text>
              </View>
              <Icon name="chevron-right" color={colors.brandText} />
            </View>
          </Pressable>
        ))}

        {current && (
          <>
            <Text style={styles.section}>{t('Now')}</Text>
            <CurrentJob
              job={current}
              onOpen={onOpen}
              waiting={queue.some((a) => a.ticketId === current.id)}
            />
          </>
        )}

        {next.length > 0 && <Text style={styles.section}>{t('Next')}</Text>}
        {next.map((j) => (
          <JobRow key={j.id} job={j} onOpen={onOpen} />
        ))}

        {sending.length > 0 && <Text style={styles.section}>{t('Done, being sent')}</Text>}
        {sending.map((j) => (
          <JobRow key={j.id} job={j} onOpen={onOpen} />
        ))}

        {jobs.length === 0 && offers.length === 0 && !offline.busy && (
          <View style={{ alignItems: 'center', gap: 8, marginTop: 40, paddingHorizontal: 24 }}>
            <Icon name="check-circle" size={40} color={colors.muted} />
            <Text style={[styles.body, { textAlign: 'center' }]}>{t('No jobs right now.')}</Text>
            <Text style={[styles.label, { textAlign: 'center' }]}>
              {t('New jobs appear here and as a notification on your phone. Pull down to refresh.')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** A job offered to the whole team: whoever claims it first has it. */
function OfferCard({ offer, onOpen }: { offer: TeamOffer; onOpen: (id: string) => void }) {
  const offline = useOffline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = timeLeft(offer.dueAt);
  const where = [
    offer.address ?? offer.areaName,
    offer.distanceM !== null && t('{0} from you', { 0: distanceText(offer.distanceM) })
  ]
    .filter(Boolean)
    .join(' · ');
  const claim = async () => {
    setBusy(true);
    setError(null);
    try {
      if (await offline.claim(offer.id)) onOpen(offer.id);
    } catch (e) {
      setError(e instanceof Error ? t(e.message) : t('Something went wrong'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable accessibilityRole="button" onPress={() => onOpen(offer.id)}>
      <View
        style={{
          backgroundColor: colors.brandSoft,
          borderColor: '#F9CB94',
          borderWidth: 1,
          borderRadius: 16,
          padding: 14,
          gap: 10
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {left ? (
            <View
              style={{
                backgroundColor: left.late || offer.priority === 1 ? '#FEF3F2' : colors.surface,
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 2
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: left.late || offer.priority === 1 ? '#B42318' : colors.text
                }}
              >
                {offer.priority === 1 ? `${t('Urgent')} · ${left.text}` : left.text}
              </Text>
            </View>
          ) : (
            <View />
          )}
          {offer.offer && (
            <Text style={{ fontSize: 12, color: colors.brandText }}>
              {t('told {0} people · {1}', { 0: offer.offer.notified.length, 1: ago(offer.offer.at) })}
            </Text>
          )}
        </View>
        <View style={{ gap: 2 }}>
          <Text style={[styles.cardTitle, { fontSize: 17 }]} numberOfLines={2}>
            {ticketTitle(offer.title)}
          </Text>
          {!!where && (
            <Text style={styles.label} numberOfLines={2}>
              {where}
            </Text>
          )}
        </View>
        <ErrorText message={error} />
        <Button label={t('Claim the job')} busy={busy} onPress={() => void claim()} />
      </View>
    </Pressable>
  );
}

function CurrentJob({
  job,
  onOpen,
  waiting
}: {
  job: TicketSummary;
  onOpen: (id: string) => void;
  waiting: boolean;
}) {
  const left = timeLeft(job.dueAt);
  return (
    <Card style={{ borderColor: colors.brand, borderWidth: 2, gap: 10, padding: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Badge status={job.status} />
        {left && (
          <Text style={{ fontWeight: '700', fontSize: 15, color: left.late ? colors.late : colors.text }}>
            {left.text}
          </Text>
        )}
      </View>
      <Text style={[styles.title, { fontSize: 22 }]}>{ticketTitle(job.title)}</Text>
      <Text style={[styles.label, { fontSize: 15 }]}>
        {[job.customerName, job.address].filter(Boolean).join(' · ')}
        {waiting ? ` · ${t('not sent yet')}` : ''}
      </Text>
      <Button label={t('Continue job')} icon="arrow-right" onPress={() => onOpen(job.id)} />
    </Card>
  );
}

function JobRow({ job, onOpen }: { job: TicketSummary; onOpen: (id: string) => void }) {
  const left = timeLeft(job.dueAt);
  return (
    <Pressable accessibilityRole="button" onPress={() => onOpen(job.id)}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: colors.brandSoft,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon name={TYPE_ICON[job.type]} color={colors.brandText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {ticketTitle(job.title)}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            {job.areaName ?? job.address ?? job.code}
          </Text>
        </View>
        {job.status === 'resolved' ? (
          <Icon name="upload-cloud" color={colors.muted} />
        ) : (
          job.dueAt && (
            <Text style={{ fontWeight: '700', fontSize: 15, color: left?.late ? colors.late : colors.text }}>
              {clock(job.dueAt)}
            </Text>
          )
        )}
      </Card>
    </Pressable>
  );
}
