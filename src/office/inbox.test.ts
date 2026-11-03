import { describe, expect, it } from 'vitest';
import { openTarget } from './inbox';

describe('openTarget: where a notification leads in the app', () => {
  it('opens a ticket', () => {
    expect(openTarget('/tickets/0f9c1f2e-1d2b-4c3a-9e8f-123456789abc')).toEqual({
      kind: 'ticket',
      id: '0f9c1f2e-1d2b-4c3a-9e8f-123456789abc'
    });
  });
  it('opens the help requests', () => {
    expect(openTarget('/help')).toEqual({ kind: 'help' });
    expect(openTarget('/help/0f9c1f2e-1d2b-4c3a-9e8f-123456789abc')).toEqual({ kind: 'help' });
  });
  it('goes nowhere without a link, or for a page the app does not have', () => {
    expect(openTarget(null)).toBeNull();
    expect(openTarget('/admin/users')).toBeNull();
    expect(openTarget('/tickets/not-an-id')).toBeNull();
  });
});
