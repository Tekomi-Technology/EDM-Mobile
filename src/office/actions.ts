/** What someone in the office may do to a ticket from the app. */
export type TicketAction =
  | 'assign'
  | 'offer'
  | 'take_back'
  | 'change_team'
  | 'close'
  | 'reopen'
  | 'cancel'
  | 'note'
  | 'acknowledge'
  | 'notify_customers';
