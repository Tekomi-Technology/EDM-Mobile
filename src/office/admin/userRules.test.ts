import { describe, expect, it, vi } from 'vitest';

vi.mock('../../i18n', () => ({ t: (s: string) => s }));

import { rolesProblem } from './userRules';

describe('rolesProblem: what stops saving the roles of an account', () => {
  it('needs at least one role', () => {
    expect(rolesProblem([], null)).toBe('Choose at least one role.');
  });
  it('allows three roles at most', () => {
    expect(rolesProblem(['admin', 'technical_manager', 'team_manager', 'field_staff'], 't1')).toBe(
      'Choose three roles at most.'
    );
  });
  it('needs a team for field staff and team managers', () => {
    expect(rolesProblem(['field_staff'], null)).toBe('Field staff and team managers need a team.');
    expect(rolesProblem(['team_manager'], null)).toBe('Field staff and team managers need a team.');
  });
  it('lets a supervisor have no team', () => {
    expect(rolesProblem(['technical_manager'], null)).toBeNull();
    expect(rolesProblem(['team_manager'], 't1')).toBeNull();
  });
});
