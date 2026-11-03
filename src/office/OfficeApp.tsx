import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useAuth } from '../auth';
import { colors } from '../config';
import { t } from '../i18n';
import { styles as ui } from '../ui';
import { CreateSheet } from './CreateSheet';
import { officeApi } from './officeApi';
import { OfficeTabBar } from './OfficeTabBar';
import { Fab, OfficeHeader } from './officeUi';
import { HelpScreen } from './HelpScreen';
import { HomeScreen } from './HomeScreen';
import { MapScreen } from './MapScreen';
import { CustomerTicketFlow } from './create/CustomerTicketFlow';
import { NewCustomerFlow } from './create/NewCustomerFlow';
import { PlannedWorkFlow } from './create/PlannedWorkFlow';
import { TicketScreen } from './TicketScreen';
import { TicketsScreen } from './TicketsScreen';
import { createChoicesFor, type CreateChoice, type OfficeLayout, type OfficeTab } from './shell';

/** What every office screen may open: a ticket, a help request, or a new ticket. */
export interface OfficeNav {
  layout: OfficeLayout;
  openTicket: (id: string) => void;
  openHelp: (id: string) => void;
  create: (choice: CreateChoice) => void;
  /** The number of unread notifications changed (read on the Notifications tab). */
  refreshUnread: () => void;
}

type Covering =
  { kind: 'ticket'; id: string } | { kind: 'help'; id: string } | { kind: 'create'; choice: CreateChoice };

/** Shown until a screen is built (replaced task by task). */
function Placeholder({ title }: { title: string }) {
  return (
    <View style={ui.screen}>
      <OfficeHeader title={t(title)} />
    </View>
  );
}

/** The screens for team managers, operations supervisors and administrators; they need a connection. */
export function OfficeApp({ layout }: { layout: OfficeLayout }) {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<OfficeTab>('home');
  const [covering, setCovering] = useState<Covering | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadRound, setUnreadRound] = useState(0);

  // Unread notifications, every minute while the app is open.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const inbox = await officeApi.inbox(await accessToken());
        if (alive) setUnread(inbox.unread);
      } catch {
        // No signal: try again next time.
      }
    };
    void check();
    const timer = setInterval(check, 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [accessToken, unreadRound]);

  const nav: OfficeNav = {
    layout,
    openTicket: (id) => setCovering({ kind: 'ticket', id }),
    openHelp: (id) => setCovering({ kind: 'help', id }),
    create: (choice) => setCovering({ kind: 'create', choice }),
    refreshUnread: () => setUnreadRound((n) => n + 1)
  };
  if (covering?.kind === 'help') {
    return <HelpScreen id={covering.id} onBack={() => setCovering(null)} onOpenTicket={nav.openTicket} />;
  }
  if (covering?.kind === 'ticket') {
    return <TicketScreen id={covering.id} onBack={() => setCovering(null)} />;
  }
  if (covering) {
    const done = (id: string) => setCovering({ kind: 'ticket', id });
    const cancel = () => setCovering(null);
    if (covering.choice === 'customer')
      return <CustomerTicketFlow layout={layout} onCancel={cancel} onCreated={done} />;
    if (covering.choice === 'planned')
      return <PlannedWorkFlow layout={layout} onCancel={cancel} onCreated={done} />;
    return <NewCustomerFlow onCancel={cancel} onCreated={done} />;
  }

  const body =
    tab === 'home' ? (
      <HomeScreen nav={nav} />
    ) : tab === 'tickets' ? (
      <TicketsScreen nav={nav} />
    ) : tab === 'map' ? (
      <MapScreen nav={nav} />
    ) : tab === 'inbox' ? (
      <Placeholder title="Notifications" />
    ) : (
      <Placeholder title="Me" />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {body}
        {(tab === 'home' || tab === 'tickets') && <Fab onPress={() => setChoosing(true)} />}
      </View>
      <OfficeTabBar layout={layout} current={tab} onChange={setTab} unread={unread} />
      {choosing && (
        <CreateSheet
          choices={createChoicesFor(layout)}
          onClose={() => setChoosing(false)}
          onChoose={(c) => {
            setChoosing(false);
            nav.create(c);
          }}
        />
      )}
    </View>
  );
}
