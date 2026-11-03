import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { colors } from '../config';
import { t } from '../i18n';
import type { TicketDetail } from '../types';
import { Badge, Button, Card, ErrorText, TYPE_LABEL, ago, clock, styles as ui, timeLeft } from '../ui';
import { actionsFor, type TicketAction } from './actions';
import { ActionSheet, SHEET_ACTIONS, type SheetAction } from './ActionSheets';
import { officeApi } from './officeApi';
import { LoadState, OfficeHeader, Pill } from './officeUi';
import { describeError, useRemote } from './remote';
import { problemLabel } from './TicketsScreen';

const ACTION_LABEL: Record<TicketAction, string> = {
  assign: 'Assign',
  offer: 'Offer to the team',
  take_back: 'Take back',
  change_team: 'Other team',
  close: 'Close',
  reopen: 'Reopen',
  cancel: 'Cancel',
  note: 'Note',
  acknowledge: 'Acknowledge',
  notify_customers: 'Text the customers'
};

/** History lines in the words of the website (EVENT_LABEL there). */
const EVENT_LABEL: Record<string, string> = {
  created: 'created the ticket',
  assign: 'assigned the ticket',
  claim: 'claimed the job in the app',
  offered: 'offered the job to the team',
  accept: 'accepted the job',
  decline: 'declined the job',
  start: 'arrived and started work',
  hold: 'paused work',
  resume: 'resumed work',
  resolve: 'reported the job done',
  close: 'closed the ticket',
  reopen: 'reopened the ticket',
  cancel: 'cancelled the ticket',
  note: 'added a note',
  acknowledge: 'acknowledged the incident',
  escalate: 'the time limit was passed',
  team_changed: 'sent it to another team',
  take_back: 'took the job back',
  help_requested: 'asked for help'
};

type Pane = 'info' | 'history' | 'photos';

/** A ticket for the office (mockup B): summary and buttons on top, then Information · History · Photos. */
export function TicketScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const { accessToken } = useAuth();
  const ticket = useRemote((token) => officeApi.ticket(token, id), [id]);
  const me = useRemote((token) => officeApi.me(token), []);
  const [pane, setPane] = useState<Pane>('info');
  const [sheet, setSheet] = useState<SheetAction | null>(null);
  const [busy, setBusy] = useState<TicketAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(action: TicketAction, body: Record<string, unknown> = {}) {
    const token = await accessToken();
    const k = ticket.data!;
    if (action === 'assign') await officeApi.assign(token, k.id, body as { assigneeId: string });
    else if (action === 'offer') await officeApi.offer(token, k.id);
    else if (action === 'take_back') await officeApi.takeBack(token, k.id, body as { reason: string });
    else if (action === 'cancel') await officeApi.cancel(token, k.id, body as { reason: string });
    else if (action === 'change_team')
      await officeApi.changeTeam(token, k.id, body as { teamId: string; reason?: string });
    else if (action === 'note')
      await officeApi.note(token, k.id, body as { text: string; notifyAssignee?: boolean });
    else if (action === 'close') await officeApi.close(token, k.id);
    else if (action === 'reopen') await officeApi.reopen(token, k.id);
    else if (action === 'acknowledge') await officeApi.acknowledge(token, k.id);
    else if (action === 'notify_customers') await officeApi.notifyCustomers(token, k.id);
    ticket.reload();
  }

  async function press(action: TicketAction) {
    if ((SHEET_ACTIONS as TicketAction[]).includes(action)) return setSheet(action as SheetAction);
    setBusy(action);
    setError(null);
    try {
      await send(action);
    } catch (e) {
      setError(describeError(e).error);
    } finally {
      setBusy(null);
    }
  }

  const k: TicketDetail | null = ticket.data;
  const actions = k && me.data ? actionsFor(k, me.data) : [];
  const left = k ? timeLeft(k.dueAt) : null;

  return (
    <View style={ui.screen}>
      <OfficeHeader
        title={k ? `${k.code} · ${problemLabel(k)}` : t('Ticket')}
        subtitle={k ? t(TYPE_LABEL[k.type]) : null}
        onBack={onBack}
      >
        {k && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge status={k.status} />
              {left && k.status !== 'resolved' && <Pill text={left.text} tone={left.late ? 'red' : 'grey'} />}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {actions.map((a, i) => (
                <Button
                  key={a}
                  label={t(ACTION_LABEL[a])}
                  kind={i === 0 ? 'primary' : 'soft'}
                  busy={busy === a}
                  onPress={() => void press(a)}
                />
              ))}
            </ScrollView>
            <ErrorText message={error} />
          </View>
        )}
      </OfficeHeader>
      <LoadState loading={ticket.loading} error={ticket.error} hasData={!!k} onRetry={ticket.reload} />
      {k && (
        <>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              borderBottomWidth: 1
            }}
            accessibilityRole="tablist"
          >
            {(
              [
                ['info', t('Information')],
                ['history', t('History')],
                ['photos', `${t('Photos')} ${k.attachments.length}`]
              ] as [Pane, string][]
            ).map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: pane === key }}
                onPress={() => setPane(key)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: 2,
                  borderBottomColor: pane === key ? colors.brand : 'transparent'
                }}
              >
                <Text
                  style={{
                    fontWeight: pane === key ? '700' : '500',
                    color: pane === key ? colors.brandText : colors.muted
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {pane === 'info' && <Information ticket={k} />}
            {pane === 'history' &&
              [...k.events].reverse().map((e) => (
                <Card key={e.id}>
                  <Text style={ui.label}>
                    {clock(e.createdAt)} · {ago(e.createdAt)}
                  </Text>
                  <Text style={ui.body}>
                    {e.actorName ?? t('System')} {t(EVENT_LABEL[e.type] ?? e.type)}
                  </Text>
                  {typeof e.data.text === 'string' || typeof e.data.reason === 'string' ? (
                    <Text style={ui.label}>{String(e.data.text ?? e.data.reason)}</Text>
                  ) : null}
                </Card>
              ))}
            {pane === 'photos' &&
              (k.attachments.length === 0 ? (
                <Text style={ui.label}>
                  {t('No photos yet. Field staff add them when they finish the job.')}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {k.attachments.map((a) =>
                    a.url ? (
                      <Pressable
                        key={a.id}
                        accessibilityRole="imagebutton"
                        onPress={() => void Linking.openURL(a.url!)}
                      >
                        <Image
                          source={{ uri: a.url }}
                          style={{
                            width: 104,
                            height: 104,
                            borderRadius: 12,
                            backgroundColor: colors.border
                          }}
                        />
                      </Pressable>
                    ) : null
                  )}
                </View>
              ))}
          </ScrollView>
        </>
      )}
      {k && sheet && (
        <ActionSheet
          action={sheet}
          ticket={k}
          onClose={() => setSheet(null)}
          onSend={async (action, body) => {
            try {
              await send(action, body);
            } catch (e) {
              throw new Error(describeError(e).error);
            }
          }}
        />
      )}
    </View>
  );
}

function Information({ ticket: k }: { ticket: TicketDetail }) {
  const place = k.location ? `${k.location.lat},${k.location.lng}` : (k.customer?.address ?? k.address);
  return (
    <>
      {k.customer && (
        <Card>
          <Text style={ui.label}>{t('Customer')}</Text>
          <Text style={ui.cardTitle}>{k.customer.fullName}</Text>
          {k.customer.contractNo && (
            <Text style={ui.label}>{t('Contract {0}', { 0: k.customer.contractNo })}</Text>
          )}
          <Text style={ui.body}>{k.customer.address}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {k.customer.phone && (
              <Button
                label={t('Call')}
                kind="soft"
                icon="phone"
                onPress={() => void Linking.openURL(`tel:${k.customer!.phone}`)}
              />
            )}
            {place && (
              <Button
                label={t('Open in maps')}
                kind="soft"
                icon="map-pin"
                onPress={() =>
                  void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(place)}`)
                }
              />
            )}
          </View>
        </Card>
      )}
      <Card>
        <Text style={ui.label}>{t('Description')}</Text>
        <Text style={ui.body}>{k.description}</Text>
      </Card>
      <Card>
        <Text style={ui.label}>{t('Who is on it')}</Text>
        <Text style={ui.body}>{k.assignee?.fullName ?? t('Nobody yet')}</Text>
        <Text style={ui.label}>{k.teamName ? `${t('Team')}: ${k.teamName}` : t('No team yet')}</Text>
        {k.offer && !k.assignee && (
          <Text style={ui.label}>{t('Offered to the team; nobody has claimed it yet.')}</Text>
        )}
      </Card>
      {k.planned && (
        <Card>
          <Text style={ui.label}>{t('Planned work')}</Text>
          <Text style={ui.body}>
            {new Date(k.planned.scheduledStart).toLocaleString()} → {clock(k.planned.scheduledEnd)}
          </Text>
          {k.planned.outage && <Pill text={t('Power is cut')} tone="red" />}
        </Card>
      )}
      {k.network && (
        <Card>
          <Text style={ui.label}>{t('Network incident')}</Text>
          <Text style={ui.body}>
            {[k.network.elementCode, k.network.elementName].filter(Boolean).join(' · ')}
          </Text>
          <Text style={ui.label}>
            {t('{0} customer tickets linked', { 0: k.network.linkedTickets.length })}
            {k.network.acknowledgedAt
              ? ` · ${t('Acknowledged:')} ${k.network.acknowledgedBy ?? ''}`
              : ` · ${t('Not acknowledged yet')}`}
          </Text>
        </Card>
      )}
    </>
  );
}
