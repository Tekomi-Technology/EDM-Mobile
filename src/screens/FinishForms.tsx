import {
  HELP_KINDS,
  type HelpKind,
  type MaterialLine,
  type MyVan,
  type StockUnit,
  type SurveyResult
} from '../types';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '../config';
import { t } from '../i18n';
import { Button, Card, Icon, styles } from '../ui';

const UNIT: Record<StockUnit, string> = { pcs: 'pcs', m: 'm', kg: 'kg', set: 'set' };

export const HELP_LABEL: Record<HelpKind, string> = {
  second_person: 'I need a second person',
  truck: 'I need a crane truck',
  material: 'Material is missing',
  switch_off: 'Switch the line off',
  advice: 'I need advice',
  other: 'Something else'
};

const SURVEY_LABEL: Record<SurveyResult, string> = {
  feasible: 'Can be connected',
  feasible_with_works: 'Needs works first',
  not_feasible: 'Cannot be connected'
};

/** Chips to pick one option from a short list. */
function Choice<T extends string>({
  options,
  value,
  label,
  onChange
}: {
  options: readonly T[];
  value: T | null;
  label: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <Pressable
          key={o}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === o }}
          onPress={() => onChange(o)}
          style={{
            borderRadius: 20,
            borderWidth: 1,
            borderColor: value === o ? colors.brand : colors.border,
            backgroundColor: value === o ? colors.brandSoft : '#fff',
            paddingHorizontal: 14,
            paddingVertical: 9
          }}
        >
          <Text style={{ color: value === o ? colors.brandText : colors.text, fontWeight: '600' }}>
            {label(o)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Lines of material with + and − buttons; the van's stock first, then the rest of the catalogue on demand. */
export function MaterialsPicker({
  van,
  lines,
  onChange,
  title
}: {
  van: MyVan | null;
  lines: MaterialLine[];
  onChange: (lines: MaterialLine[]) => void;
  title: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const inVan = new Map((van?.lines ?? []).map((l) => [l.itemId, l.quantity]));
  const items = (van?.catalog ?? [])
    .filter((i) => showAll || inVan.has(i.id) || lines.some((l) => l.itemId === i.id))
    .sort((a, b) => Number(inVan.has(b.id)) - Number(inVan.has(a.id)));
  const qty = (id: string) => lines.find((l) => l.itemId === id)?.quantity ?? 0;
  const set = (id: string, q: number) =>
    onChange(
      q <= 0
        ? lines.filter((l) => l.itemId !== id)
        : lines.some((l) => l.itemId === id)
          ? lines.map((l) => (l.itemId === id ? { ...l, quantity: q } : l))
          : [...lines, { itemId: id, quantity: q }]
    );

  if (!van) {
    return (
      <Text style={styles.label}>
        {t('Material list not saved on the phone yet. Open the app once with signal.')}
      </Text>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{title}</Text>
      {items.length === 0 && <Text style={styles.label}>{t('Your van is empty.')}</Text>}
      {items.map((i) => {
        const q = qty(i.id);
        const has = inVan.get(i.id);
        return (
          <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.body}>{i.name}</Text>
              <Text style={styles.label}>
                {i.code} ·{' '}
                {has !== undefined
                  ? t('{0} in the van', { 0: `${has} ${t(UNIT[i.unit])}` })
                  : t('not in the van')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Less {0}', { 0: i.name })}
              onPress={() => set(i.id, q - 1)}
              style={stepper}
            >
              <Icon name="minus" size={18} />
            </Pressable>
            <TextInput
              accessibilityLabel={t('{0} used', { 0: i.name })}
              keyboardType="numeric"
              value={q ? String(q) : ''}
              placeholder="0"
              onChangeText={(t) => set(i.id, Number(t.replace(',', '.')) || 0)}
              style={[styles.input, { width: 56, minHeight: 40, textAlign: 'center', paddingVertical: 6 }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('More {0}', { 0: i.name })}
              onPress={() => set(i.id, q + 1)}
              style={stepper}
            >
              <Icon name="plus" size={18} />
            </Pressable>
          </View>
        );
      })}
      {!showAll && van.catalog.length > items.length && (
        <Button
          kind="soft"
          icon="list"
          label={t('Something not in the van')}
          onPress={() => setShowAll(true)}
        />
      )}
    </View>
  );
}

const stepper = {
  width: 40,
  height: 40,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: colors.border,
  alignItems: 'center' as const,
  justifyContent: 'center' as const
};

export interface SurveyDraft {
  result: SurveyResult | null;
  distance: string;
  nearestElement: string;
  worksNeeded: string;
  materials: MaterialLine[];
}
export const emptySurvey: SurveyDraft = {
  result: null,
  distance: '',
  nearestElement: '',
  worksNeeded: '',
  materials: []
};

/** New customer surveys: can the premises be connected, and what will it take. */
export function SurveyForm({
  draft,
  onChange,
  van
}: {
  draft: SurveyDraft;
  onChange: (d: SurveyDraft) => void;
  van: MyVan | null;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.label}>{t('Result of the survey')}</Text>
      <Choice
        options={['feasible', 'feasible_with_works', 'not_feasible'] as const}
        value={draft.result}
        label={(v) => t(SURVEY_LABEL[v])}
        onChange={(result) => onChange({ ...draft, result })}
      />
      <Text style={styles.label}>{t('Distance to the network (metres)')}</Text>
      <TextInput
        keyboardType="numeric"
        value={draft.distance}
        onChangeText={(distance) => onChange({ ...draft, distance })}
        style={styles.input}
      />
      <Text style={styles.label}>{t('Nearest pole or transformer')}</Text>
      <TextInput
        value={draft.nearestElement}
        onChangeText={(nearestElement) => onChange({ ...draft, nearestElement })}
        placeholder={t('e.g. P-4471')}
        style={styles.input}
      />
      {draft.result && draft.result !== 'feasible' && (
        <>
          <Text style={styles.label}>{t('Works needed')}</Text>
          <TextInput
            value={draft.worksNeeded}
            onChangeText={(worksNeeded) => onChange({ ...draft, worksNeeded })}
            multiline
            placeholder={t('e.g. One new pole and 60 m of line')}
            style={styles.input}
          />
        </>
      )}
      {draft.result !== 'not_feasible' && (
        <MaterialsPicker
          van={van}
          title={t('Material needed for the connection')}
          lines={draft.materials}
          onChange={(materials) => onChange({ ...draft, materials })}
        />
      )}
    </View>
  );
}

export interface InstallationDraft {
  meterNumber: string;
  sealNumber: string;
}
export const emptyInstallation: InstallationDraft = {
  meterNumber: '',
  sealNumber: ''
};

/** New connections: the meter installed. The photo of the meter, taken below, is the proof of the job. */
export function InstallationForm({
  draft,
  onChange
}: {
  draft: InstallationDraft;
  onChange: (d: InstallationDraft) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.label}>{t('Meter number')}</Text>
      <TextInput
        value={draft.meterNumber}
        onChangeText={(meterNumber) => onChange({ ...draft, meterNumber })}
        autoCapitalize="characters"
        style={styles.input}
      />
      <Text style={styles.label}>{t('Seal number')}</Text>
      <TextInput
        value={draft.sealNumber}
        onChangeText={(sealNumber) => onChange({ ...draft, sealNumber })}
        autoCapitalize="characters"
        style={styles.input}
      />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <Icon name="camera" color={colors.brandText} />
        <Text style={[styles.body, { flex: 1 }]}>
          {t(
            'Take a photo of the installed meter, with its number and the light that shows power. It is required.'
          )}
        </Text>
      </View>
    </View>
  );
}

/** Asks the back office for help with this job. Needs a connection. */
export function HelpBox({
  onSend,
  onClose,
  busy
}: {
  onSend: (kind: HelpKind | null, message: string) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const [kind, setKind] = useState<HelpKind | null>(null);
  const [message, setMessage] = useState('');
  return (
    <Card>
      <Text style={styles.cardTitle}>{t('Ask for help')}</Text>
      <Choice options={HELP_KINDS} value={kind} label={(v) => t(HELP_LABEL[v])} onChange={setKind} />
      <TextInput
        value={message}
        onChangeText={setMessage}
        multiline
        placeholder={t('What do you need?')}
        style={styles.input}
      />
      <Button
        label={t('Send to the office')}
        icon="send"
        busy={busy}
        onPress={() => void onSend(kind, message.trim())}
      />
      <Button kind="secondary" label={t('Never mind')} onPress={onClose} />
    </Card>
  );
}
