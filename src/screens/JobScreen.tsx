import type { MaterialLine, TicketDetail } from '../types';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { colors } from '../config';
import type { QueuedPhoto } from '../offline/engine';
import { useOffline, type NewAction } from '../offline/OfflineProvider';
import {
  emptyInstallation,
  emptySurvey,
  HelpBox,
  InstallationForm,
  MaterialsPicker,
  SurveyForm,
  type InstallationDraft,
  type SurveyDraft
} from './FinishForms';
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
  TYPE_LABEL
} from '../ui';

const mapsUrl = (job: TicketDetail) =>
  job.location
    ? `https://www.google.com/maps/dir/?api=1&destination=${job.location.lat},${job.location.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customer?.address ?? '')}`;

/** Who gave the job: the manager's name, or "automatically" when the system assigned it. */
function sentBy(job: TicketDetail): string | null {
  const assign = [...job.events].reverse().find((e) => e.type === 'assign');
  if (!assign) return null;
  return assign.data.auto ? 'given to you automatically' : `sent by ${assign.actorName ?? 'your manager'}`;
}

function QuickActions({ job }: { job: TicketDetail }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {job.customer?.phone && (
        <View style={{ flex: 1 }}>
          <Button
            kind="soft"
            icon="phone"
            label="Call customer"
            onPress={() => void Linking.openURL(`tel:${job.customer!.phone}`)}
          />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Button
          kind="soft"
          icon="navigation"
          label="Open in maps"
          onPress={() => void Linking.openURL(mapsUrl(job))}
        />
      </View>
    </View>
  );
}

/** M03 (new job), M04 (on the way), then fixing, paused and done. */
export function JobScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const offline = useOffline();
  const job = offline.job(id);
  const waiting = offline.queue.filter((a) => a.ticketId === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  /** Declining and pausing need a short reason, typed in a box that opens under the buttons. */
  const [asking, setAsking] = useState<'decline' | 'hold' | null>(null);
  const [reason, setReason] = useState('');
  const [materials, setMaterials] = useState<MaterialLine[]>([]);
  const [survey, setSurvey] = useState<SurveyDraft>(emptySurvey);
  const [installation, setInstallation] = useState<InstallationDraft>(emptyInstallation);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSent, setHelpSent] = useState(false);

  const { refreshJob } = offline;
  useEffect(() => {
    void refreshJob(id);
  }, [id, refreshJob]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  // Everything goes through the queue: saved on the phone first, sent at once if there is signal.
  const act = (action: NewAction) => run(() => offline.perform(action));

  const submitReason = () =>
    run(async () => {
      if (reason.trim().length < 3) throw new Error('Write a short reason.');
      if (asking === 'decline') {
        await offline.perform({ kind: 'decline', ticketId: id, reason: reason.trim() });
        onBack();
        return;
      }
      await offline.perform({ kind: 'hold', ticketId: id, reason: reason.trim() });
      setAsking(null);
      setReason('');
    });

  const takePhoto = (signedForm = false) =>
    run(async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Allow camera access in the phone settings to add photos.');
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (shot.canceled || !shot.assets[0]) return;
      const asset = shot.assets[0];
      const localUri = offline.keepPhoto(asset.uri);
      if (signedForm) setInstallation((d) => ({ ...d, signedFormPhoto: photos.length }));
      setPhotos((p) => [...p, { localUri, fileName: asset.fileName ?? `photo-${Date.now()}.jpg` }]);
    });

  const sendCode = async () => {
    let ok = false;
    await run(async () => {
      await offline.sendHandoverCode(id);
      ok = true;
    });
    return ok;
  };

  const askForHelp = (kind: Parameters<typeof offline.askForHelp>[0]['kind'] | null, message: string) =>
    run(async () => {
      if (!kind) throw new Error('Choose what kind of help you need.');
      if (message.length < 3) throw new Error('Write what you need.');
      await offline.askForHelp({ kind, message, ticketId: id });
      setHelpOpen(false);
      setHelpSent(true);
    });

  const finish = () =>
    run(async () => {
      if (!note.trim()) throw new Error('Write a short note about what you did.');
      const action: NewAction = { kind: 'resolve', ticketId: id, note: note.trim(), photos, materials };
      if (job?.type === 'new_customer_survey') {
        if (!survey.result) throw new Error('Choose the result of the survey.');
        const distance = survey.distance.trim() ? Number(survey.distance) : undefined;
        if (distance !== undefined && !(Number.isInteger(distance) && distance >= 0)) {
          throw new Error('Write the distance in whole metres.');
        }
        action.materials = [];
        action.survey = {
          result: survey.result,
          distanceToNetworkM: distance,
          nearestElement: survey.nearestElement.trim() || undefined,
          worksNeeded: survey.worksNeeded.trim() || undefined,
          estimatedMaterials: survey.result === 'not_feasible' ? [] : survey.materials
        };
      }
      if (job?.type === 'new_connection') {
        if (installation.meterNumber.trim().length < 3) throw new Error('Write the meter number.');
        if (installation.signedFormPhoto === null && installation.code.length !== 4) {
          throw new Error('Enter the 4-digit code from the customer, or take a photo of the signed form.');
        }
        action.installation = {
          meterNumber: installation.meterNumber.trim(),
          sealNumber: installation.sealNumber.trim() || undefined,
          ...(installation.signedFormPhoto !== null
            ? { signedFormPhoto: installation.signedFormPhoto }
            : { handoverCode: installation.code })
        };
      }
      await offline.perform(action);
      setNote('');
      setPhotos([]);
      setMaterials([]);
      setSurvey(emptySurvey);
      setInstallation(emptyInstallation);
    });

  if (!job) {
    return (
      <View style={[styles.screen, { padding: 16, paddingTop: 56, gap: 16 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Icon name="chevron-left" />
          <Text style={{ fontSize: 17, color: colors.text }}>My jobs</Text>
        </Pressable>
        <Text style={styles.body}>
          This job is not saved on the phone yet. Open it once while you have signal.
        </Text>
      </View>
    );
  }

  const left = timeLeft(job.dueAt);
  const pendingHold = [...waiting].reverse().find((a) => a.kind === 'hold');
  const holdReason =
    pendingHold && 'reason' in pendingHold
      ? pendingHold.reason
      : [...job.events].reverse().find((e) => e.type === 'hold')?.data.reason;
  const by = sentBy(job);
  const unfinished = ['assigned', 'accepted', 'in_progress', 'on_hold'].includes(job.status);

  const reasonBox = asking && (
    <Card>
      <Text style={styles.cardTitle}>
        {asking === 'decline' ? "Why can't you take it?" : 'Why are you pausing?'}
      </Text>
      <Text style={styles.label}>
        {asking === 'decline'
          ? 'The job goes to someone else on duty, or back to your manager.'
          : 'For example: waiting for material, unsafe to work, customer not at home.'}
      </Text>
      <TextInput value={reason} onChangeText={setReason} multiline style={styles.input} autoFocus />
      <Button
        label={asking === 'decline' ? 'Give the job back' : 'Pause work'}
        busy={busy}
        onPress={() => void submitReason()}
      />
      <Button
        kind="secondary"
        label="Never mind"
        onPress={() => {
          setAsking(null);
          setReason('');
        }}
      />
    </Card>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { gap: 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 }}
          >
            <Icon name="chevron-left" size={24} />
            <Text style={{ fontSize: 17, color: colors.text }}>My jobs</Text>
          </Pressable>
          {job.status === 'assigned' ? (
            <View
              style={{
                backgroundColor: colors.brandSoft,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 5
              }}
            >
              <Text style={{ color: colors.brandText, fontWeight: '700' }}>New job</Text>
            </View>
          ) : (
            <Badge status={job.status} />
          )}
        </View>
        <Text style={styles.title}>{job.title}</Text>
        <Text style={[styles.label, { fontSize: 15 }]}>
          {[job.code, TYPE_LABEL[job.type], by].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <OfflineBanner online={offline.online} savedAt={offline.savedAt} waiting={waiting.length} />
        <ErrorText message={error} />

        {unfinished && left && (
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
              borderRadius: 16,
              padding: 14,
              backgroundColor: left.late ? '#FEF3F2' : '#F2F4F7'
            }}
          >
            <Icon name="clock" size={24} color={left.late ? '#912018' : colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: left.late ? '#912018' : colors.text }}>
                {left.late ? `Already ${left.text}` : left.text}
              </Text>
              {left.late && job.status === 'assigned' && (
                <Text style={{ color: '#912018' }}>Please go as soon as you can</Text>
              )}
            </View>
          </View>
        )}

        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Icon name="map-pin" color={colors.brandText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {job.customer?.address ??
                  job.network?.elementName ??
                  job.planned?.element ??
                  job.areaName ??
                  'No address'}
              </Text>
              {job.areaName && <Text style={styles.label}>{job.areaName}</Text>}
            </View>
          </View>
          {unfinished && <QuickActions job={job} />}
        </Card>

        {unfinished && job.status !== 'assigned' && !asking && !helpOpen && (
          <Button
            kind="soft"
            icon="life-buoy"
            label={helpSent ? 'Help asked. Ask again' : 'Ask the office for help'}
            onPress={() => setHelpOpen(true)}
          />
        )}
        {helpOpen && <HelpBox busy={busy} onSend={askForHelp} onClose={() => setHelpOpen(false)} />}

        {job.status === 'accepted' && offline.locationStatus === 'on' && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'flex-start',
              backgroundColor: '#ECFDF3',
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 8
            }}
          >
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#12B76A' }} />
            <Text style={{ color: '#067647', fontWeight: '700' }}>Sharing your location</Text>
          </View>
        )}

        {job.network && (
          <Card>
            <Text style={styles.label}>Network</Text>
            <Text style={styles.cardTitle}>
              {job.network.elementName ?? job.network.elementCode ?? 'Reported by phone'}
            </Text>
            {job.network.customersAffected !== null && (
              <Text style={styles.body}>
                About {job.network.customersAffected.toLocaleString('en')} customers without power
              </Text>
            )}
            {job.network.alarms.map((a) => (
              <Text key={a.id} style={[styles.body, a.clearedAt ? { color: colors.muted } : null]}>
                • {a.alarmType} · {a.elementCode}
                {a.clearedAt ? ' (cleared)' : ''}
              </Text>
            ))}
            {job.network.alarms.length > 0 && job.network.activeAlarms === 0 && (
              <Text style={{ color: '#067647', fontWeight: '700' }}>
                The NMS says every alarm has cleared.
              </Text>
            )}
            <Text style={[styles.body, { fontStyle: 'italic' }]}>{job.description}</Text>
          </Card>
        )}

        {job.planned && (
          <Card>
            <Text style={styles.label}>
              {job.planned.kind === 'network_change' ? 'Planned network change' : 'Planned maintenance'}
            </Text>
            <Text style={styles.cardTitle}>
              {new Date(job.planned.scheduledStart).toLocaleString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}{' '}
              – {clock(job.planned.scheduledEnd)}
            </Text>
            {job.planned.element && <Text style={styles.body}>{job.planned.element}</Text>}
            <Text style={{ color: job.planned.outage ? colors.late : colors.muted, fontWeight: '700' }}>
              {job.planned.outage ? 'Power is cut during the work' : 'No power cut'}
            </Text>
            <Text style={styles.body}>{job.description}</Text>
          </Card>
        )}

        {job.customer && (
          <Card>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.cardTitle}>
              {job.customer.fullName}
              {job.customer.contractNo ? ` · contract ${job.customer.contractNo}` : ' · new customer'}
            </Text>
            {!!job.newCustomer?.requestedLoadKw && (
              <Text style={styles.body}>Load asked for: {job.newCustomer.requestedLoadKw} kW</Text>
            )}
            {job.newCustomer?.survey && (
              <>
                <Text style={styles.label}>From the survey {job.newCustomer.surveyTicket?.code ?? ''}</Text>
                {!!job.newCustomer.survey.nearestElement && (
                  <Text style={styles.body}>
                    Connect from {job.newCustomer.survey.nearestElement}
                    {job.newCustomer.survey.distanceToNetworkM !== null
                      ? `, ${job.newCustomer.survey.distanceToNetworkM} m away`
                      : ''}
                  </Text>
                )}
                {job.newCustomer.survey.estimatedMaterials.map((m) => (
                  <Text key={m.itemId} style={styles.body}>
                    • {m.quantity} {m.unit} {m.name}
                  </Text>
                ))}
              </>
            )}
            <Text style={[styles.body, { fontStyle: 'italic' }]}>“{job.description}”</Text>
          </Card>
        )}

        {job.status === 'in_progress' && !asking && (
          <Card>
            <Text style={styles.cardTitle}>
              {job.type === 'new_customer_survey' ? 'Survey report' : 'Finish job'}
            </Text>
            {job.type === 'new_customer_survey' && (
              <SurveyForm draft={survey} onChange={setSurvey} van={offline.van} />
            )}
            {job.type === 'new_connection' && (
              <InstallationForm
                draft={installation}
                onChange={setInstallation}
                online={offline.online}
                phone={job.customer?.phone ?? null}
                onSendCode={sendCode}
                onPhotoForm={() => void takePhoto(true)}
                busy={busy}
              />
            )}
            {job.type !== 'new_customer_survey' && (
              <MaterialsPicker
                van={offline.van}
                title="Material used"
                lines={materials}
                onChange={setMaterials}
              />
            )}
            <Text style={styles.label}>
              {job.type === 'new_customer_survey'
                ? 'Notes for the office'
                : 'What did you find and what did you do?'}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={
                job.type === 'new_customer_survey'
                  ? 'e.g. Customer home, wall ready for the meter box.'
                  : 'e.g. Service cable burnt at pole P-4471. Replaced 12 m of cable.'
              }
              style={styles.input}
            />
            {photos.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {photos.map((p) => (
                  <Image
                    key={p.localUri}
                    source={{ uri: p.localUri }}
                    style={{ width: 84, height: 84, borderRadius: 12 }}
                    accessibilityLabel="Photo of the work"
                  />
                ))}
              </View>
            )}
            <Button
              kind="secondary"
              icon="camera"
              label="Take a photo"
              busy={busy}
              onPress={() => void takePhoto(false)}
            />
          </Card>
        )}

        {job.status === 'on_hold' && (
          <Card style={{ backgroundColor: colors.brandSoft, borderColor: '#FBE3C8' }}>
            <Text style={styles.cardTitle}>Work is paused</Text>
            {typeof holdReason === 'string' && <Text style={styles.body}>{holdReason}</Text>}
          </Card>
        )}
        {job.status === 'resolved' && (
          <Card style={{ backgroundColor: colors.brandSoft, borderColor: '#FBE3C8' }}>
            <Text style={styles.body}>
              {waiting.length > 0
                ? 'Saved on the phone. It is sent with your photos as soon as there is signal.'
                : job.type === 'new_customer_survey'
                  ? 'Thank you. The report goes to Sales, who contact the customer.'
                  : job.type === 'new_connection'
                    ? 'Thank you. Sales switch on the service and close the job.'
                    : 'Thank you. The Call Center will call the customer to confirm. If the power is still off, the job comes back to your team.'}
            </Text>
          </Card>
        )}
        {job.status === 'cancelled' && (
          <Card style={{ backgroundColor: colors.brandSoft, borderColor: '#FBE3C8' }}>
            <Text style={styles.body}>This job was cancelled. There is no need to go.</Text>
          </Card>
        )}
        {reasonBox}
      </ScrollView>

      {!asking && unfinished && (
        <View style={styles.footer}>
          {job.status === 'assigned' && (
            <>
              <Button
                label="Accept and go"
                busy={busy}
                onPress={() => void act({ kind: 'accept', ticketId: id })}
              />
              <Button kind="secondary" label="I can't take this job" onPress={() => setAsking('decline')} />
            </>
          )}
          {job.status === 'accepted' && (
            <>
              <Button
                label="I have arrived"
                busy={busy}
                onPress={() => void act({ kind: 'start', ticketId: id })}
              />
              <Button kind="secondary" label="I can't take this job" onPress={() => setAsking('decline')} />
            </>
          )}
          {job.status === 'in_progress' && (
            <>
              <Button
                label={
                  job.type === 'new_customer_survey'
                    ? 'Send survey report'
                    : job.type === 'new_connection'
                      ? 'Connection done'
                      : 'Problem fixed'
                }
                icon="check"
                busy={busy}
                onPress={() => void finish()}
              />
              <Button kind="secondary" icon="pause" label="Pause work" onPress={() => setAsking('hold')} />
            </>
          )}
          {job.status === 'on_hold' && (
            <Button
              label="Resume work"
              icon="play"
              busy={busy}
              onPress={() => void act({ kind: 'resume', ticketId: id })}
            />
          )}
        </View>
      )}
    </View>
  );
}
