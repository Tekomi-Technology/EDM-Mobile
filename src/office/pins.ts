import type { IncidentSummary, LiveMap } from '../types';

export type MapFilter = 'staff' | 'incidents' | 'tickets';
export interface Pin {
  id: string;
  kind: 'staff' | 'incident' | 'ticket';
  lat: number;
  lng: number;
  color: '#12B76A' | '#1849A9' | '#98A2B3' | '#B42318' | '#F39B3A';
  label: string;
  detail: string;
}

/** A position older than this is shown grey: the phone may be off or without signal. */
const STALE_MS = 15 * 60_000;

/**
 * Points on the office map (mockup A). Staff: green when free, blue on a job, grey when the position is old;
 *  staff off duty or without a position are left out. Incidents red, other tickets orange (both placed where the ticket is).
 */
export function pinsFor(live: LiveMap, incidents: IncidentSummary[], filter: MapFilter, now: Date): Pin[] {
  if (filter === 'staff') {
    return live.staff.flatMap((s): Pin[] => {
      if (!s.location || s.state === 'off_duty') return [];
      const stale = now.getTime() - new Date(s.location.at).getTime() > STALE_MS;
      return [
        {
          id: s.id,
          kind: 'staff',
          lat: s.location.lat,
          lng: s.location.lng,
          color: stale ? '#98A2B3' : s.state === 'on_job' ? '#1849A9' : '#12B76A',
          label: s.fullName,
          detail: s.currentJob ? `${s.currentJob.code} · ${s.currentJob.title}` : (s.teamName ?? '')
        }
      ];
    });
  }
  const incidentIds = new Set(incidents.map((i) => i.id));
  const isIncident = (id: string, type: string) => incidentIds.has(id) || type === 'network_incident';
  return live.tickets
    .filter((k) => (filter === 'incidents' ? isIncident(k.id, k.type) : !isIncident(k.id, k.type)))
    .map((k) => ({
      id: k.id,
      kind: filter === 'incidents' ? ('incident' as const) : ('ticket' as const),
      lat: k.lat,
      lng: k.lng,
      color: filter === 'incidents' ? ('#B42318' as const) : ('#F39B3A' as const),
      label: k.code,
      detail: k.title
    }));
}
