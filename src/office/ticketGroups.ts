import type { TicketSummary } from '../types';
import { ago } from '../ui';

export type Dot = 'red' | 'orange' | 'blue' | 'green';
export interface TicketGroup {
  key: 'now' | 'working' | 'check';
  title: string;
  items: { ticket: TicketSummary; dot: Dot; right: string }[];
}

const TITLES: Record<TicketGroup['key'], string> = {
  now: 'Needs action now',
  working: 'Being worked on',
  check: 'Waiting check'
};

/**
 * Office ticket list (mockup C): "needs action now" (nobody has it yet, reopened, or late), "being worked on",
 * "waiting check". Late jobs first, then the earliest time limit. Closed and cancelled tickets are left out.
 */
export function groupTickets(tickets: TicketSummary[], now: Date): TicketGroup[] {
  const isLate = (t: TicketSummary) => !!t.dueAt && new Date(t.dueAt).getTime() < now.getTime();
  const keyOf = (t: TicketSummary): TicketGroup['key'] | null => {
    if (t.status === 'closed' || t.status === 'cancelled') return null;
    if (t.status === 'resolved') return 'check';
    if (t.status === 'new' || t.status === 'assigned' || t.status === 'reopened' || isLate(t)) return 'now';
    return 'working';
  };
  const dotOf = (key: TicketGroup['key'], t: TicketSummary): Dot =>
    key === 'check' ? 'green' : key === 'working' ? 'blue' : isLate(t) || t.priority <= 1 ? 'red' : 'orange';
  const due = (t: TicketSummary) => (t.dueAt ? new Date(t.dueAt).getTime() : Number.POSITIVE_INFINITY);

  return (['now', 'working', 'check'] as const)
    .map((key) => ({
      key,
      title: TITLES[key],
      items: tickets
        .filter((t) => keyOf(t) === key)
        .sort((a, b) => Number(isLate(b)) - Number(isLate(a)) || due(a) - due(b))
        .map((ticket) => ({ ticket, dot: dotOf(key, ticket), right: ago(ticket.createdAt) }))
    }))
    .filter((g) => g.items.length > 0);
}
