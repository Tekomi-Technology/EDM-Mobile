import type { HelpRequestView, IncidentSummary, Overview, TicketSummary } from '../types';
import type { TicketAction } from './actions';
import type { OfficeLayout } from './shell';

export interface HomeData {
  overview: Overview;
  incidents: IncidentSummary[];
  help: HelpRequestView[];
  /** Jobs reported done, waiting for the check (supervisors and administrators). */
  waitingCheck: TicketSummary[];
}

export interface HomeCard {
  kind: 'late' | 'unassigned' | 'incident' | 'check' | 'help';
  id: string;
  title: string;
  detail: string;
  actions: TicketAction[];
}

const ticketCard = (kind: HomeCard['kind'], t: TicketSummary, actions: TicketAction[]): HomeCard => ({
  kind,
  id: t.id,
  title: `${t.code} · ${t.title}`,
  detail: [t.address ?? t.areaName, t.assignee?.fullName ?? t.teamName].filter(Boolean).join(' · '),
  actions
});

const helpCards = (help: HelpRequestView[]): HomeCard[] =>
  help
    .filter((h) => h.status !== 'solved')
    .map((h) => ({ kind: 'help', id: h.id, title: h.requestedBy.fullName, detail: h.message, actions: [] }));

/**
 * What needs doing first. Team managers: jobs nobody has, late jobs, help requests of the team.
 * Supervisors and administrators: incidents not acknowledged, jobs waiting for the check, late jobs, help requests.
 */
export function homeCardsFor(layout: OfficeLayout, data: HomeData): HomeCard[] {
  const { overview, incidents, help, waitingCheck } = data;
  const unassignedIds = new Set(overview.unassigned.map((t) => t.id));
  const late = overview.attention.filter((t) => !unassignedIds.has(t.id));
  if (layout === 'team_manager') {
    return [
      ...overview.unassigned.map((t) => ticketCard('unassigned', t, ['assign', 'offer'])),
      ...late.map((t) => ticketCard('late', t, ['assign'])),
      ...helpCards(help)
    ];
  }
  return [
    ...incidents
      .filter((i) => !i.acknowledgedAt)
      .map((i) => ticketCard('incident', i, ['acknowledge', 'notify_customers'])),
    ...waitingCheck.map((t) => ticketCard('check', t, ['close', 'reopen'])),
    ...overview.attention.map((t) => ticketCard('late', t, ['assign'])),
    ...helpCards(help)
  ];
}

/** The three numbers at the top of the home tab. */
export function homeStatsFor(layout: OfficeLayout, data: HomeData): { label: string; value: number }[] {
  const { overview, incidents } = data;
  if (layout === 'team_manager') {
    return [
      { label: 'Open', value: overview.open },
      { label: 'Late', value: overview.late },
      { label: 'Waiting for someone', value: overview.unassigned.length }
    ];
  }
  const openIncidents = incidents.filter((i) => i.status !== 'closed' && i.status !== 'cancelled').length;
  return [
    { label: 'Network incidents', value: openIncidents },
    { label: 'Waiting check', value: overview.waitingCheck },
    { label: 'Late', value: overview.late }
  ];
}
