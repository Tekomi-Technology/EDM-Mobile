import { Modal, Pressable, Text, View } from 'react-native';
import { colors } from '../config';
import { t } from '../i18n';
import { Icon, styles as ui, type IconName } from '../ui';
import type { CreateChoice } from './shell';

const CHOICES: Record<CreateChoice, { title: string; detail: string; icon: IconName }> = {
  customer: {
    title: 'Customer ticket',
    detail: 'A customer calls about no power or a complaint',
    icon: 'phone-call'
  },
  planned: {
    title: 'Planned maintenance',
    detail: 'Maintenance or a network change, with a date',
    icon: 'tool'
  },
  new_customer: { title: 'Survey or new connection', detail: 'Without the Sales system', icon: 'home' }
};

/** The sheet the + button opens: what to create. */
export function CreateSheet({
  choices,
  onChoose,
  onClose
}: {
  choices: CreateChoice[];
  onChoose: (choice: CreateChoice) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(29,36,51,0.35)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 16,
          paddingBottom: 32,
          gap: 4
        }}
      >
        <Text style={[ui.cardTitle, { marginBottom: 8 }]}>{t('Create')}</Text>
        {choices.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            onPress={() => onChoose(c)}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12 }}
          >
            <Icon name={CHOICES[c].icon} color={colors.brandText} />
            <View style={{ flex: 1 }}>
              <Text style={ui.body}>{t(CHOICES[c].title)}</Text>
              <Text style={ui.label}>{t(CHOICES[c].detail)}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}
