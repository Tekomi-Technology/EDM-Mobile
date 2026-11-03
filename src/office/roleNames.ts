import { t } from '../i18n';

/** The four roles, highest first, with the names people see. */
export const ROLE_NAMES: { role: string; name: string }[] = [
  { role: 'admin', name: 'Administrator' },
  { role: 'technical_manager', name: 'Operations supervisor' },
  { role: 'team_manager', name: 'Team manager' },
  { role: 'field_staff', name: 'Field staff' }
];

/** "Operations supervisor, Team manager", or "No role" when none the app knows is left. */
export function roleNames(roles: readonly string[]): string {
  const known = ROLE_NAMES.filter((r) => roles.includes(r.role)).map((r) => t(r.name));
  return known.length ? known.join(', ') : t('No role');
}
