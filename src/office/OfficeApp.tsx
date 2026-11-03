import { Text, View } from 'react-native';
import { colors } from '../config';
import type { Layout } from '../roles';

/** The screens for team managers, operations supervisors and administrators. */
export function OfficeApp({ layout }: { layout: Exclude<Layout, 'field'> }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text>{layout}</Text>
    </View>
  );
}
