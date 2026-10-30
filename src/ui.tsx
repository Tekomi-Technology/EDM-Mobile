import Feather from '@expo/vector-icons/Feather';
import type { TicketStatus, TicketType } from './types';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors } from './config';
import { locale, t } from './i18n';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({
  name,
  size = 20,
  color = colors.text
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Feather name={name} size={size} color={color} />;
}

/** Words field staff use for each step of a job. */
export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'New',
  assigned: 'New for you',
  accepted: 'On the way',
  in_progress: 'Fixing',
  on_hold: 'Paused',
  resolved: 'Done, being checked',
  closed: 'Closed',
  reopened: 'Reopened',
  cancelled: 'Cancelled'
};

export const TYPE_LABEL: Record<TicketType, string> = {
  customer_complaint: 'Customer complaint',
  network_incident: 'Network incident',
  planned_work: 'Planned work',
  new_customer_survey: 'New customer survey',
  new_connection: 'New connection',
  other: 'Other job'
};

export const TYPE_ICON: Record<TicketType, IconName> = {
  customer_complaint: 'alert-circle',
  network_incident: 'zap',
  planned_work: 'tool',
  new_customer_survey: 'home',
  new_connection: 'home',
  other: 'help-circle'
};

const BADGE: Partial<Record<TicketStatus, { bg: string; fg: string }>> = {
  assigned: { bg: colors.brandSoft, fg: colors.brandText },
  accepted: { bg: colors.blueSoft, fg: colors.blue },
  in_progress: { bg: colors.blueSoft, fg: colors.blue },
  on_hold: { bg: '#FFFAEB', fg: '#93370D' },
  resolved: { bg: '#F4F3FF', fg: '#5925DC' },
  cancelled: { bg: '#F2F4F7', fg: '#667085' }
};

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  busy = false,
  disabled = false
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'soft';
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
}) {
  const fg = kind === 'primary' ? colors.brandInk : kind === 'soft' ? colors.brandText : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' ? styles.primary : kind === 'soft' ? styles.soft : styles.secondary,
        (pressed || disabled) && { opacity: 0.7 }
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.brandInk} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {icon && <Icon name={icon} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Badge({ status }: { status: TicketStatus }) {
  const c = BADGE[status] ?? { bg: '#F2F4F7', fg: '#344054' };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Text style={[styles.badgeText, { color: c.fg }]}>{t(STATUS_LABEL[status])}</Text>
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

/** Tells the person they are offline and that their work is safe on the phone. */
export function OfflineBanner({
  online,
  savedAt,
  waiting
}: {
  online: boolean;
  savedAt: string | null;
  waiting: number;
}) {
  if (online && waiting === 0) return null;
  const time = savedAt
    ? new Date(savedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Icon name={online ? 'upload-cloud' : 'wifi-off'} color="#93370D" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.bannerTitle}>{online ? t('Sending your changes…') : t('No connection')}</Text>
        <Text style={styles.bannerText}>
          {!online &&
            (time ? t('Showing jobs saved at {0}. ', { 0: time }) : t('Showing jobs saved on the phone. '))}
          {waiting > 0
            ? t(
                waiting === 1
                  ? '{0} change saved on the phone, sent automatically when there is signal.'
                  : '{0} changes saved on the phone, sent automatically when there is signal.',
                { 0: waiting }
              )
            : t('You can keep working; changes are sent when there is signal.')}
        </Text>
      </View>
    </View>
  );
}

/** Bottom navigation of the app. */
export function TabBar({
  current,
  onChange,
  badge
}: {
  current: 'jobs' | 'me';
  onChange: (tab: 'jobs' | 'me') => void;
  /** Number of changes waiting, shown on "Me". */
  badge: number;
}) {
  const tabs: { key: 'jobs' | 'me'; label: string; icon: IconName }[] = [
    { key: 'jobs', label: 'Jobs', icon: 'list' },
    { key: 'me', label: 'Me', icon: 'user' }
  ];
  return (
    <View style={styles.tabBar} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.key === current;
        const color = active ? colors.brandText : colors.muted;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
          >
            <View>
              <Icon name={tab.icon} size={24} color={color} />
              {tab.key === 'me' && badge > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{badge}</Text>
                </View>
              )}
            </View>
            <Text style={{ color, fontWeight: active ? '700' : '500', fontSize: 13 }}>{t(tab.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "1 h 20 min left" / "22 min late", or null without a time limit. */
export function timeLeft(dueAt: string | null): { text: string; late: boolean } | null {
  if (!dueAt) return null;
  const minutes = Math.round((new Date(dueAt).getTime() - Date.now()) / 60_000);
  const abs = Math.abs(minutes);
  const text = abs >= 60 ? `${Math.floor(abs / 60)} h${abs % 60 ? ` ${abs % 60} min` : ''}` : `${abs} min`;
  return minutes < 0
    ? { text: t('{0} late', { 0: text }), late: true }
    : { text: t('{0} left', { 0: text }), late: false };
}

/** "3 min ago", "2 h ago". */
export function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return t('just now');
  return minutes < 60 ? t('{0} min ago', { 0: minutes }) : t('{0} h ago', { 0: Math.floor(minutes / 60) });
}

/** "350 m", "1.8 km" (with the decimal sign of the language). */
export function distanceText(m: number): string {
  return m < 1000
    ? `${Math.round(m / 10) * 10} m`
    : `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} km`;
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 16,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 12
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8
  },
  button: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18
  },
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.surface, borderColor: '#D5D8DE', borderWidth: 1 },
  soft: { backgroundColor: colors.brandSoft },
  buttonText: { fontSize: 17, fontWeight: '700' },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 14, fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  section: { fontSize: 15, color: colors.muted, fontWeight: '500', marginTop: 8 },
  label: { fontSize: 14, color: colors.muted },
  body: { fontSize: 16, color: colors.text, lineHeight: 23 },
  input: {
    borderColor: '#D5D8DE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 84,
    fontSize: 16,
    textAlignVertical: 'top',
    backgroundColor: colors.surface
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFAEB',
    borderColor: '#FEDF89',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12
  },
  bannerTitle: { color: '#93370D', fontSize: 15, fontWeight: '700' },
  bannerText: { color: '#93370D', fontSize: 14, lineHeight: 20 },
  error: { backgroundColor: '#FEF3F2', color: '#912018', padding: 12, borderRadius: 12, fontSize: 14 },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
    paddingBottom: 28,
    gap: 10
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: 20,
    paddingTop: 10
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabBadge: {
    position: 'absolute',
    right: -10,
    top: -4,
    backgroundColor: colors.late,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  }
});
