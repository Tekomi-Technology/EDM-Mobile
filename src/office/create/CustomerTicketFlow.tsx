import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../../auth';
import { colors } from '../../config';
import { t } from '../../i18n';
import {
  PROBLEM_TYPES,
  type CustomerMatch,
  type OfficeTicketBody,
  type ProblemType,
  type TicketPreview
} from '../../types';
import { Button, Card, clock, styles as ui } from '../../ui';
import { officeApi } from '../officeApi';
import { Pill } from '../officeUi';
import { describeError, useRemote } from '../remote';
import type { OfficeLayout } from '../shell';
import { Chips, Field, Wizard } from './Wizard';
import { canContinue, customerSteps, emptyCustomerDraft, type CustomerDraft } from './steps';

const STEP_LABEL = ['Customer', 'Problem', 'Check and create'];

function bodyOf(d: CustomerDraft): OfficeTicketBody {
  const team = d.teamId ? { teamId: d.teamId, teamReason: d.teamReason.trim() } : {};
  if (d.noCustomer) {
    return {
      type: 'other',
      title: d.title.trim(),
      description: d.description.trim(),
      priority: d.priority ?? 3,
      address: d.address.trim() || undefined,
      callerPhone: d.callerPhone.trim() || undefined,
      ...team
    };
  }
  return {
    type: 'customer_complaint',
    customerId: d.customer!.id,
    problemType: d.problemType!,
    description: d.description.trim(),
    callerPhone: d.callerPhone.trim() || undefined,
    ...team
  };
}

/** Customer ticket, 3 steps: find the customer, the problem, check and create. */
export function CustomerTicketFlow({
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
  const [d, setD] = useState<CustomerDraft>(emptyCustomerDraft);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<CustomerDraft>) => setD((x) => ({ ...x, ...patch }));
  const step = customerSteps[index]!;
  const choosesTeam = layout !== 'team_manager';

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const found = useRemote<CustomerMatch[]>(
    (token) => (query.length >= 3 ? officeApi.customers(token, query) : Promise.resolve([])),
    [query]
  );
  const lookups = useRemote(
    (token) => (choosesTeam ? officeApi.lookups(token) : Promise.resolve(null)),
    [choosesTeam]
  );
  const [preview, setPreview] = useState<TicketPreview | null>(null);
  useEffect(() => {
    if (step !== 'review') return;
    let alive = true;
    void (async () => {
      try {
        const b = bodyOf(d);
        const p = await officeApi.preview(
          await accessToken(),
          b.type === 'other'
            ? { type: 'other', priority: b.priority, teamId: b.teamId }
            : { type: b.type, customerId: b.customerId, problemType: b.problemType, teamId: b.teamId }
        );
        if (alive) setPreview(p);
      } catch (e) {
        if (alive) setError(describeError(e).error);
      }
    })();
    return () => {
      alive = false;
    };
  }, [step, d, accessToken]);

  async function next() {
    setError(null);
    if (step !== 'review') return setIndex(index + 1);
    setBusy(true);
    try {
      const created = await officeApi.createTicket(await accessToken(), bodyOf(d));
      onCreated(created.id);
    } catch (e) {
      setError(describeError(e).error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Wizard
      title="Customer ticket"
      steps={STEP_LABEL}
      index={index}
      problem={canContinue('customer', step, d)}
      error={error}
      busy={busy}
      onCancel={onCancel}
      onBack={() => setIndex(index - 1)}
      onNext={() => void next()}
    >
      {step === 'customer' && (
        <>
          {d.customer ? (
            <Card>
              <Text style={ui.cardTitle}>{d.customer.fullName}</Text>
              <Text style={ui.label}>
                {[d.customer.contractNo, d.customer.address, d.customer.teamName].filter(Boolean).join(' · ')}
              </Text>
              {d.customer.openTickets.length > 0 && (
                <Pill
                  text={t('Already has an open ticket: {0}', {
                    0: d.customer.openTickets.map((o) => o.code).join(', ')
                  })}
                  tone="red"
                />
              )}
              <Button
                label={t('Choose another customer')}
                kind="secondary"
                onPress={() => set({ customer: null })}
              />
            </Card>
          ) : d.noCustomer ? (
            <>
              <Field
                label="What is it about"
                value={d.title}
                onChange={(v) => set({ title: v })}
                placeholder="e.g. Meter box door broken"
              />
              <Field label="Address (optional)" value={d.address} onChange={(v) => set({ address: v })} />
              <Button
                label={t('Find a customer instead')}
                kind="secondary"
                onPress={() => set({ noCustomer: false })}
              />
            </>
          ) : (
            <>
              <Field
                label="Phone, contract or meter number, or name"
                value={search}
                onChange={setSearch}
                keyboard="default"
              />
              {(found.data ?? []).map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  onPress={() => set({ customer: c, callerPhone: d.callerPhone || (c.phone ?? '') })}
                >
                  <Card>
                    <Text style={ui.body}>{c.fullName}</Text>
                    <Text style={ui.label}>{[c.contractNo, c.address].filter(Boolean).join(' · ')}</Text>
                    {c.openTickets.length > 0 && (
                      <Text style={{ color: colors.late }}>
                        {t('Already has an open ticket: {0}', {
                          0: c.openTickets.map((o) => o.code).join(', ')
                        })}
                      </Text>
                    )}
                  </Card>
                </Pressable>
              ))}
              {query.length >= 3 && found.data?.length === 0 && (
                <Text style={ui.label}>{t('No customer found.')}</Text>
              )}
              <Button
                label={t('No customer: something else')}
                kind="soft"
                onPress={() => set({ noCustomer: true })}
              />
            </>
          )}
        </>
      )}
      {step === 'problem' && (
        <>
          {d.noCustomer ? (
            <Chips
              label="Priority"
              value={d.priority}
              onChange={(v) => set({ priority: v })}
              options={[
                { value: 1, label: '1 · urgent, 2 h' },
                { value: 2, label: '2 · 4 h' },
                { value: 3, label: '3 · 24 h' }
              ]}
            />
          ) : (
            <Chips<ProblemType>
              label="Problem"
              value={d.problemType}
              onChange={(v) => set({ problemType: v })}
              options={(Object.keys(PROBLEM_TYPES) as ProblemType[]).map((k) => ({
                value: k,
                label: PROBLEM_TYPES[k].label
              }))}
            />
          )}
          <Field
            label={d.noCustomer ? 'What needs to be done' : 'What the caller says'}
            value={d.description}
            onChange={(v) => set({ description: v })}
            multiline
          />
          <Field
            label="Phone for the SMS updates (optional)"
            value={d.callerPhone}
            onChange={(v) => set({ callerPhone: v })}
            keyboard="phone-pad"
          />
          {choosesTeam && (
            <>
              <Chips<string>
                label="Team"
                value={d.teamId ?? ''}
                onChange={(v) => set({ teamId: v || null })}
                options={[
                  { value: '', label: 'Team of the place' },
                  ...(lookups.data?.teams ?? []).map((x) => ({ value: x.id, label: x.name }))
                ]}
              />
              {d.teamId && (
                <Field
                  label="Why another team goes"
                  value={d.teamReason}
                  onChange={(v) => set({ teamReason: v })}
                />
              )}
            </>
          )}
        </>
      )}
      {step === 'review' && (
        <Card>
          <Text style={ui.label}>{t('Check before creating')}</Text>
          {preview ? (
            <View style={{ gap: 4 }}>
              <Text style={ui.body}>
                {preview.team
                  ? t('Team {0} gets it', { 0: preview.team.name })
                  : t('No team: an operations supervisor will route it.')}
              </Text>
              <Text style={ui.body}>{t('Time limit: {0}', { 0: clock(preview.dueAt) })}</Text>
              {preview.incident && (
                <Pill
                  text={t('Near an open network incident: {0}', { 0: preview.incident.code })}
                  tone="red"
                />
              )}
            </View>
          ) : (
            <Text style={ui.label}>{t('Loading…')}</Text>
          )}
        </Card>
      )}
    </Wizard>
  );
}
