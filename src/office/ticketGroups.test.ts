import { describe, expect, it, vi } from 'vitest';

vi.mock('../ui', () => ({ ago: (iso: string) => `ago:${iso}` }));

import type { TicketSummary } from '../types';
import { groupTickets } from './ticketGroups';

const NOW = new Date('2026-11-03T12:00:00Z');
const ticket = (id: string, over: Partial<TicketSummary> = {}): TicketSummary => ({
  id,
  code: id,
  type: 'customer_complaint',
  source: 'call_center',
  problemType: null,
  status: 'new',
  priority: 2,
  title: id,
  areaName: null,
  teamId: 't1',
  teamName: 'South 1',
  assignee: null,
  customerName: null,
  address: null,
  dueAt: null,
  createdAt: '2026-11-03T10:00:00Z',
  updatedAt: '2026-11-03T10:00:00Z',
  ...over
});

describe('groupTickets: one line each, grouped by what needs doing', () => {
  it('sorts by status into needs action, being worked on and waiting check', () => {
    const groups = groupTickets(
      [
        ticket('a', { status: 'new' }),
        ticket('b', { status: 'in_progress' }),
        ticket('c', { status: 'resolved' })
      ],
      NOW
    );
    expect(groups.map((g) => [g.key, g.items.map((i) => i.ticket.id)])).toEqual([
      ['now', ['a']],
      ['working', ['b']],
      ['check', ['c']]
    ]);
    expect(groups.map((g) => g.items[0]!.dot)).toEqual(['orange', 'blue', 'green']);
  });

  it('puts a late job being worked on under needs action, with a red dot', () => {
    const [group] = groupTickets(
      [ticket('late', { status: 'in_progress', dueAt: '2026-11-03T11:00:00Z' })],
      NOW
    );
    expect(group).toMatchObject({ key: 'now', items: [{ dot: 'red' }] });
  });

  it('marks urgent jobs red even before they are late', () => {
    const [group] = groupTickets([ticket('u', { priority: 1 })], NOW);
    expect(group!.items[0]!.dot).toBe('red');
  });

  it('lists late jobs first, then the earliest time limit', () => {
    const [group] = groupTickets(
      [
        ticket('later', { dueAt: '2026-11-03T18:00:00Z' }),
        ticket('none'),
        ticket('soon', { dueAt: '2026-11-03T13:00:00Z' }),
        ticket('late', { dueAt: '2026-11-03T11:30:00Z' })
      ],
      NOW
    );
    expect(group!.items.map((i) => i.ticket.id)).toEqual(['late', 'soon', 'later', 'none']);
  });

  it('leaves out empty groups, and finished or cancelled tickets', () => {
    expect(groupTickets([], NOW)).toEqual([]);
    expect(
      groupTickets([ticket('x', { status: 'closed' }), ticket('y', { status: 'cancelled' })], NOW)
    ).toEqual([]);
  });
});
