/**
 * The data formats of the EDM Tasks API, as this app uses them. The API's own definitions
 * (EDM-Task-Management, apps/api/src/contract) are the reference: when the API changes, change this file to match.
 */

// ---- Value lists ----

export type AlarmSeverity = 'critical' | 'major' | 'minor' | 'warning';
export type HelpStatus = 'new' | 'in_progress' | 'solved';
export type PlannedWorkKind = 'maintenance' | 'network_change';
export type PremisesType = 'home' | 'shop' | 'school' | 'business' | 'farm' | 'other';
export type StockUnit = 'pcs' | 'm' | 'kg' | 'set';
export type SupplyType = 'single_phase' | 'three_phase';
export type SurveyResult = 'feasible' | 'feasible_with_works' | 'not_feasible';
export type TicketAction =
  | 'assign'
  | 'claim'
  | 'accept'
  | 'decline'
  | 'start'
  | 'hold'
  | 'resume'
  | 'resolve'
  | 'close'
  | 'reopen'
  | 'cancel';
export type TicketSource = 'call_center' | 'sales' | 'nms' | 'network_team' | 'office';
export type TicketStatus =
  | 'new'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'on_hold'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'cancelled';
export type TicketType =
  | 'customer_complaint'
  | 'network_incident'
  | 'planned_work'
  | 'new_customer_survey'
  | 'new_connection'
  | 'other';

/** What help field staff can ask the back office for. */
export const HELP_KINDS = ['second_person', 'truck', 'material', 'switch_off', 'advice', 'other'] as const;
export type HelpKind = (typeof HELP_KINDS)[number];

/** Request header with the time an action really happened on the phone (actions sent later, after being offline). */
export const OCCURRED_AT_HEADER = 'x-occurred-at';

// ---- Responses ----

/** Shapes returned by the API. */
export interface TicketSummary {
  id: string;
  code: string;
  type: TicketType;
  source: TicketSource;
  /** Customer problem type, network report type, or planned work kind. */
  problemType: string | null;
  status: TicketStatus;
  priority: number;
  title: string;
  areaName: string | null;
  teamId: string | null;
  teamName: string | null;
  assignee: { id: string; fullName: string } | null;
  customerName: string | null;
  /** Customer's address, where the job is. */
  address: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketEventView {
  id: string;
  type: string;
  actorName: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface AttachmentView {
  id: string;
  fileName: string;
  contentType: string;
  url: string | null;
  createdAt: string;
}

export interface TicketOffer {
  teamName: string;
  /** Field staff told the last time (everyone of the team except those who gave it back). */
  notified: string[];
  /** 1 the first time, then one more each time the team is told again. */
  round: number;
  at: string;
}

/** A job offered to the whole team that nobody has claimed yet (GET /me/offers): whoever claims it first has it. */
export interface TeamOffer extends TicketSummary {
  /** Metres from the staff member's last known position, when both are known. */
  distanceM: number | null;
  offer: TicketOffer | null;
}

export interface TicketDetail extends TicketSummary {
  description: string;
  externalRef: string | null;
  customer: {
    id: string;
    /** Empty for a new customer who has no contract yet. */
    contractNo: string | null;
    meterNumber: string | null;
    fullName: string;
    phone: string | null;
    address: string;
  } | null;
  location: { lat: number; lng: number } | null;
  events: TicketEventView[];
  attachments: AttachmentView[];
  allowedActions: TicketAction[];
  /** Network incidents: the element, severity, alarms and the customer tickets linked to it. */
  network: NetworkInfo | null;
  /** Planned work: when, and whether power is cut. */
  planned: PlannedInfo | null;
  /** Customer tickets caused by a known network incident. */
  incident: { id: string; code: string; title: string; status: TicketStatus } | null;
  /** 0 = on time; 1 = staff reminded; 2 = late, team manager and NOC told; 3 = badly late, technical manager told. */
  escalationLevel: number;
  /** While nobody has claimed it: the last time the team was told, and who. */
  offer: TicketOffer | null;
  /** Materials recorded on the job; deducted from stock when the ticket closes. */
  materials: TicketMaterialView[];
  /** Materials set aside in a depot for this ticket. */
  reservations: ReservationView[];
  /** Surveys and connections for new customers. */
  newCustomer: NewCustomerInfo | null;
}

export interface TicketMaterialView {
  id: string;
  itemId: string;
  code: string;
  name: string;
  unit: StockUnit;
  quantity: number;
  /** Where it was taken from (the van). */
  fromLocation: string | null;
  /** Deducted from stock (the ticket has closed). */
  posted: boolean;
  recordedBy: string | null;
  recordedAt: string;
}

export interface ReservationView {
  id: string;
  itemId: string;
  code: string;
  name: string;
  unit: StockUnit;
  quantity: number;
  locationName: string;
}

export interface NewCustomerInfo {
  kind: 'survey' | 'connection';
  premises: PremisesType | null;
  supply: SupplyType | null;
  requestedLoadKw: number | null;
  contractNo: string | null;
  /** The survey this connection follows. */
  surveyTicket: { id: string; code: string } | null;
  survey: {
    result: SurveyResult;
    distanceToNetworkM: number | null;
    nearestElement: string | null;
    worksNeeded: string | null;
    estimatedMaterials: { itemId: string; code: string; name: string; unit: StockUnit; quantity: number }[];
  } | null;
  installation: {
    meterNumber: string;
    sealNumber: string | null;
    confirmedBy: 'sms_code' | 'signed_form';
    confirmedAt: string;
  } | null;
  /** When the Sales system activated the service. */
  activatedAt: string | null;
  /** A handover code has been sent to the customer and not used yet. */
  handoverCodeSentAt: string | null;
}

export interface AlarmView {
  id: string;
  alarmId: string;
  elementCode: string;
  elementName: string | null;
  alarmType: string;
  severity: AlarmSeverity;
  raisedAt: string;
  clearedAt: string | null;
}

export interface NetworkInfo {
  elementCode: string | null;
  elementName: string | null;
  severity: AlarmSeverity | null;
  customersAffected: number | null;
  alarms: AlarmView[];
  activeAlarms: number;
  linkedTickets: TicketSummary[];
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
}

export interface PlannedInfo {
  kind: PlannedWorkKind;
  element: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  outage: boolean;
  customersAffected: number | null;
}

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  roles: string[];
  teamId: string | null;
  teamName: string | null;
  onDuty: boolean;
}

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface StockLine {
  itemId: string;
  code: string;
  name: string;
  unit: StockUnit;
  quantity: number;
  reserved: number;
}

export interface VehicleView {
  id: string;
  plate: string;
  label: string | null;
  teamId: string;
  teamName: string;
  locationId: string;
  assignedTo: { id: string; fullName: string } | null;
  /** Kinds of material on board. */
  itemsOnBoard: number;
}

/** The field staff member's van and what is in it (EDM Service app). */
export interface MyVan {
  vehicle: VehicleView | null;
  lines: StockLine[];
  /** The whole catalogue, for recording material not carried in the van. */
  catalog: { id: string; code: string; name: string; unit: StockUnit }[];
}

export interface HelpMessageView {
  id: string;
  authorName: string;
  fromField: boolean;
  body: string;
  createdAt: string;
}

export interface HelpRequestView {
  id: string;
  kind: HelpKind;
  message: string;
  status: HelpStatus;
  ticket: { id: string; code: string; title: string } | null;
  requestedBy: { id: string; fullName: string; phone: string | null };
  teamName: string | null;
  handledBy: string | null;
  createdAt: string;
  updatedAt: string;
  messages: HelpMessageView[];
}

// ---- Requests ----

/** Material used on a job, from the van. */
export interface MaterialLine {
  itemId: string;
  quantity: number;
}

/** New customer survey report (finishing a survey job). */
export interface SurveyReport {
  result: SurveyResult;
  /** Metres from the premises to the nearest point of the network. */
  distanceToNetworkM?: number;
  nearestElement?: string;
  /** Works needed first, when feasible with works or not feasible. */
  worksNeeded?: string;
  estimatedMaterials: MaterialLine[];
}

/** POST /help-requests */
export interface HelpRequestInput {
  kind: HelpKind;
  message: string;
  ticketId?: string;
}

// ---- Office screens (team managers, operations supervisors, administrators) ----
// Copied from EDM-Task-Management apps/api/src/contract/api-types.ts.

/** A network incident in the list of the Network incidents screen. */
export interface IncidentSummary extends TicketSummary {
  severity: AlarmSeverity | null;
  elementCode: string | null;
  alarmCount: number;
  activeAlarms: number;
  customersAffected: number | null;
  linkedTickets: number;
  acknowledgedAt: string | null;
  lastAlarmAt: string | null;
}

export type StaffState = 'on_job' | 'free' | 'offline' | 'off_duty';

export interface StaffLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  at: string;
}

/** A field staff member on the live map and the Field staff screen. */
export interface StaffLive {
  id: string;
  fullName: string;
  phone: string | null;
  teamId: string | null;
  teamName: string | null;
  state: StaffState;
  location: StaffLocation | null;
  currentJob: { id: string; code: string; title: string; status: TicketStatus } | null;
  openJobs: number;
  doneToday: number;
}

export interface LiveMap {
  staff: StaffLive[];
  tickets: MapTicket[];
  areas: { id: string; name: string; boundary: [number, number][][][] }[];
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  teamId: string | null;
  teamName: string | null;
  areaName: string | null;
  status: 'active' | 'blocked' | 'cancelled';
  onDuty: boolean;
  /** Last time they used the system; null = has not signed in yet. */
  lastSeenAt: string | null;
  createdAt: string;
}

/** Number of tickets in each tab of the Tickets screen, within what the caller may see. */
export type TicketCounts = Record<
  'active' | 'unassigned' | 'late' | 'waiting_check' | 'closed_today' | 'incidents' | 'help',
  number
>;

export interface Lookups {
  areas: { id: string; name: string }[];
  teams: { id: string; name: string; areaId: string; areaName: string }[];
}

export interface MapTicket {
  id: string;
  type: TicketType;
  code: string;
  title: string;
  status: TicketStatus;
  lat: number;
  lng: number;
  late: boolean;
}

/** Figures and lists for the Overview screen. */
export interface Overview {
  open: number;
  newToday: number;
  beingFixed: number;
  staffOnDuty: number;
  waitingCheck: number;
  waitingCallCenter: number;
  late: number;
  attention: TicketSummary[];
  unassigned: TicketSummary[];
  map: MapTicket[];
}

export interface ReportTeamRow {
  teamId: string;
  teamName: string;
  closed: number;
  /** Share of tickets fixed within their time limit (null when none had one). */
  onTimePct: number | null;
  avgFixMinutes: number | null;
  reopenedPct: number | null;
}

export interface ReportStaffRow {
  userId: string;
  fullName: string;
  teamName: string | null;
  fixed: number;
  onTimePct: number | null;
  avgFixMinutes: number | null;
  firstTimePct: number | null;
}

export interface ReportMaterialRow {
  itemId: string;
  code: string;
  name: string;
  unit: StockUnit;
  quantity: number;
  tickets: number;
}

export interface Report {
  from: string;
  to: string;
  /** The same KPI over the period of the same length just before. */
  closed: number;
  closedBefore: number;
  onTimePct: number | null;
  onTimeTarget: number;
  /** Mean time to repair: ticket created → reported fixed (planned work left out). */
  mttrMinutes: number | null;
  /** Closed without the check ever finding the job not done. */
  firstTimePct: number | null;
  received: number;
  stillOpen: number;
  perDay: { day: string; closed: number }[];
  byType: { type: TicketType; closed: number }[];
  byTeam: ReportTeamRow[];
  byStaff: ReportStaffRow[];
  incidents: {
    count: number;
    avgRestoreMinutes: number | null;
    customersAffected: number;
    alarms: number;
  };
  newCustomers: {
    surveysDone: number;
    avgSurveyDays: number | null;
    connectionsDone: number;
    avgConnectionDays: number | null;
    waitingActivation: number;
  };
  materials: ReportMaterialRow[];
}

export interface CustomerMatch {
  id: string;
  fullName: string;
  contractNo: string | null;
  meterNumber: string | null;
  phone: string | null;
  address: string;
  location: { lat: number; lng: number } | null;
  areaName: string | null;
  teamName: string | null;
  /** Tickets of this customer not finished yet, so the same problem is not entered twice. */
  openTickets: { id: string; code: string; title: string; status: TicketStatus }[];
}

export interface TicketPreview {
  /** The team that goes: the one chosen, or else the team covering the place. */
  team: { id: string; name: string } | null;
  /** The team covering the place, whatever was chosen. */
  autoTeam: { id: string; name: string } | null;
  areaName: string | null;
  /** How many field staff of the team are told about it; 0: nobody is left, the team manager chooses someone. */
  teamStaff: number;
  priority: number;
  slaMinutes: number;
  dueAt: string;
  /** An open network incident close to the customer, for "Is this the same problem?". */
  incident: {
    id: string;
    code: string;
    title: string;
    elementName: string | null;
    linkedCustomers: number;
  } | null;
  /** The SMS the caller gets: as a new job, or as part of the known incident. */
  sms: { newJob: string; knownOutage: string | null } | null;
}

export interface InboxItem {
  id: string;
  title: string;
  /** Where clicking it goes, e.g. /tickets/<id> or /help. */
  link: string | null;
  createdAt: string;
  read: boolean;
}

export interface Inbox {
  unread: number;
  items: InboxItem[];
}

export interface StaffMember {
  id: string;
  fullName: string;
  phone: string | null;
  onDuty: boolean;
  openJobs: number;
}

export interface StaffSuggestion extends StaffMember {
  /** Straight-line distance from the staff member's last known position to the ticket, in metres. */
  distanceM: number | null;
  /** When that position was recorded. */
  locationAt: string | null;
  /** Jobs they reported done today. */
  doneToday: number;
  /** The best choice when the office names someone: on duty, fewest unfinished jobs, nearest. */
  bestMatch: boolean;
}

export interface WaitingSurvey {
  ticketId: string;
  code: string;
  customer: { fullName: string; phone: string | null; address: string | null } | null;
  premises: PremisesType | null;
  supply: SupplyType | null;
  requestedLoadKw: number | null;
  result: SurveyResult;
  distanceToNetworkM: number | null;
  nearestElement: string | null;
  worksNeeded: string | null;
  surveyedBy: string | null;
  surveyedAt: string | null;
}

/** Problem types a customer ticket can have (apps/api/src/contract/ticket.ts PROBLEM_TYPES). */
export const PROBLEM_TYPES = {
  no_power_single: { label: 'No power, one home', priority: 2 },
  no_power_street: { label: 'No power, whole street', priority: 1 },
  low_voltage: { label: 'Low or unstable voltage', priority: 3 },
  prepaid_meter: { label: 'Prepaid meter problem', priority: 3 },
  cable_down: { label: 'Cable down or danger', priority: 1 },
  other: { label: 'Something else', priority: 3 }
} as const;
export type ProblemType = keyof typeof PROBLEM_TYPES;

// Request bodies (apps/api/src/contract/schemas.ts).
export interface Point {
  lat: number;
  lng: number;
}
export interface TeamChoice {
  teamId?: string;
  teamReason?: string;
}
export type OfficeTicketBody =
  | ({
      type: 'customer_complaint';
      customerId: string;
      problemType: ProblemType;
      description: string;
      priority?: number;
      callerPhone?: string;
      joinIncident?: boolean;
    } & TeamChoice)
  | ({
      type: 'other';
      title: string;
      description: string;
      priority: number;
      customerId?: string;
      address?: string;
      location?: Point;
      callerPhone?: string;
    } & TeamChoice);
export interface PlannedWorkBody {
  kind: PlannedWorkKind;
  title: string;
  element: string;
  teamId: string;
  scheduledStart: string;
  scheduledEnd: string;
  outage: boolean;
  customersAffected?: number;
  description?: string;
  location?: Point;
}
export interface Prospect {
  fullName: string;
  phone?: string;
  address: string;
  location?: Point;
}
export interface OfficeSurveyBody extends TeamChoice {
  customer: Prospect;
  premises: PremisesType;
  supply: SupplyType;
  requestedLoadKw?: number;
  notes?: string;
}
export interface OfficeConnectionBody {
  contractNo: string;
  surveyTicketId?: string;
  customer?: Prospect;
  premises?: PremisesType;
  supply?: SupplyType;
  notes?: string;
}
export interface UserPatch {
  fullName?: string;
  email?: string;
  phone?: string;
  roles?: string[];
  teamId?: string | null;
}
