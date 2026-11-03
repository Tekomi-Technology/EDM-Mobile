import { describe, expect, it, vi } from 'vitest';

vi.mock('../../i18n', () => ({ t: (s: string) => s }));

import type { CustomerMatch } from '../../types';
import {
  canContinue,
  emptyCustomerDraft,
  emptyNewCustomerDraft,
  emptyPlannedDraft,
  type CustomerDraft,
  type PlannedDraft
} from './steps';

const rosa = { id: 'c1', fullName: 'Rosa', openTickets: [] } as unknown as CustomerMatch;

describe('canContinue: why the next step is not open yet', () => {
  it('asks for a customer first', () => {
    expect(canContinue('customer', 'customer', emptyCustomerDraft())).toBe('Find the customer first.');
  });

  it('without a customer, asks what it is about', () => {
    const d: CustomerDraft = { ...emptyCustomerDraft(), noCustomer: true, title: 'x' };
    expect(canContinue('customer', 'customer', d)).toBe('Write what it is about.');
  });

  it('asks for the problem, then for what the caller says', () => {
    const d: CustomerDraft = { ...emptyCustomerDraft(), customer: rosa };
    expect(canContinue('customer', 'problem', d)).toBe('Choose the problem first.');
    expect(canContinue('customer', 'problem', { ...d, problemType: 'no_power_single' })).toBe(
      'Write what the caller says.'
    );
  });

  it('asks for the priority when there is no customer', () => {
    const d: CustomerDraft = {
      ...emptyCustomerDraft(),
      noCustomer: true,
      title: 'Broken door',
      description: 'Meter box door'
    };
    expect(canContinue('customer', 'problem', d)).toBe('Choose the priority.');
  });

  it('lets a complete customer ticket through', () => {
    const d: CustomerDraft = {
      ...emptyCustomerDraft(),
      customer: rosa,
      problemType: 'no_power_single',
      description: 'No power since 9'
    };
    expect(canContinue('customer', 'customer', d)).toBeNull();
    expect(canContinue('customer', 'problem', d)).toBeNull();
    expect(canContinue('customer', 'review', d)).toBeNull();
  });

  it('refuses planned work that ends before it starts, or has no team', () => {
    const d: PlannedDraft = {
      ...emptyPlannedDraft('2026-11-04'),
      title: 'Replace PT-1180',
      element: 'PT-1180'
    };
    expect(canContinue('planned', 'when', { ...d, from: '13:00', to: '08:00' })).toBe(
      'The end must be after the start.'
    );
    expect(canContinue('planned', 'team', d)).toBe('Choose the team that will do it.');
    expect(canContinue('planned', 'team', { ...d, teamId: 't1' })).toBeNull();
  });

  it('asks which survey a connection follows', () => {
    const d = { ...emptyNewCustomerDraft(), mode: 'connection' as const };
    expect(canContinue('new_customer', 'survey', d)).toBe('Choose the survey.');
    expect(canContinue('new_customer', 'survey', { ...d, surveyTicketId: 's1' })).toBeNull();
  });
});
