/** Which set of screens the app shows. The highest role decides: admin > supervisor > team manager > field staff. */
export type Layout = 'field' | 'team_manager' | 'supervisor' | 'admin';

/** Where the phone keeps the roles of the person signed in, so the right screens open without signal. */
export const SAVED_ROLES_KEY = 'edm.roles';

export function layoutFor(roles: readonly string[]): Layout {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('technical_manager')) return 'supervisor';
  if (roles.includes('team_manager')) return 'team_manager';
  // Field staff, and anything the app does not know: the field app, as before.
  return 'field';
}

/** The server's answer wins; offline, the roles saved on the phone; with neither, the field app. */
export function pickLayout(saved: readonly string[] | null, fetched: readonly string[] | null): Layout {
  return layoutFor(fetched ?? saved ?? []);
}
