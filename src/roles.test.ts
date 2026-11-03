import { describe, expect, it } from 'vitest';
import { decideLayout, layoutFor } from './roles';

describe('layoutFor: the highest role decides the screens', () => {
  it('gives field staff the field app', () => {
    expect(layoutFor(['field_staff'])).toBe('field');
  });
  it('gives team managers their team screens', () => {
    expect(layoutFor(['team_manager'])).toBe('team_manager');
  });
  it('lets the supervisor role win over team manager', () => {
    expect(layoutFor(['team_manager', 'technical_manager'])).toBe('supervisor');
  });
  it('lets admin win over everything', () => {
    expect(layoutFor(['field_staff', 'admin'])).toBe('admin');
  });
  it('falls back to the field app for no role or a role the app does not know', () => {
    expect(layoutFor([])).toBe('field');
    expect(layoutFor(['noc'])).toBe('field');
  });
});

describe('decideLayout: which screens to open while /me is on its way', () => {
  it('waits while the saved roles are being read', () => {
    expect(decideLayout(undefined, null, false)).toBeNull();
  });
  it('waits for the server when nothing is saved, so office people never see the field app first', () => {
    expect(decideLayout(null, null, false)).toBeNull();
  });
  it('opens the field app when nothing is saved and the server cannot be reached', () => {
    expect(decideLayout(null, null, true)).toBe('field');
  });
  it('opens the saved screens at once', () => {
    expect(decideLayout(['team_manager'], null, false)).toBe('team_manager');
  });
  it('follows the server when it answers', () => {
    expect(decideLayout(null, ['admin'], true)).toBe('admin');
  });
});
