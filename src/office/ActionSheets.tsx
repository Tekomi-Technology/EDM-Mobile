import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { colors } from '../config';
import { t } from '../i18n';
import type { Lookups, StaffSuggestion, TicketDetail } from '../types';
import { Button, ErrorText, distanceText, styles as ui } from '../ui';
import type { TicketAction } from './actions';
import { useRemote } from './remote';
import { officeApi } from './officeApi';

/** The actions that need a choice or a text before they are sent. */
export type SheetAction = Extract<TicketAction, 'assign' | 'take_back' | 'cancel' | 'change_team' | 'note'>;
export const SHEET_ACTIONS: SheetAction[] = ['assign', 'take_back', 'cancel', 'change_team', 'note'];

const TITLE: Record<SheetAction, string> = {
  assign: 'Assign to',
  take_back: 'Take the job back',
  cancel: 'Cancel the ticket',
  change_team: 'Send to another team',
  note: 'Add a note'
};

/** Asks what the action needs, then calls send; closes when it went through. */
export function ActionSheet({
  action,
  ticket,
  onSend,
  onClose
}: {
  action: SheetAction;
  ticket: TicketDetail;
  onSend: (action: SheetAction, body: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [notify, setNotify] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staff = useRemote<StaffSuggestion[]>(
    (token) =>
      action === 'assign' && ticket.teamId
        ? officeApi.suggestions(token, ticket.teamId, ticket.id)
        : Promise.resolve([]),
    [action, ticket.id]
  );
  const lookups = useRemote<Lookups | null>(
    (token) => (action === 'change_team' ? officeApi.lookups(token) : Promise.resolve(null)),
    [action]
  );

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await onSend(action, body);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  const needsReason =
    action === 'take_back' || action === 'cancel' || (action === 'change_team' && !!ticket.teamId);
  const reasonOk = !needsReason || text.trim().length >= 3;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(29,36,51,0.35)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 16,
          paddingBottom: 32,
          gap: 10,
          maxHeight: '80%'
        }}
      >
        <Text style={ui.cardTitle}>{t(TITLE[action])}</Text>
        {action === 'assign' && (
          <ScrollView style={{ maxHeight: 360 }}>
            {!ticket.teamId && <Text style={ui.label}>{t('Send it to a team first.')}</Text>}
            {(staff.data ?? []).map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void send({ assigneeId: p.id })}
                style={{ paddingVertical: 12, borderBottomColor: colors.border, borderBottomWidth: 1 }}
              >
                <Text style={ui.body}>
                  {p.fullName}
                  {p.bestMatch ? ` · ${t('best choice')}` : ''}
                </Text>
                <Text style={ui.label}>
                  {[
                    p.onDuty ? t('On duty') : t('Off duty'),
                    t('{0} open jobs', { 0: p.openJobs }),
                    p.distanceM != null ? distanceText(p.distanceM) : null
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Pressable>
            ))}
            <ErrorText message={staff.error} />
          </ScrollView>
        )}
        {action === 'change_team' && (
          <ScrollView style={{ maxHeight: 240 }}>
            {(lookups.data?.teams ?? [])
              .filter((x) => x.id !== ticket.teamId)
              .map((x) => (
                <Pressable
                  key={x.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: teamId === x.id }}
                  onPress={() => setTeamId(x.id)}
                  style={{ paddingVertical: 10 }}
                >
                  <Text style={[ui.body, teamId === x.id && { fontWeight: '700', color: colors.brandText }]}>
                    {x.name} · {x.areaName}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
        )}
        {action !== 'assign' && (
          <TextInput
            style={ui.input}
            multiline
            value={text}
            onChangeText={setText}
            placeholder={t(
              action === 'note' ? 'Note for the ticket history' : 'Why (kept in the ticket history)'
            )}
          />
        )}
        {action === 'note' && ticket.assignee && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Switch value={notify} onValueChange={setNotify} />
            <Text style={ui.body}>{t('Also send it to {0}', { 0: ticket.assignee.fullName })}</Text>
          </View>
        )}
        <ErrorText message={error} />
        {action !== 'assign' && (
          <Button
            label={t('Send')}
            busy={busy}
            disabled={
              !text.trim() && action !== 'change_team'
                ? true
                : !reasonOk || (action === 'change_team' && !teamId)
            }
            onPress={() =>
              void send(
                action === 'note'
                  ? { text: text.trim(), notifyAssignee: notify }
                  : action === 'change_team'
                    ? { teamId, ...(text.trim() ? { reason: text.trim() } : {}) }
                    : { reason: text.trim() }
              )
            }
          />
        )}
        <Button label={t('Close')} kind="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}
