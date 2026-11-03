import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useAuth } from '../../auth';
import { t } from '../../i18n';
import { Card, styles as ui } from '../../ui';
import { officeApi } from '../officeApi';
import { describeError, useRemote } from '../remote';
import type { OfficeLayout } from '../shell';
import { Chips, Field, Wizard } from './Wizard';
import { canContinue, emptyPlannedDraft, plannedSteps, type PlannedDraft } from './steps';

const STEP_LABEL = ['What', 'When', 'Team', 'Check and create'];
/** Mozambique is UTC+2 all year. */
const OFFSET = '+02:00';
const tomorrow = () => new Date(Date.now() + 26 * 3600_000).toISOString().slice(0, 10);

/** Planned maintenance or a network change, step by step; a team manager plans for their own team only. */
export function PlannedWorkFlow({
  layout,
  onCancel,
  onCreated
}: {
  layout: OfficeLayout;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const { accessToken } = useAuth();
  const [index, setIndex] = useState(0);
  const [d, setD] = useState<PlannedDraft>(() => emptyPlannedDraft(tomorrow()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<PlannedDraft>) => setD((x) => ({ ...x, ...patch }));
  const step = plannedSteps[index]!;
  const ownTeamOnly = layout === 'team_manager';
  const me = useRemote((token) => officeApi.me(token), []);
  const lookups = useRemote((token) => officeApi.lookups(token), []);
  const teams = (lookups.data?.teams ?? []).filter((x) => !ownTeamOnly || x.id === me.data?.teamId);
  const draft = ownTeamOnly ? { ...d, teamId: me.data?.teamId ?? null } : d;

  async function next() {
    setError(null);
    if (step !== 'review') return setIndex(index + 1);
    setBusy(true);
    try {
      const created = await officeApi.plannedWork(await accessToken(), {
        kind: draft.kind,
        title: draft.title.trim(),
        element: draft.element.trim(),
        teamId: draft.teamId!,
        scheduledStart: `${draft.date}T${draft.from}:00${OFFSET}`,
        scheduledEnd: `${draft.date}T${draft.to}:00${OFFSET}`,
        outage: draft.outage,
        customersAffected:
          draft.outage && draft.customersAffected ? Number(draft.customersAffected) : undefined,
        description: draft.description.trim() || undefined
      });
      onCreated(created.id);
    } catch (e) {
      setError(describeError(e).error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Wizard
      title="Planned maintenance"
      steps={STEP_LABEL}
      index={index}
      problem={canContinue('planned', step, draft)}
      error={error}
      busy={busy}
      onCancel={onCancel}
      onBack={() => setIndex(index - 1)}
      onNext={() => void next()}
    >
      {step === 'what' && (
        <>
          <Chips
            label="Kind"
            value={d.kind}
            onChange={(v) => set({ kind: v })}
            options={[
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'network_change', label: 'Network change' }
            ]}
          />
          <Field
            label="What is it about"
            value={d.title}
            onChange={(v) => set({ title: v })}
            placeholder="e.g. Replace transformer PT-1180"
          />
          <Field label="Equipment or place" value={d.element} onChange={(v) => set({ element: v })} />
          <Field
            label="Notes for the team (optional)"
            value={d.description}
            onChange={(v) => set({ description: v })}
            multiline
          />
        </>
      )}
      {step === 'when' && (
        <>
          <Field label="Date (YYYY-MM-DD)" value={d.date} onChange={(v) => set({ date: v })} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="From (HH:MM)" value={d.from} onChange={(v) => set({ from: v })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="To (HH:MM)" value={d.to} onChange={(v) => set({ to: v })} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Switch value={d.outage} onValueChange={(v) => set({ outage: v })} />
            <Text style={ui.body}>{t('Power is cut')}</Text>
          </View>
          {d.outage && (
            <Field
              label="Customers affected (optional)"
              value={d.customersAffected}
              onChange={(v) => set({ customersAffected: v.replace(/\D/g, '') })}
              keyboard="numeric"
            />
          )}
        </>
      )}
      {step === 'team' && (
        <Chips<string>
          label="Team"
          value={draft.teamId}
          onChange={(v) => set({ teamId: v })}
          options={teams.map((x) => ({ value: x.id, label: `${x.name} · ${x.areaName}` }))}
        />
      )}
      {step === 'review' && (
        <Card>
          <Text style={ui.cardTitle}>{draft.title}</Text>
          <Text style={ui.body}>
            {draft.date} · {draft.from}–{draft.to}
          </Text>
          <Text style={ui.label}>{teams.find((x) => x.id === draft.teamId)?.name ?? ''}</Text>
          {draft.outage && <Text style={ui.label}>{t('Power is cut')}</Text>}
        </Card>
      )}
    </Wizard>
  );
}
