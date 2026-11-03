import type { TicketType } from '../types';
import type { TicketAction } from './actions';

/**
 * Taps that are hard to undo ask first (English text; the caller translates, {0} is the ticket code). Closing a
 * network incident also closes the tickets linked to it and texts every caller.
 */
export function confirmFor(
  action: TicketAction,
  type: TicketType
): { title: string; message: string } | null {
  if (action === 'close') {
    return {
      title: 'Close {0}?',
      message:
        type === 'network_incident'
          ? 'The customer tickets linked to it are closed too, and each caller gets an SMS.'
          : 'The ticket is closed as fixed.'
    };
  }
  if (action === 'reopen')
    return { title: 'Reopen {0}?', message: 'It goes back to the team to be fixed again.' };
  if (action === 'notify_customers') {
    return { title: 'Text the customers of {0}?', message: 'Every customer linked to it gets an SMS.' };
  }
  return null;
}
