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

/**
 * The screens to show now, or null to keep waiting. Saved roles open at once; with nothing saved the app waits for
 * /me (so an office person never sees the field app first), and opens the field app only if /me could not be had.
 * `settled` is true once /me has answered or failed.
 */
export function decideLayout(
  saved: readonly string[] | null | undefined,
  fetched: readonly string[] | null,
  settled: boolean
): Layout | null {
  if (saved === undefined) return null;
  if (fetched) return layoutFor(fetched);
  if (saved) return layoutFor(saved);
  return settled ? 'field' : null;
}
