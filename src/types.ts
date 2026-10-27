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
  'assign' | 'accept' | 'decline' | 'start' | 'hold' | 'resume' | 'resolve' | 'close' | 'reopen' | 'cancel';
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
  'customer_complaint' | 'network_incident' | 'planned_work' | 'new_customer_survey' | 'new_connection';

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

/** The field staff member's van and what is in it (EDM Field app). */
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
