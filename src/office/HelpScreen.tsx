import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth';
import { t } from '../i18n';
import { Button, Card, ErrorText, ago, styles as ui } from '../ui';
import { officeApi } from './officeApi';
import { LoadState, OfficeHeader } from './officeUi';
import { describeError, useRemote } from './remote';

const KIND_LABEL: Record<string, string> = {
  second_person: 'Needs a second person',
  truck: 'Needs a truck',
  material: 'Needs material',
  switch_off: 'Needs the line switched off',
  advice: 'Needs advice',
  other: 'Other'
};

/** A help request from the field: the conversation, and a reply (optionally marking it solved). */
export function HelpScreen({
  id,
  onBack,
  onOpenTicket
}: {
  id: string;
  onBack: () => void;
  onOpenTicket: (id: string) => void;
}) {
  const { accessToken } = useAuth();
  const help = useRemote((token) => officeApi.helpRequest(token, id), [id]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(solve: boolean) {
    if (!reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await officeApi.helpReply(await accessToken(), id, {
        body: reply.trim(),
        status: solve ? 'solved' : 'in_progress'
      });
      setReply('');
      help.reload();
    } catch (e) {
      setError(describeError(e).error);
    } finally {
      setBusy(false);
    }
  }

  const h = help.data;
  return (
    <View style={ui.screen}>
      <OfficeHeader
        title={h ? h.requestedBy.fullName : t('Help request')}
        subtitle={h ? `${t(KIND_LABEL[h.kind] ?? h.kind)} · ${h.teamName ?? ''}` : null}
        onBack={onBack}
      />
      <LoadState loading={help.loading} error={help.error} hasData={!!h} onRetry={help.reload} />
      {h && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
          {h.ticket && (
            <Button
              label={`${h.ticket.code} · ${h.ticket.title}`}
              kind="secondary"
              icon="file-text"
              onPress={() => onOpenTicket(h.ticket!.id)}
            />
          )}
          {h.messages.map((m) => (
            <Card key={m.id} style={m.fromField ? undefined : { backgroundColor: '#FFF4E8' }}>
              <Text style={ui.label}>
                {m.authorName} · {ago(m.createdAt)}
              </Text>
              <Text style={ui.body}>{m.body}</Text>
            </Card>
          ))}
          {h.status === 'solved' ? (
            <Text style={ui.label}>{t('Solved')}</Text>
          ) : (
            <>
              <TextInput
                style={ui.input}
                multiline
                value={reply}
                onChangeText={setReply}
                placeholder={t('Your answer to the staff member')}
              />
              <ErrorText message={error} />
              <Button
                label={t('Send')}
                busy={busy}
                disabled={!reply.trim()}
                onPress={() => void send(false)}
              />
              <Button
                label={t('Send and mark solved')}
                kind="secondary"
                disabled={!reply.trim() || busy}
                onPress={() => void send(true)}
              />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
