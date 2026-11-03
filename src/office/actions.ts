import type { CurrentUser, TicketDetail } from '../types';

/** What someone in the office may do to a ticket from the app. */
export type TicketAction =
  | 'assign'
  | 'offer'
  | 'take_back'
  | 'change_team'
  | 'close'
  | 'reopen'
  | 'cancel'
  | 'note'
  | 'acknowledge'
  | 'notify_customers';

const ORDER: TicketAction[] = [
  'close',
  'reopen',
  'assign',
  'offer',
  'acknowledge',
  'take_back',
  'change_team',
  'notify_customers',
  'cancel',
  'note'
];

/**
 * The buttons on a ticket for this person, the main one first. Assign, close, reopen and cancel come from the
 * ticket's allowedActions, which the server works out for this person; the rest follow the same rules as the API
 * (a team manager acts on their own team only; supervisors and administrators on every team).
 */
export function actionsFor(ticket: TicketDetail, me: CurrentUser): TicketAction[] {
  if (ticket.status === 'cancelled' || ticket.status === 'closed') return [];
  const above = me.roles.includes('admin') || me.roles.includes('technical_manager');
  const ownTeam =
    above || (me.roles.includes('team_manager') && !!ticket.teamId && ticket.teamId === me.teamId);
  const server = new Set<string>(ticket.allowedActions);
  const waiting = !ticket.assignee && (ticket.status === 'new' || ticket.status === 'reopened');
  const open = ticket.status !== 'resolved';
  const incident = ticket.type === 'network_incident';

  const allowed = new Set<TicketAction>();
  for (const a of ['assign', 'close', 'reopen', 'cancel'] as const) if (server.has(a)) allowed.add(a);
  if (ownTeam && waiting) allowed.add('offer');
  if (ownTeam && ticket.assignee && open) allowed.add('take_back');
  if (above && open) allowed.add('change_team');
  if (above && incident && !ticket.network?.acknowledgedAt) allowed.add('acknowledge');
  if (above && incident) allowed.add('notify_customers');
  allowed.add('note');
  return ORDER.filter((a) => allowed.has(a));
}
