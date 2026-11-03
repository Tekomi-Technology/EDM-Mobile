import { t } from '../../i18n';
import type { CustomerMatch, PlannedWorkKind, PremisesType, ProblemType, SupplyType } from '../../types';

export const customerSteps = ['customer', 'problem', 'review'] as const;
export const plannedSteps = ['what', 'when', 'team', 'review'] as const;
export const newCustomerSteps = ['survey', 'details', 'review'] as const;

export interface CustomerDraft {
  customer: CustomerMatch | null;
  /** "Something else", without a customer of EDM: then a title and a priority are needed. */
  noCustomer: boolean;
  title: string;
  address: string;
  problemType: ProblemType | null;
  priority: number | null;
  description: string;
  callerPhone: string;
  /** Another team than the one of the place (supervisors, administrators), with the reason. */
  teamId: string | null;
  teamReason: string;
}
export const emptyCustomerDraft = (): CustomerDraft => ({
  customer: null,
  noCustomer: false,
  title: '',
  address: '',
  problemType: null,
  priority: null,
  description: '',
  callerPhone: '',
  teamId: null,
  teamReason: ''
});

export interface PlannedDraft {
  kind: PlannedWorkKind;
  title: string;
  element: string;
  /** YYYY-MM-DD, Mozambique time. */
  date: string;
  from: string;
  to: string;
  outage: boolean;
  customersAffected: string;
  description: string;
  teamId: string | null;
}
export const emptyPlannedDraft = (date: string): PlannedDraft => ({
  kind: 'maintenance',
  title: '',
  element: '',
  date,
  from: '08:00',
  to: '13:00',
  outage: false,
  customersAffected: '',
  description: '',
  teamId: null
});

export interface NewCustomerDraft {
  /** A survey first, or the connection after a finished survey. */
  mode: 'survey' | 'connection';
  surveyTicketId: string | null;
  contractNo: string;
  fullName: string;
  phone: string;
  address: string;
  premises: PremisesType;
  supply: SupplyType;
  notes: string;
}
export const emptyNewCustomerDraft = (): NewCustomerDraft => ({
  mode: 'survey',
  surveyTicketId: null,
  contractNo: '',
  fullName: '',
  phone: '',
  address: '',
  premises: 'home',
  supply: 'single_phase',
  notes: ''
});

type Flow =
  | ['customer', (typeof customerSteps)[number], CustomerDraft]
  | ['planned', (typeof plannedSteps)[number], PlannedDraft]
  | ['new_customer', (typeof newCustomerSteps)[number], NewCustomerDraft];

/** Why the person cannot go on from this step (the same words as the website forms), or null. */
export function canContinue<F extends Flow>(flow: F[0], step: F[1], draft: F[2]): string | null {
  if (flow === 'customer') {
    const d = draft as CustomerDraft;
    if (step === 'customer' || step === 'problem' || step === 'review') {
      if (!d.noCustomer && !d.customer) return t('Find the customer first.');
      if (d.noCustomer && d.title.trim().length < 3) return t('Write what it is about.');
    }
    if (step === 'problem' || step === 'review') {
      if (!d.noCustomer && !d.problemType) return t('Choose the problem first.');
      if (d.noCustomer && !d.priority) return t('Choose the priority.');
      if (d.description.trim().length < 3) {
        return d.noCustomer ? t('Write what needs to be done.') : t('Write what the caller says.');
      }
      if (d.teamId && d.teamReason.trim().length < 3) return t('Say why another team goes');
    }
    return null;
  }
  if (flow === 'planned') {
    const d = draft as PlannedDraft;
    if (d.title.trim().length < 3) return t('Write what it is about.');
    if (step === 'what') return null;
    if (d.to <= d.from) return t('The end must be after the start.');
    if (step === 'when') return null;
    if (!d.teamId) return t('Choose the team that will do it.');
    return null;
  }
  const d = draft as NewCustomerDraft;
  if (d.mode === 'connection') {
    if (!d.surveyTicketId) return t('Choose the survey.');
    if (step !== 'survey' && !d.contractNo.trim()) return t('Write the contract number.');
    return null;
  }
  if (step !== 'survey' && (d.fullName.trim().length < 2 || d.address.trim().length < 3)) {
    return t('Write the name and the address of the customer.');
  }
  return null;
}
