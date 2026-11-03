import { useEffect, useState } from 'react';
import { RefreshControl, SectionList, Text, TextInput, View } from 'react-native';
import { colors } from '../config';
import { t } from '../i18n';
import { PROBLEM_TYPES, type TicketSummary } from '../types';
import { TYPE_LABEL, styles as ui } from '../ui';
import type { OfficeNav } from './OfficeApp';
import { officeApi } from './officeApi';
import { LoadState, OfficeHeader, Row, s } from './officeUi';
import { useRemote } from './remote';
import { groupTickets, type Dot } from './ticketGroups';

const DOT: Record<Dot, string> = {
  red: colors.late,
  orange: colors.brand,
  blue: colors.blue,
  green: '#067647'
};

/** "Mất điện, một nhà" for customer problems, else the kind of ticket. */
export function problemLabel(ticket: TicketSummary): string {
  const p =
    ticket.problemType && ticket.problemType in PROBLEM_TYPES
      ? PROBLEM_TYPES[ticket.problemType as keyof typeof PROBLEM_TYPES]
      : null;
  return t(p ? p.label : TYPE_LABEL[ticket.type]);
}

/** Office tickets (mockup C): one line each, grouped by what needs doing; the API decides which tickets. */
export function TicketsScreen({ nav }: { nav: OfficeNav }) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const list = useRemote((token) => officeApi.tickets(token, { q: query || undefined, limit: 100 }), [query]);
  const groups = list.data ? groupTickets(list.data, new Date()) : [];

  return (
    <View style={ui.screen}>
      <OfficeHeader
        title={t('Tickets')}
        subtitle={list.data ? t('{0} open', { 0: groups.reduce((n, g) => n + g.items.length, 0) }) : null}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('Code, customer, address…')}
          style={[ui.input, { minHeight: 44, padding: 10 }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </OfficeHeader>
      <LoadState loading={list.loading} error={list.error} hasData={!!list.data} onRetry={list.reload} />
      {list.data && (
        <SectionList
          sections={groups.map((g) => ({ title: g.title, data: g.items }))}
          keyExtractor={(item) => item.ticket.id}
          refreshControl={<RefreshControl refreshing={list.loading} onRefresh={list.reload} />}
          contentContainerStyle={{ paddingBottom: 96 }}
          renderSectionHeader={({ section }) => <Text style={s.group}>{t(section.title)}</Text>}
          renderItem={({ item }) => (
            <Row
              dot={DOT[item.dot]}
              title={`${item.ticket.code} · ${problemLabel(item.ticket)}`}
              detail={[item.ticket.assignee?.fullName, item.ticket.address ?? item.ticket.customerName]
                .filter(Boolean)
                .join(' · ')}
              right={item.right}
              onPress={() => nav.openTicket(item.ticket.id)}
            />
          )}
          ListEmptyComponent={
            <Text style={[ui.label, { textAlign: 'center', marginTop: 32 }]}>{t('No open tickets.')}</Text>
          }
        />
      )}
    </View>
  );
}
