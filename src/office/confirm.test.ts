import { describe, expect, it } from 'vitest';
import { confirmFor } from './confirm';

describe('confirmFor: which taps ask first', () => {
  it('asks before closing, saying linked tickets close too for an incident', () => {
    expect(confirmFor('close', 'network_incident')).toEqual({
      title: 'Close {0}?',
      message: 'The customer tickets linked to it are closed too, and each caller gets an SMS.'
    });
    expect(confirmFor('close', 'customer_complaint')?.title).toBe('Close {0}?');
  });
  it('asks before reopening and before texting customers', () => {
    expect(confirmFor('reopen', 'customer_complaint')?.title).toBe('Reopen {0}?');
    expect(confirmFor('notify_customers', 'network_incident')?.title).toBe('Text the customers of {0}?');
  });
  it('does not ask for the other actions', () => {
    expect(confirmFor('acknowledge', 'network_incident')).toBeNull();
    expect(confirmFor('offer', 'customer_complaint')).toBeNull();
  });
});
