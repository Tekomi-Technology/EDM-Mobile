import { describe, expect, it } from 'vitest';
import type { HelpRequestView, IncidentSummary, Overview, TicketSummary } from '../types';
import { homeCardsFor, homeStatsFor, type HomeData } from './home';

const ticket = (id: string, over: Partial<TicketSummary> = {}): TicketSummary => ({
  id,
  code: `TK-${id}`,
  type: 'customer_complaint',
  source: 'call_center',
  problemType: 'no_power_single',
  status: 'new',
  priority: 2,
  title: `Ticket ${id}`,
  areaName: 'Matola',
  teamId: 't1',
  teamName: 'South 1',
  assignee: null,
  customerName: 'Rosa',
  address: 'Av. Lenine 120',
  dueAt: null,
  createdAt: '2026-11-03T08:00:00Z',
  updatedAt: '2026-11-03T08:00:00Z',
  ...over
});
const overview = (over: Partial<Overview> = {}): Overview => ({
  open: 0,
  newToday: 0,
  beingFixed: 0,
  staffOnDuty: 0,
  waitingCheck: 0,
  waitingCallCenter: 0,
  late: 0,
  attention: [],
  unassigned: [],
  map: [],
  ...over
});
const incident = (id: string, acknowledgedAt: string | null): IncidentSummary => ({
  ...ticket(id, { type: 'network_incident', status: 'new' }),
  severity: 'major',
  elementCode: 'PT-1',
  alarmCount: 2,
  activeAlarms: 1,
  customersAffected: 40,
  linkedTickets: 3,
  acknowledgedAt,
  lastAlarmAt: null
});
const help = (id: string, status: HelpRequestView['status']): HelpRequestView => ({
  id,
  kind: 'truck',
  message: 'Need a truck',
  status,
  ticket: null,
  requestedBy: { id: 's1', fullName: 'João', phone: null },
  teamName: 'South 1',
  handledBy: null,
  createdAt: '2026-11-03T08:00:00Z',
  updatedAt: '2026-11-03T08:00:00Z',
  messages: []
});
const empty: HomeData = { overview: overview(), incidents: [], help: [], waitingCheck: [] };

describe('homeCardsFor: what needs doing first, by role', () => {
  it('shows nothing when nothing is waiting', () => {
    expect(homeCardsFor('team_manager', empty)).toEqual([]);
    expect(homeCardsFor('supervisor', empty)).toEqual([]);
  });

  it('gives a team manager the jobs nobody has, then late jobs, then open help requests', () => {
    const data: HomeData = {
      ...empty,
      overview: overview({
        unassigned: [ticket('u1')],
        attention: [ticket('u1'), ticket('l1', { status: 'in_progress' })]
      }),
      help: [help('h1', 'new'), help('h2', 'solved')]
    };
    expect(homeCardsFor('team_manager', data).map((c) => [c.kind, c.id, c.actions])).toEqual([
      ['unassigned', 'u1', ['assign', 'offer']],
      ['late', 'l1', ['assign']],
      ['help', 'h1', []]
    ]);
  });

  it('gives a supervisor unacknowledged incidents, then checks, then late jobs, then help', () => {
    const data: HomeData = {
      overview: overview({ attention: [ticket('l1')] }),
      incidents: [incident('i1', null), incident('i2', '2026-11-03T09:00:00Z')],
      help: [help('h1', 'in_progress')],
      waitingCheck: [ticket('c1', { status: 'resolved' })]
    };
    expect(homeCardsFor('supervisor', data).map((c) => [c.kind, c.id, c.actions])).toEqual([
      ['incident', 'i1', ['acknowledge', 'notify_customers']],
      ['check', 'c1', ['close', 'reopen']],
      ['late', 'l1', ['assign']],
      ['help', 'h1', []]
    ]);
    expect(homeCardsFor('admin', data)).toEqual(homeCardsFor('supervisor', data));
  });
});

describe('homeStatsFor: the three numbers at the top', () => {
  it('counts for a team manager', () => {
    const data = {
      ...empty,
      overview: overview({ open: 12, late: 2, unassigned: [ticket('a'), ticket('b')] })
    };
    expect(homeStatsFor('team_manager', data)).toEqual([
      { label: 'Open', value: 12 },
      { label: 'Late', value: 2 },
      { label: 'Waiting for someone', value: 2 }
    ]);
  });
  it('counts for a supervisor', () => {
    const data = {
      ...empty,
      overview: overview({ waitingCheck: 6, late: 7 }),
      incidents: [incident('i1', null)]
    };
    expect(homeStatsFor('supervisor', data)).toEqual([
      { label: 'Network incidents', value: 1 },
      { label: 'Waiting check', value: 6 },
      { label: 'Late', value: 7 }
    ]);
  });
});
