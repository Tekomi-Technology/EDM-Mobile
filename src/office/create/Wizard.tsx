import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { colors } from '../../config';
import { t } from '../../i18n';
import { Button, ErrorText, styles as ui } from '../../ui';
import { OfficeHeader } from '../officeUi';

/** One step at a time (mockup A): progress bar, the step, and Next (or Create on the last step). */
export function Wizard({
  title,
  steps,
  index,
  problem,
  error,
  busy,
  onBack,
  onCancel,
  onNext,
  children
}: {
  title: string;
  steps: string[];
  index: number;
  /** Why Next is not possible yet (shown under the button). */
  problem: string | null;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
  children: ReactNode;
}) {
  const last = index === steps.length - 1;
  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <OfficeHeader
        title={t(title)}
        subtitle={t('Step {0} of {1} · {2}', { 0: index + 1, 1: steps.length, 2: t(steps[index]!) })}
        onBack={index === 0 ? onCancel : onBack}
      >
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {steps.map((s, i) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= index ? colors.brand : colors.border
              }}
            />
          ))}
        </View>
      </OfficeHeader>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <View style={ui.footer}>
        {problem && <Text style={ui.label}>{problem}</Text>}
        <ErrorText message={error} />
        <Button label={t(last ? 'Create' : 'Next')} busy={busy} disabled={!!problem} onPress={onNext} />
      </View>
    </KeyboardAvoidingView>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboard
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboard?: 'default' | 'phone-pad' | 'numeric';
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={ui.label}>{t(label)}</Text>
      <TextInput
        style={[ui.input, !multiline && { minHeight: 48 }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ? t(placeholder) : undefined}
        multiline={multiline}
        keyboardType={keyboard ?? 'default'}
      />
    </View>
  );
}

/** Choose one of a few (chips). */
export function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={ui.label}>{t(label)}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: on ? colors.brand : colors.border,
                backgroundColor: on ? colors.brand : colors.surface,
                paddingHorizontal: 14,
                paddingVertical: 8
              }}
            >
              <Text style={{ color: on ? colors.brandInk : colors.text, fontWeight: on ? '700' : '500' }}>
                {t(o.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
