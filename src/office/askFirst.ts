import { Alert } from 'react-native';
import { t } from '../i18n';
import type { TicketType } from '../types';
import type { TicketAction } from './actions';
import { confirmFor } from './confirm';

/** Runs the action, after a yes for the ones that are hard to undo (close, reopen, texting customers). */
export function askFirst(action: TicketAction, type: TicketType, code: string, run: () => void): void {
  const c = confirmFor(action, type);
  if (!c) return run();
  Alert.alert(t(c.title, { 0: code }), t(c.message), [
    { text: t('Not now'), style: 'cancel' },
    { text: t('Continue'), onPress: run }
  ]);
}
