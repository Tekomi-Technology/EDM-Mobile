import { describe, expect, it } from 'vitest';
import type { IncidentSummary, LiveMap, StaffLive } from '../types';
import { pinsFor } from './pins';

const NOW = new Date('2026-11-03T12:00:00Z');
const staff = (id: string, over: Partial<StaffLive>): StaffLive => ({
  id,
  fullName: id,
  phone: null,
  teamId: 't1',
  teamName: 'South 1',
  state: 'free',
  location: { lat: -25.9, lng: 32.5, accuracy: 10, at: '2026-11-03T11:58:00Z' },
  currentJob: null,
  openJobs: 0,
  doneToday: 0,
  ...over
});
const live = (people: StaffLive[]): LiveMap => ({
  staff: people,
  tickets: [
    {
      id: 'k1',
      type: 'customer_complaint',
      code: 'TK-1',
      title: 'No power',
      status: 'new',
      lat: -25.91,
      lng: 32.47,
      late: false
    }
  ],
  areas: [],
  updatedAt: NOW.toISOString()
});
const incident = { id: 'i1', code: 'TK-9', title: 'Feeder down', status: 'new' } as IncidentSummary;

describe('pinsFor: what the office map shows', () => {
  it('colours staff by what they are doing', () => {
    const pins = pinsFor(
      live([staff('free', { state: 'free' }), staff('busy', { state: 'on_job' })]),
      [],
      'staff',
      NOW
    );
    expect(pins.map((p) => [p.id, p.color])).toEqual([
      ['free', '#12B76A'],
      ['busy', '#1849A9']
    ]);
  });

  it('greys a position older than 15 minutes', () => {
    const old = staff('old', {
      state: 'on_job',
      location: { lat: 1, lng: 2, accuracy: null, at: '2026-11-03T11:40:00Z' }
    });
    expect(pinsFor(live([old]), [], 'staff', NOW)[0]!.color).toBe('#98A2B3');
  });

  it('leaves out staff who are off duty, wherever they last were', () => {
    const home = staff('home', { state: 'off_duty' });
    expect(pinsFor(live([home]), [], 'staff', NOW)).toEqual([]);
  });

  it('leaves out staff without a position', () => {
    expect(pinsFor(live([staff('none', { location: null })]), [], 'staff', NOW)).toEqual([]);
  });

  it('shows only red incident pins with the incidents filter, placed at their ticket on the map', () => {
    const map = live([staff('a', {})]);
    map.tickets.push({
      id: 'i1',
      type: 'network_incident',
      code: 'TK-9',
      title: 'Feeder down',
      status: 'new',
      lat: -25.8,
      lng: 32.4,
      late: true
    });
    const pins = pinsFor(map, [incident], 'incidents', NOW);
    expect(pins.map((p) => [p.kind, p.color, p.lat])).toEqual([['incident', '#B42318', -25.8]]);
  });

  it('shows tickets in orange with the tickets filter', () => {
    expect(pinsFor(live([]), [], 'tickets', NOW).map((p) => [p.kind, p.color])).toEqual([
      ['ticket', '#F39B3A']
    ]);
  });
});
