import { Pressable, Text, View } from 'react-native';
import { colors } from '../config';
import { t } from '../i18n';
import { Icon, styles, type IconName } from '../ui';
import { tabsFor, type OfficeLayout, type OfficeTab } from './shell';

/** The tabs of the office screens; the number of unread notifications shows on Notifications. */
export function OfficeTabBar({
  layout,
  current,
  onChange,
  unread
}: {
  layout: OfficeLayout;
  current: OfficeTab;
  onChange: (tab: OfficeTab) => void;
  unread: number;
}) {
  return (
    <View style={styles.tabBar} accessibilityRole="tablist">
      {tabsFor(layout).map((tab) => {
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
              <Icon name={tab.icon as IconName} size={24} color={color} />
              {tab.key === 'inbox' && unread > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ color, fontWeight: active ? '700' : '500', fontSize: 12 }} numberOfLines={1}>
              {t(tab.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
