import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../config';
import { LANGUAGES, setLanguage, t, useLanguage, type Language } from '../i18n';
import { Icon } from '../ui';

/** The language of the app, as a drop-down: the current one, and the list when pressed. */
export function LanguagePicker() {
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Language')}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 48,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#D5D8DE',
          backgroundColor: colors.surface
        }}
      >
        <Icon name="globe" color={colors.muted} />
        <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{LANGUAGES[language]}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} color={colors.muted} />
      </Pressable>
      {open && (
        <View
          accessibilityRole="radiogroup"
          style={{
            marginTop: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            overflow: 'hidden'
          }}
        >
          {(Object.keys(LANGUAGES) as Language[]).map((l, i) => (
            <Pressable
              key={l}
              accessibilityRole="radio"
              accessibilityState={{ selected: l === language }}
              onPress={() => {
                setLanguage(l);
                setOpen(false);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 48,
                paddingHorizontal: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderColor: colors.border,
                backgroundColor: l === language ? colors.brandSoft : colors.surface
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: l === language ? colors.brandText : colors.text,
                  fontWeight: l === language ? '700' : '400'
                }}
              >
                {LANGUAGES[l]}
              </Text>
              {l === language && <Icon name="check" color={colors.brandText} />}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
