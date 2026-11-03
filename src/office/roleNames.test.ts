import { describe, expect, it, vi } from 'vitest';

vi.mock('../i18n', () => ({ t: (s: string) => s }));

import { ROLE_NAMES, roleNames } from './roleNames';

describe('roleNames: the roles as people read them', () => {
  it('names the roles highest first', () => {
    expect(roleNames(['team_manager', 'technical_manager'])).toBe('Operations supervisor, Team manager');
  });
  it('says No role when none the app knows is left', () => {
    expect(roleNames([])).toBe('No role');
    expect(roleNames(['noc', 'bo_support'])).toBe('No role');
  });
  it('lists exactly the four roles', () => {
    expect(ROLE_NAMES.map((r) => r.role)).toEqual([
      'admin',
      'technical_manager',
      'team_manager',
      'field_staff'
    ]);
  });
});
