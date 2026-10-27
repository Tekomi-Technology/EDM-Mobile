import type { TicketSummary } from '../shared';
import { Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { EDM_EMBLEM } from '../assets';
import { colors } from '../config';
import { useOffline } from '../offline/OfflineProvider';
import {
  Badge,
  Button,
  Card,
  clock,
  ErrorText,
  Icon,
  OfflineBanner,
  styles,
  timeLeft,
  TYPE_ICON
} from '../ui';

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
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

/** M02: what the field staff member has to do, the current job first. */
export function JobsScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const offline = useOffline();
  const { me, jobs, queue } = offline;

  const offered = jobs.filter((j) => j.status === 'assigned');
  const current =
    jobs.find((j) => j.status === 'in_progress' || j.status === 'on_hold') ??
    jobs.find((j) => j.status === 'accepted');
  const next = jobs.filter((j) => j !== current && j.status === 'accepted');
  const sending = jobs.filter((j) => j.status === 'resolved');
  const toGo = jobs.filter((j) => j.status !== 'resolved').length;
  const late = jobs.filter((j) => j.status !== 'resolved' && timeLeft(j.dueAt)?.late).length;
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={EDM_EMBLEM} style={{ width: 46, height: 46 }} accessibilityLabel="EDM logo" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
              {greeting()}
              {me ? `, ${me.fullName.split(' ')[0]}` : ''}
            </Text>
            <Text style={styles.label}>
              {today}
              {me?.teamName ? ` · Team ${me.teamName}` : ''}
            </Text>
          </View>
          {me && (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: me.onDuty }}
              accessibilityLabel="On duty"
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
                {me.onDuty ? 'On duty' : 'Off duty'}
              </Text>
            </Pressable>
          )}
        </View>
        {me?.onDuty && offline.locationStatus === 'on' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="navigation" size={14} color="#067647" />
            <Text style={{ color: '#067647', fontSize: 13, fontWeight: '500' }}>
              Sharing your location while on duty
            </Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat value={offline.doneToday} label="done" />
          <Stat value={toGo} label="to go" />
          <Stat value={late} label="late" alert />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={offline.busy} onRefresh={() => void offline.refresh()} />}
      >
        <OfflineBanner online={offline.online} savedAt={offline.savedAt} waiting={queue.length} />
        <ErrorText message={offline.error} />
        {offline.conflicts.map((c) => (
          <Card key={c.id} style={{ backgroundColor: '#FEF3F2', borderColor: '#FECDCA' }}>
            <Text style={styles.body}>{c.message}</Text>
            <Pressable accessibilityRole="button" onPress={() => offline.dismissConflict(c.id)}>
              <Text style={{ color: colors.late, fontWeight: '700' }}>OK</Text>
            </Pressable>
          </Card>
        ))}

        {me?.onDuty && offline.locationStatus !== 'on' && (
          <Card style={{ backgroundColor: '#FEF3F2', borderColor: '#FECDCA' }}>
            <Text style={styles.cardTitle}>Location is off</Text>
            <Text style={styles.body}>
              Allow location “all the time”, so urgent jobs go to whoever is nearest. It is only shared while
              you are on duty.
            </Text>
            <Button
              kind="secondary"
              icon="map-pin"
              label={offline.locationStatus === 'denied' ? 'Open phone settings' : 'Allow location'}
              onPress={() =>
                void (offline.locationStatus === 'denied' ? Linking.openSettings() : offline.enableLocation())
              }
            />
          </Card>
        )}

        {me && !me.onDuty && (
          <Card style={{ backgroundColor: colors.brandSoft, borderColor: '#FBE3C8' }}>
            <Text style={styles.cardTitle}>You are off duty</Text>
            <Text style={styles.body}>Switch on duty when your shift starts, so new jobs come to you.</Text>
            <Button label="Start my shift" onPress={() => void offline.setDuty(true)} />
          </Card>
        )}

        {offered.map((j) => (
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
                  New job for you
                </Text>
                <Text style={{ color: colors.brandText, fontSize: 15 }} numberOfLines={2}>
                  {j.title}
                  {j.areaName ? ` · ${j.areaName}` : ''}
                </Text>
              </View>
              <Icon name="chevron-right" color={colors.brandText} />
            </View>
          </Pressable>
        ))}

        {current && (
          <>
            <Text style={styles.section}>Now</Text>
            <CurrentJob
              job={current}
              onOpen={onOpen}
              waiting={queue.some((a) => a.ticketId === current.id)}
            />
          </>
        )}

        {next.length > 0 && <Text style={styles.section}>Next</Text>}
        {next.map((j) => (
          <JobRow key={j.id} job={j} onOpen={onOpen} />
        ))}

        {sending.length > 0 && <Text style={styles.section}>Done, being sent</Text>}
        {sending.map((j) => (
          <JobRow key={j.id} job={j} onOpen={onOpen} />
        ))}

        {jobs.length === 0 && !offline.busy && (
          <View style={{ alignItems: 'center', gap: 8, marginTop: 40, paddingHorizontal: 24 }}>
            <Icon name="check-circle" size={40} color={colors.muted} />
            <Text style={[styles.body, { textAlign: 'center' }]}>No jobs right now.</Text>
            <Text style={[styles.label, { textAlign: 'center' }]}>
              New jobs appear here and as a notification on your phone. Pull down to refresh.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
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
      <Text style={[styles.title, { fontSize: 22 }]}>{job.title}</Text>
      <Text style={[styles.label, { fontSize: 15 }]}>
        {[job.customerName, job.address].filter(Boolean).join(' · ')}
        {waiting ? ' · not sent yet' : ''}
      </Text>
      <Button label="Continue job" icon="arrow-right" onPress={() => onOpen(job.id)} />
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
            {job.title}
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
