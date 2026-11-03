import type { Layout } from '../roles';

export type OfficeLayout = Exclude<Layout, 'field'>;
export type OfficeTab = 'home' | 'tickets' | 'map' | 'inbox' | 'me';
export type CreateChoice = 'customer' | 'planned' | 'new_customer';

/** Feather icon names, kept as plain strings so this file has no React Native import. */
export function tabsFor(layout: OfficeLayout): { key: OfficeTab; label: string; icon: string }[] {
  return [
    { key: 'home', label: layout === 'team_manager' ? 'My team' : 'Overview', icon: 'grid' },
    { key: 'tickets', label: 'Tickets', icon: 'list' },
    { key: 'map', label: 'Map', icon: 'map-pin' },
    { key: 'inbox', label: 'Notifications', icon: 'bell' },
    { key: 'me', label: 'Me', icon: 'user' }
  ];
}

/** New customers (surveys, connections) are for supervisors and administrators, as on the website. */
export function createChoicesFor(layout: OfficeLayout): CreateChoice[] {
  return layout === 'team_manager' ? ['customer', 'planned'] : ['customer', 'planned', 'new_customer'];
}
