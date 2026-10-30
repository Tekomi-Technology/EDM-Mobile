import type { MaterialLine, TicketDetail } from '../types';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { colors } from '../config';
import { locale, t, ticketTitle } from '../i18n';
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

/** How the job became theirs: claimed from the team's list, or sent by the manager. */
function sentBy(job: TicketDetail): string | null {
  const assign = [...job.events].reverse().find((e) => e.type === 'assign' || e.type === 'claim');
  if (!assign) return null;
  if (assign.type === 'claim') return t('you claimed it');
  return assign.data.auto
    ? t('given to you automatically')
    : t('sent by {0}', { 0: assign.actorName ?? t('your manager') });
}

function QuickActions({ job }: { job: TicketDetail }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {job.customer?.phone && (
        <View style={{ flex: 1 }}>
          <Button
            kind="soft"
            icon="phone"
            label={t('Call customer')}
            onPress={() => void Linking.openURL(`tel:${job.customer!.phone}`)}
          />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Button
          kind="soft"
          icon="navigation"
          label={t('Open in maps')}
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
      setError(e instanceof Error ? e.message : t('Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  // Everything goes through the queue: saved on the phone first, sent at once if there is signal.
  const act = (action: NewAction) => run(() => offline.perform(action));

  const submitReason = () =>
    run(async () => {
      if (reason.trim().length < 3) throw new Error(t('Write a short reason.'));
      if (asking === 'decline') {
        await offline.perform({ kind: 'decline', ticketId: id, reason: reason.trim() });
        onBack();
        return;
      }
      await offline.perform({ kind: 'hold', ticketId: id, reason: reason.trim() });
      setAsking(null);
      setReason('');
    });

  const takePhoto = () =>
    run(async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error(t('Allow camera access in the phone settings to add photos.'));
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (shot.canceled || !shot.assets[0]) return;
      const asset = shot.assets[0];
      const localUri = offline.keepPhoto(asset.uri);
      setPhotos((p) => [...p, { localUri, fileName: asset.fileName ?? `photo-${Date.now()}.jpg` }]);
    });

  const askForHelp = (kind: Parameters<typeof offline.askForHelp>[0]['kind'] | null, message: string) =>
    run(async () => {
      if (!kind) throw new Error(t('Choose what kind of help you need.'));
      if (message.length < 3) throw new Error(t('Write what you need.'));
      await offline.askForHelp({ kind, message, ticketId: id });
      setHelpOpen(false);
      setHelpSent(true);
    });

  /** Online only: whoever claims a team job first has it; if someone was quicker, back to the list. */
  const claim = () =>
    run(async () => {
      if (!(await offline.claim(id))) onBack();
    });

  const finish = () =>
    run(async () => {
      if (!note.trim()) throw new Error(t('Write a short note about what you did.'));
      const action: NewAction = { kind: 'resolve', ticketId: id, note: note.trim(), photos, materials };
      if (job?.type === 'new_customer_survey') {
        if (!survey.result) throw new Error(t('Choose the result of the survey.'));
        const distance = survey.distance.trim() ? Number(survey.distance) : undefined;
        if (distance !== undefined && !(Number.isInteger(distance) && distance >= 0)) {
          throw new Error(t('Write the distance in whole metres.'));
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
        if (installation.meterNumber.trim().length < 3) throw new Error(t('Write the meter number.'));
        if (photos.length === 0) throw new Error(t('Take a photo of the installed meter.'));
        action.installation = {
          meterNumber: installation.meterNumber.trim(),
          sealNumber: installation.sealNumber.trim() || undefined
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
          <Text style={{ fontSize: 17, color: colors.text }}>{t('My jobs')}</Text>
        </Pressable>
        <Text style={styles.body}>
          {t('This job is not saved on the phone yet. Open it once while you have signal.')}
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
  // Offered to the whole team and not claimed yet.
  const offered = job.allowedActions.includes('claim');

  const reasonBox = asking && (
    <Card>
      <Text style={styles.cardTitle}>
        {asking === 'decline' ? t("Why can't you take it?") : t('Why are you pausing?')}
      </Text>
      <Text style={styles.label}>
        {asking === 'decline'
          ? t('The job is offered to the rest of your team, or goes back to your manager.')
          : t('For example: waiting for material, unsafe to work, customer not at home.')}
      </Text>
      <TextInput value={reason} onChangeText={setReason} multiline style={styles.input} autoFocus />
      <Button
        label={asking === 'decline' ? t('Give the job back') : t('Pause work')}
        busy={busy}
        onPress={() => void submitReason()}
      />
      <Button
        kind="secondary"
        label={t('Never mind')}
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
            <Text style={{ fontSize: 17, color: colors.text }}>{t('My jobs')}</Text>
          </Pressable>
          {offered ? (
            <View
              style={{
                backgroundColor: colors.brandSoft,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 5
              }}
            >
              <Text style={{ color: colors.brandText, fontWeight: '700' }}>
                {t('Waiting for someone of the team')}
              </Text>
            </View>
          ) : job.status === 'assigned' ? (
            <View
              style={{
                backgroundColor: colors.brandSoft,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 5
              }}
            >
              <Text style={{ color: colors.brandText, fontWeight: '700' }}>{t('New job')}</Text>
            </View>
          ) : (
            <Badge status={job.status} />
          )}
        </View>
        <Text style={styles.title}>{ticketTitle(job.title)}</Text>
        <Text style={[styles.label, { fontSize: 15 }]}>
          {[
            job.code,
            t(TYPE_LABEL[job.type]),
            offered && job.offer ? t('told {0} people of the team', { 0: job.offer.notified.length }) : by
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        <OfflineBanner online={offline.online} savedAt={offline.savedAt} waiting={waiting.length} />
        <ErrorText message={error} />

        {(unfinished || offered) && left && (
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
                {left.late ? t('Already {0}', { 0: left.text }) : left.text}
              </Text>
              {left.late && job.status === 'assigned' && (
                <Text style={{ color: '#912018' }}>{t('Please go as soon as you can')}</Text>
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
                  t('No address')}
              </Text>
              {job.areaName && <Text style={styles.label}>{job.areaName}</Text>}
            </View>
          </View>
          {(unfinished || offered) && <QuickActions job={job} />}
        </Card>

        {offered && (
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              alignItems: 'flex-start',
              backgroundColor: '#EFF4FF',
              borderRadius: 14,
              padding: 14
            }}
          >
            <Icon name="info" size={18} color="#1849A9" />
            <Text style={{ flex: 1, color: '#1849A9', fontSize: 15, lineHeight: 21 }}>
              {t(
                'This job was offered to the whole team {0}. Whoever claims it first goes; the others need not go.',
                {
                  0: job.teamName ?? ''
                }
              )}
            </Text>
          </View>
        )}

        {unfinished && job.status !== 'assigned' && !asking && !helpOpen && (
          <Button
            kind="soft"
            icon="life-buoy"
            label={helpSent ? t('Help asked. Ask again') : t('Ask the office for help')}
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
            <Text style={{ color: '#067647', fontWeight: '700' }}>{t('Sharing your location')}</Text>
          </View>
        )}

        {job.network && (
          <Card>
            <Text style={styles.label}>{t('Network')}</Text>
            <Text style={styles.cardTitle}>
              {job.network.elementName ?? job.network.elementCode ?? t('Reported by phone')}
            </Text>
            {job.network.customersAffected !== null && (
              <Text style={styles.body}>
                {t('About {0} customers without power', {
                  0: job.network.customersAffected.toLocaleString(locale())
                })}
              </Text>
            )}
            {job.network.alarms.map((a) => (
              <Text key={a.id} style={[styles.body, a.clearedAt ? { color: colors.muted } : null]}>
                • {a.alarmType} · {a.elementCode}
                {a.clearedAt ? ` (${t('cleared')})` : ''}
              </Text>
            ))}
            {job.network.alarms.length > 0 && job.network.activeAlarms === 0 && (
              <Text style={{ color: '#067647', fontWeight: '700' }}>
                {t('The NMS says every alarm has cleared.')}
              </Text>
            )}
            <Text style={[styles.body, { fontStyle: 'italic' }]}>{job.description}</Text>
          </Card>
        )}

        {job.planned && (
          <Card>
            <Text style={styles.label}>
              {job.planned.kind === 'network_change' ? t('Planned network change') : t('Planned maintenance')}
            </Text>
            <Text style={styles.cardTitle}>
              {new Date(job.planned.scheduledStart).toLocaleString(locale(), {
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
              {job.planned.outage ? t('Power is cut during the work') : t('No power cut')}
            </Text>
            <Text style={styles.body}>{job.description}</Text>
          </Card>
        )}

        {job.customer && (
          <Card>
            <Text style={styles.label}>{t('Customer')}</Text>
            <Text style={styles.cardTitle}>
              {job.customer.fullName}
              {job.customer.contractNo
                ? ` · ${t('contract {0}', { 0: job.customer.contractNo })}`
                : ` · ${t('new customer')}`}
            </Text>
            {!!job.newCustomer?.requestedLoadKw && (
              <Text style={styles.body}>
                {t('Load asked for: {0} kW', { 0: job.newCustomer.requestedLoadKw })}
              </Text>
            )}
            {job.newCustomer?.survey && (
              <>
                <Text style={styles.label}>
                  {t('From the survey {0}', { 0: job.newCustomer.surveyTicket?.code ?? '' })}
                </Text>
                {!!job.newCustomer.survey.nearestElement && (
                  <Text style={styles.body}>
                    {job.newCustomer.survey.distanceToNetworkM !== null
                      ? t('Connect from {0}, {1} m away', {
                          0: job.newCustomer.survey.nearestElement,
                          1: job.newCustomer.survey.distanceToNetworkM
                        })
                      : t('Connect from {0}', { 0: job.newCustomer.survey.nearestElement })}
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
              {job.type === 'new_customer_survey' ? t('Survey report') : t('Finish job')}
            </Text>
            {job.type === 'new_customer_survey' && (
              <SurveyForm draft={survey} onChange={setSurvey} van={offline.van} />
            )}
            {job.type === 'new_connection' && (
              <InstallationForm draft={installation} onChange={setInstallation} />
            )}
            {job.type !== 'new_customer_survey' && (
              <MaterialsPicker
                van={offline.van}
                title={t('Material used')}
                lines={materials}
                onChange={setMaterials}
              />
            )}
            <Text style={styles.label}>
              {job.type === 'new_customer_survey'
                ? t('Notes for the office')
                : t('What did you find and what did you do?')}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={
                job.type === 'new_customer_survey'
                  ? t('e.g. Customer home, wall ready for the meter box.')
                  : t('e.g. Service cable burnt at pole P-4471. Replaced 12 m of cable.')
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
                    accessibilityLabel={t('Photo of the work')}
                  />
                ))}
              </View>
            )}
            <Button
              kind="secondary"
              icon="camera"
              label={t('Take a photo')}
              busy={busy}
              onPress={() => void takePhoto()}
            />
          </Card>
        )}

        {job.status === 'on_hold' && (
          <Card style={{ backgroundColor: colors.brandSoft, borderColor: '#FBE3C8' }}>
            <Text style={styles.cardTitle}>{t('Work is paused')}</Text>
            {typeof holdReason === 'string' && <Text style={styles.body}>{holdReason}</Text>}
          </Card>
        )}
        {job.status === 'resolved' && (
          <Card style={{ backgroundColor: colors.brandSoft, borderColor: '#FBE3C8' }}>
            <Text style={styles.body}>
              {waiting.length > 0
                ? t('Saved on the phone. It is sent with your photos as soon as there is signal.')
                : job.type === 'new_customer_survey'
                  ? t('Thank you. The report goes to Sales, who contact the customer.')
                  : job.type === 'new_connection'
                    ? t('Thank you. The office checks the connection with the customer and closes the job.')
                    : t(
                        'Thank you. The Call Center will call the customer to confirm. If the power is still off, the job comes back to your team.'
                      )}
            </Text>
          </Card>
        )}
        {job.status === 'cancelled' && (
          <Card style={{ backgroundColor: colors.brandSoft, borderColor: '#FBE3C8' }}>
            <Text style={styles.body}>{t('This job was cancelled. There is no need to go.')}</Text>
          </Card>
        )}
        {reasonBox}
      </ScrollView>

      {offered && (
        <View style={styles.footer}>
          <Button label={t('Claim this job')} busy={busy} onPress={() => void claim()} />
          <Text style={[styles.label, { textAlign: 'center' }]}>
            {t('Once claimed, the job is yours and shows as accepted.')}
          </Text>
        </View>
      )}
      {!asking && unfinished && (
        <View style={styles.footer}>
          {job.status === 'assigned' && (
            <>
              <Button
                label={t('Accept and go')}
                busy={busy}
                onPress={() => void act({ kind: 'accept', ticketId: id })}
              />
              <Button
                kind="secondary"
                label={t("I can't take this job")}
                onPress={() => setAsking('decline')}
              />
            </>
          )}
          {job.status === 'accepted' && (
            <>
              <Button
                label={t('I have arrived')}
                busy={busy}
                onPress={() => void act({ kind: 'start', ticketId: id })}
              />
              <Button
                kind="secondary"
                label={t("I can't take this job")}
                onPress={() => setAsking('decline')}
              />
            </>
          )}
          {job.status === 'in_progress' && (
            <>
              <Button
                label={
                  job.type === 'new_customer_survey'
                    ? t('Send survey report')
                    : job.type === 'new_connection'
                      ? t('Connection done')
                      : t('Problem fixed')
                }
                icon="check"
                busy={busy}
                onPress={() => void finish()}
              />
              <Button
                kind="secondary"
                icon="pause"
                label={t('Pause work')}
                onPress={() => setAsking('hold')}
              />
            </>
          )}
          {job.status === 'on_hold' && (
            <Button
              label={t('Resume work')}
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
