import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useAuth } from '../../auth';
import { colors } from '../../config';
import { t } from '../../i18n';
import type { PremisesType, SupplyType } from '../../types';
import { Card, styles as ui } from '../../ui';
import { officeApi } from '../officeApi';
import { describeError, useRemote } from '../remote';
import { Chips, Field, Wizard } from './Wizard';
import { canContinue, emptyNewCustomerDraft, newCustomerSteps, type NewCustomerDraft } from './steps';

const STEP_LABEL = ['Survey or connection', 'Details', 'Check and create'];
const PREMISES: PremisesType[] = ['home', 'shop', 'school', 'business', 'farm', 'other'];
const PREMISES_LABEL: Record<PremisesType, string> = {
  home: 'Home',
  shop: 'Shop',
  school: 'School',
  business: 'Business',
  farm: 'Farm',
  other: 'Other'
};

/** A survey, or the connection after a finished survey, without the Sales system (supervisors, administrators). */
export function NewCustomerFlow({
  onCancel,
  onCreated
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const { accessToken } = useAuth();
  const [index, setIndex] = useState(0);
  const [d, setD] = useState<NewCustomerDraft>(emptyNewCustomerDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<NewCustomerDraft>) => setD((x) => ({ ...x, ...patch }));
  const step = newCustomerSteps[index]!;
  const waiting = useRemote(
    (token) => (d.mode === 'connection' ? officeApi.surveysWaiting(token) : Promise.resolve([])),
    [d.mode]
  );
  const survey = waiting.data?.find((w) => w.ticketId === d.surveyTicketId);

  async function next() {
    setError(null);
    if (step !== 'review') return setIndex(index + 1);
    setBusy(true);
    try {
      const token = await accessToken();
      const created =
        d.mode === 'survey'
          ? await officeApi.createSurvey(token, {
              customer: {
                fullName: d.fullName.trim(),
                phone: d.phone.trim() || undefined,
                address: d.address.trim()
              },
              premises: d.premises,
              supply: d.supply,
              notes: d.notes.trim() || undefined
            })
          : await officeApi.createConnection(token, {
              contractNo: d.contractNo.trim(),
              surveyTicketId: d.surveyTicketId ?? undefined,
              notes: d.notes.trim() || undefined
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
      title="Survey or new connection"
      steps={STEP_LABEL}
      index={index}
      problem={canContinue('new_customer', step, d)}
      error={error}
      busy={busy}
      onCancel={onCancel}
      onBack={() => setIndex(index - 1)}
      onNext={() => void next()}
    >
      {step === 'survey' && (
        <>
          <Chips
            value={d.mode}
            onChange={(v) => set({ mode: v, surveyTicketId: null })}
            options={[
              { value: 'survey', label: 'New survey' },
              { value: 'connection', label: 'Connection after a survey' }
            ]}
          />
          {d.mode === 'connection' &&
            (waiting.data ?? []).map((w) => (
              <Pressable
                key={w.ticketId}
                accessibilityRole="radio"
                accessibilityState={{ selected: d.surveyTicketId === w.ticketId }}
                onPress={() => set({ surveyTicketId: w.ticketId })}
              >
                <Card
                  style={
                    d.surveyTicketId === w.ticketId
                      ? { borderColor: colors.brand, borderWidth: 2 }
                      : undefined
                  }
                >
                  <Text style={ui.body}>
                    {w.code} · {w.customer?.fullName ?? ''}
                  </Text>
                  <Text style={ui.label}>
                    {[w.customer?.address, w.worksNeeded].filter(Boolean).join(' · ')}
                  </Text>
                </Card>
              </Pressable>
            ))}
          {d.mode === 'connection' && waiting.data?.length === 0 && (
            <Text style={ui.label}>{t('No finished survey is waiting for a connection.')}</Text>
          )}
        </>
      )}
      {step === 'details' &&
        (d.mode === 'survey' ? (
          <>
            <Field
              label="Customer or company name"
              value={d.fullName}
              onChange={(v) => set({ fullName: v })}
            />
            <Field
              label="Phone (optional)"
              value={d.phone}
              onChange={(v) => set({ phone: v })}
              keyboard="phone-pad"
            />
            <Field label="Address of the premises" value={d.address} onChange={(v) => set({ address: v })} />
            <Chips<PremisesType>
              label="Premises"
              value={d.premises}
              onChange={(v) => set({ premises: v })}
              options={PREMISES.map((p) => ({ value: p, label: PREMISES_LABEL[p] }))}
            />
            <Chips<SupplyType>
              label="Supply"
              value={d.supply}
              onChange={(v) => set({ supply: v })}
              options={[
                { value: 'single_phase', label: 'Single phase' },
                { value: 'three_phase', label: 'Three phase' }
              ]}
            />
            <Field label="Notes (optional)" value={d.notes} onChange={(v) => set({ notes: v })} multiline />
          </>
        ) : (
          <>
            <Field label="Contract number" value={d.contractNo} onChange={(v) => set({ contractNo: v })} />
            <Field label="Notes (optional)" value={d.notes} onChange={(v) => set({ notes: v })} multiline />
          </>
        ))}
      {step === 'review' && (
        <Card>
          <Text style={ui.cardTitle}>
            {d.mode === 'survey' ? d.fullName : `${survey?.code ?? ''} · ${d.contractNo}`}
          </Text>
          <Text style={ui.label}>{d.mode === 'survey' ? d.address : (survey?.customer?.address ?? '')}</Text>
        </Card>
      )}
    </Wizard>
  );
}
