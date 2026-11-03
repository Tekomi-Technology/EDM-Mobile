import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { t } from '../i18n';
import { Button, Card, ErrorText, styles as ui } from '../ui';
import type { TicketAction } from './actions';
import { homeCardsFor, homeStatsFor, type HomeCard, type HomeData } from './home';
import type { OfficeNav } from './OfficeApp';
import { officeApi } from './officeApi';
import { LoadState, OfficeHeader, Pill, s } from './officeUi';
import { describeError, useRemote } from './remote';

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
/** Done at once from the card; the others need a choice or a reason, so they open the ticket. */
const ONE_TAP: TicketAction[] = ['acknowledge', 'close', 'reopen', 'offer', 'notify_customers'];

const CARD_PILL: Record<HomeCard['kind'], { text: string; tone: 'red' | 'orange' | 'blue' | 'green' }> = {
  late: { text: 'Late', tone: 'red' },
  unassigned: { text: 'Nobody has it', tone: 'orange' },
  incident: { text: 'Network incident', tone: 'red' },
  check: { text: 'Waiting check', tone: 'green' },
  help: { text: 'Help request', tone: 'blue' }
};

/** My team (team managers) or Overview (supervisors, administrators): the numbers and what needs doing first. */
export function HomeScreen({ nav }: { nav: OfficeNav }) {
  const { accessToken } = useAuth();
  const supervisor = nav.layout !== 'team_manager';
  const me = useRemote((token) => officeApi.me(token), []);
  const home = useRemote<HomeData>(
    async (token) => {
      const [overview, help, incidents, waitingCheck] = await Promise.all([
        officeApi.overview(token),
        officeApi.helpRequests(token),
        supervisor ? officeApi.incidents(token) : Promise.resolve([]),
        supervisor ? officeApi.tickets(token, { view: 'waiting_check', limit: 20 }) : Promise.resolve([])
      ]);
      return { overview, help, incidents, waitingCheck };
    },
    [supervisor]
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(card: HomeCard, action: TicketAction) {
    if (!ONE_TAP.includes(action)) return nav.openTicket(card.id);
    setBusy(`${card.id}:${action}`);
    setError(null);
    try {
      const token = await accessToken();
      if (action === 'acknowledge') await officeApi.acknowledge(token, card.id);
      else if (action === 'close') await officeApi.close(token, card.id);
      else if (action === 'reopen') await officeApi.reopen(token, card.id);
      else if (action === 'offer') await officeApi.offer(token, card.id);
      else if (action === 'notify_customers') await officeApi.notifyCustomers(token, card.id);
      home.reload();
    } catch (e) {
      setError(describeError(e).error);
    } finally {
      setBusy(null);
    }
  }

  const subtitle = me.data
    ? [me.data.fullName, supervisor ? t('All areas') : me.data.teamName].filter(Boolean).join(' · ')
    : null;
  const cards = home.data ? homeCardsFor(nav.layout, home.data) : [];

  return (
    <View style={ui.screen}>
      <OfficeHeader title={t(supervisor ? 'Overview' : 'My team')} subtitle={subtitle} />
      <LoadState loading={home.loading} error={home.error} hasData={!!home.data} onRetry={home.reload} />
      {home.data && (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 96 }}
          refreshControl={<RefreshControl refreshing={home.loading} onRefresh={home.reload} />}
        >
          <ErrorText message={home.error ?? error} />
          <View style={s.stats}>
            {homeStatsFor(nav.layout, home.data).map((st) => (
              <View key={st.label} style={s.stat}>
                <Text style={s.statValue}>{st.value}</Text>
                <Text style={s.statLabel}>{t(st.label)}</Text>
              </View>
            ))}
          </View>
          {cards.length === 0 && (
            <Text style={[ui.label, { textAlign: 'center', marginTop: 24 }]}>
              {t('Nothing waiting. All good.')}
            </Text>
          )}
          {cards.map((card) => (
            <Card key={`${card.kind}:${card.id}`}>
              <Pill text={t(CARD_PILL[card.kind].text)} tone={CARD_PILL[card.kind].tone} />
              <Text
                style={ui.cardTitle}
                onPress={() => (card.kind === 'help' ? nav.openHelp(card.id) : nav.openTicket(card.id))}
              >
                {card.title}
              </Text>
              {card.detail ? <Text style={ui.label}>{card.detail}</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {card.kind === 'help' ? (
                  <Button
                    label={t('Reply')}
                    kind="soft"
                    icon="message-circle"
                    onPress={() => nav.openHelp(card.id)}
                  />
                ) : (
                  card.actions.map((a, i) => (
                    <Button
                      key={a}
                      label={t(ACTION_LABEL[a])}
                      kind={i === 0 ? 'primary' : 'soft'}
                      busy={busy === `${card.id}:${a}`}
                      onPress={() => void act(card, a)}
                    />
                  ))
                )}
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
