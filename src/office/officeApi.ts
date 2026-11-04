import { api } from '../api';
import type {
  AdminUser,
  CurrentUser,
  CustomerMatch,
  HelpRequestView,
  HelpStatus,
  IncidentSummary,
  Inbox,
  LiveMap,
  Lookups,
  OfficeConnectionBody,
  OfficeSurveyBody,
  OfficeTicketBody,
  Overview,
  PlannedWorkBody,
  Point,
  Report,
  StaffMember,
  StaffSuggestion,
  TicketCounts,
  TicketDetail,
  TicketPreview,
  TicketSummary,
  UserPatch,
  WaitingSurvey
} from '../types';

const q = (params: Record<string, string | number | undefined>) => {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return s ? `?${s}` : '';
};
const post = <T>(token: string, path: string, body: unknown = {}) =>
  api<T>(token, path, { method: 'POST', body });

/** The API endpoints the office screens use, the same ones the website calls. */
export const officeApi = {
  /** GET /tickets answers one page, { items, total }; the screens need only the tickets. */
  tickets: (token: string, query: { view?: string; q?: string; teamId?: string; limit?: number } = {}) =>
    api<{ items: TicketSummary[]; total: number }>(token, `/tickets${q(query)}`).then((page) => page.items),
  counts: (token: string) => api<TicketCounts>(token, '/tickets/counts'),
  overview: (token: string) => api<Overview>(token, '/overview'),
  lookups: (token: string) => api<Lookups>(token, '/lookups'),
  ticket: (token: string, id: string) => api<TicketDetail>(token, `/tickets/${id}`),

  assign: (token: string, id: string, body: { assigneeId: string }) =>
    post<TicketDetail>(token, `/tickets/${id}/assign`, body),
  offer: (token: string, id: string) => post<TicketDetail>(token, `/tickets/${id}/offer`),
  takeBack: (token: string, id: string, body: { reason: string }) =>
    post<TicketDetail>(token, `/tickets/${id}/take-back`, body),
  cancel: (token: string, id: string, body: { reason: string }) =>
    post<TicketDetail>(token, `/tickets/${id}/cancel`, body),
  close: (token: string, id: string, body: { note?: string } = {}) =>
    post<TicketDetail>(token, `/tickets/${id}/close`, body),
  reopen: (token: string, id: string, body: { note?: string } = {}) =>
    post<TicketDetail>(token, `/tickets/${id}/reopen`, body),
  note: (token: string, id: string, body: { text: string; notifyAssignee?: boolean }) =>
    post<TicketDetail>(token, `/tickets/${id}/notes`, body),
  changeTeam: (token: string, id: string, body: { teamId: string; reason?: string }) =>
    post<TicketDetail>(token, `/tickets/${id}/team`, body),
  acknowledge: (token: string, id: string) => post<TicketDetail>(token, `/tickets/${id}/acknowledge`),
  notifyCustomers: (token: string, incidentId: string, body: { message?: string } = {}) =>
    post<{ sent: number }>(token, `/incidents/${incidentId}/notify-customers`, body),

  incidents: (token: string) => api<IncidentSummary[]>(token, '/incidents'),
  live: (token: string) => api<LiveMap>(token, '/live'),
  teamStaff: (token: string, teamId: string) => api<StaffMember[]>(token, `/teams/${teamId}/staff`),
  suggestions: (token: string, teamId: string, ticketId?: string) =>
    api<StaffSuggestion[]>(token, `/teams/${teamId}/suggestions${q({ ticketId })}`),

  helpRequests: (token: string) => api<HelpRequestView[]>(token, '/help-requests'),
  helpRequest: (token: string, id: string) => api<HelpRequestView>(token, `/help-requests/${id}`),
  helpReply: (token: string, id: string, body: { body: string; status?: HelpStatus }) =>
    post<HelpRequestView>(token, `/help-requests/${id}/messages`, body),

  inbox: (token: string) => api<Inbox>(token, '/me/notifications'),
  inboxRead: (token: string, body: { ids?: string[] } = {}) =>
    post<void>(token, '/me/notifications/read', body),

  customers: (token: string, text: string) =>
    api<CustomerMatch[]>(token, `/customers/lookup${q({ q: text })}`),
  placeTeam: (token: string, at: Point) =>
    api<{ team: { id: string; name: string } | null; areaName: string | null }>(
      token,
      `/places/team${q({ lat: at.lat, lng: at.lng })}`
    ),
  preview: (token: string, body: unknown) => post<TicketPreview>(token, '/tickets/preview', body),
  createTicket: (token: string, body: OfficeTicketBody) =>
    post<{ id: string; code: string; status: string; assigneeName: string | null }>(token, '/tickets', body),
  plannedWork: (token: string, body: PlannedWorkBody) => post<TicketDetail>(token, '/planned-work', body),
  surveysWaiting: (token: string) => api<WaitingSurvey[]>(token, '/new-customers/surveys/waiting'),
  createSurvey: (token: string, body: OfficeSurveyBody) =>
    post<{ id: string; code: string }>(token, '/new-customers/surveys', body),
  createConnection: (token: string, body: OfficeConnectionBody) =>
    post<{ id: string; code: string }>(token, '/new-customers/connections', body),

  /** The last 30 days, as the Reports screen shows by default. */
  report: (token: string, from: string, to: string) => api<Report>(token, `/reports${q({ from, to })}`),

  users: (token: string, query: { search?: string; role?: string; status?: string } = {}) =>
    api<AdminUser[]>(token, `/admin/users${q(query)}`),
  patchUser: (token: string, id: string, body: UserPatch) =>
    api<AdminUser>(token, `/admin/users/${id}`, { method: 'PATCH', body }),
  resetPassword: (token: string, id: string) =>
    post<{ temporaryPassword: string }>(token, `/admin/users/${id}/reset-password`),
  block: (token: string, id: string) => post<AdminUser>(token, `/admin/users/${id}/block`),
  unblock: (token: string, id: string) => post<AdminUser>(token, `/admin/users/${id}/unblock`),
  me: (token: string) => api<CurrentUser>(token, '/me')
};
