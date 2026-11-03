import { describe, expect, it } from 'vitest';
import { layoutFor, pickLayout } from './roles';

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

describe('pickLayout: saved roles and the answer from the server', () => {
  it('opens the field app when nothing is known yet', () => {
    expect(pickLayout(null, null)).toBe('field');
  });
  it('uses the saved roles when the phone is offline', () => {
    expect(pickLayout(['team_manager'], null)).toBe('team_manager');
  });
  it('lets the server answer win over the saved roles', () => {
    expect(pickLayout(['team_manager'], ['field_staff'])).toBe('field');
  });
});
