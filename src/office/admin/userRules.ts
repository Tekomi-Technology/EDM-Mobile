import { t } from '../../i18n';

/** Why these roles cannot be saved (the same rules as the API), or null. */
export function rolesProblem(roles: readonly string[], teamId: string | null): string | null {
  if (roles.length === 0) return t('Choose at least one role.');
  if (roles.length > 3) return t('Choose three roles at most.');
  if (!teamId && roles.some((r) => r === 'field_staff' || r === 'team_manager')) {
    return t('Field staff and team managers need a team.');
  }
  return null;
}
