import { describe, expect, it } from 'vitest';
import type { CurrentUser, TicketDetail } from '../types';
import { actionsFor } from './actions';

const me = (roles: string[], teamId: string | null = 't1'): CurrentUser =>
  ({ id: 'u1', username: 'x', fullName: 'X', roles, teamId, teamName: null, onDuty: false }) as CurrentUser;

const ticket = (over: Partial<TicketDetail>): TicketDetail =>
  ({
    id: 'k1',
    code: 'TK-1',
    type: 'customer_complaint',
    status: 'new',
    teamId: 't1',
    assignee: null,
    allowedActions: [],
    network: null,
    ...over
  }) as TicketDetail;

describe('actionsFor: the buttons on a ticket, only what the server allows', () => {
  it('gives a team manager the waiting job of their team: assign, offer, cancel, note', () => {
    const t = ticket({ status: 'new', allowedActions: ['assign', 'cancel'] });
    expect(actionsFor(t, me(['team_manager']))).toEqual(['assign', 'offer', 'cancel', 'note']);
  });

  it("gives a team manager only a note on another team's ticket", () => {
    const t = ticket({ status: 'new', teamId: 't2', allowedActions: [] });
    expect(actionsFor(t, me(['team_manager']))).toEqual(['note']);
  });

  it('lets a supervisor close, reopen and acknowledge a resolved network incident', () => {
    const t = ticket({
      type: 'network_incident',
      status: 'resolved',
      allowedActions: ['close', 'reopen', 'cancel'],
      network: { acknowledgedAt: null } as TicketDetail['network']
    });
    const actions = actionsFor(t, me(['technical_manager'], null));
    expect(actions.slice(0, 3)).toEqual(['close', 'reopen', 'acknowledge']);
    expect(actions).toContain('notify_customers');
    expect(actions).not.toContain('change_team');
  });

  it('does not offer close to a team manager when the server does not allow it', () => {
    const t = ticket({ status: 'resolved', allowedActions: ['cancel'] });
    expect(actionsFor(t, me(['team_manager']))).not.toContain('close');
  });

  it('offers nothing on a cancelled ticket', () => {
    expect(actionsFor(ticket({ status: 'cancelled' }), me(['admin'], null))).toEqual([]);
  });

  it('lets supervisors take a job back and move it to another team', () => {
    const t = ticket({
      status: 'in_progress',
      assignee: { id: 's1', fullName: 'Ana' },
      allowedActions: ['assign', 'cancel']
    });
    expect(actionsFor(t, me(['technical_manager'], null))).toEqual([
      'assign',
      'take_back',
      'change_team',
      'cancel',
      'note'
    ]);
  });
});
