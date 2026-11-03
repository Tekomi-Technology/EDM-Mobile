const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where a notification of the bell leads: a ticket, the help requests, or nowhere the app has. */
export function openTarget(link: string | null): { kind: 'ticket'; id: string } | { kind: 'help' } | null {
  if (!link) return null;
  const ticket = /^\/tickets\/([^/?#]+)/.exec(link);
  if (ticket) return UUID.test(ticket[1]!) ? { kind: 'ticket', id: ticket[1]! } : null;
  if (link === '/help' || link.startsWith('/help/') || link.startsWith('/help?')) return { kind: 'help' };
  return null;
}
