import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../config';
import { t } from '../i18n';
import { Button, Icon, styles as ui, type IconName } from '../ui';

/** Title bar of an office screen, with an optional back button and something on the right. */
export function OfficeHeader({
  title,
  subtitle,
  onBack,
  right,
  children
}: {
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={ui.header}>
      {onBack && (
        <Pressable accessibilityRole="button" onPress={onBack} style={s.back} hitSlop={12}>
          <Icon name="chevron-left" color={colors.brandText} />
          <Text style={s.backText}>{t('Back')}</Text>
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={ui.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? <Text style={ui.label}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Loading the first time, or the reason it failed with a Retry button (office screens need a connection). */
export function LoadState({
  loading,
  error,
  hasData,
  onRetry
}: {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  onRetry: () => void;
}) {
  if (hasData && !error) return null;
  if (loading && !hasData) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  if (!error) return null;
  return (
    <View style={[s.center, { gap: 12, padding: 24 }]}>
      <Text style={[ui.body, { textAlign: 'center' }]}>{error}</Text>
      <Button label={t('Retry')} kind="secondary" icon="refresh-cw" onPress={onRetry} />
    </View>
  );
}

/** The round + button for creating tickets and planned work. */
export function Fab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Create')}
      onPress={onPress}
      style={({ pressed }) => [s.fab, pressed && { opacity: 0.8 }]}
    >
      <Icon name="plus" size={28} color={colors.brandInk} />
    </Pressable>
  );
}

/** A small coloured label, e.g. "2 h late". */
export function Pill({ text, tone }: { text: string; tone: 'red' | 'orange' | 'blue' | 'green' | 'grey' }) {
  const c = PILL[tone];
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const PILL = {
  red: { bg: '#FEE4E2', fg: colors.late },
  orange: { bg: colors.brandSoft, fg: colors.brandText },
  blue: { bg: colors.blueSoft, fg: colors.blue },
  green: { bg: '#ECFDF3', fg: '#067647' },
  grey: { bg: '#F2F4F7', fg: '#475467' }
} as const;

/** A row in a list: icon, two lines of text, something on the right; pressable when onPress is given. */
export function Row({
  icon,
  dot,
  title,
  detail,
  right,
  onPress
}: {
  icon?: IconName;
  dot?: string;
  title: string;
  detail?: string | null;
  right?: string | null;
  onPress?: () => void;
}) {
  const content = (
    <View style={s.row}>
      {dot ? <View style={[s.rowDot, { backgroundColor: dot }]} /> : null}
      {icon ? <Icon name={icon} color={colors.muted} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={ui.label} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {right ? <Text style={ui.label}>{right}</Text> : null}
      {onPress ? <Icon name="chevron-right" size={18} color={colors.muted} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export const s = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { color: colors.brandText, fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  pill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  rowDot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  group: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6
  },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center'
  },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, textAlign: 'center' }
});
