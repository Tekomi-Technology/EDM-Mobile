import { describe, expect, it } from 'vitest';
import { createChoicesFor, tabsFor } from './shell';

describe('tabsFor: the tabs of the office screens', () => {
  it('starts on My team for team managers', () => {
    expect(tabsFor('team_manager').map((t) => t.label)).toEqual([
      'My team',
      'Tickets',
      'Map',
      'Notifications',
      'Me'
    ]);
  });
  it('starts on Overview for supervisors and administrators', () => {
    for (const layout of ['supervisor', 'admin'] as const) {
      expect(tabsFor(layout).map((t) => t.label)).toEqual([
        'Overview',
        'Tickets',
        'Map',
        'Notifications',
        'Me'
      ]);
    }
  });
  it('uses the same keys for everyone', () => {
    expect(tabsFor('admin').map((t) => t.key)).toEqual(['home', 'tickets', 'map', 'inbox', 'me']);
  });
});

describe('createChoicesFor: what the + button offers', () => {
  it('lets team managers make customer tickets and plan maintenance', () => {
    expect(createChoicesFor('team_manager')).toEqual(['customer', 'planned']);
  });
  it('adds new customers for supervisors and administrators', () => {
    expect(createChoicesFor('supervisor')).toEqual(['customer', 'planned', 'new_customer']);
    expect(createChoicesFor('admin')).toEqual(['customer', 'planned', 'new_customer']);
  });
});
