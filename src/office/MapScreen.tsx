import { useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { FlatList, Linking, Platform, Pressable, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { colors } from '../config';
import { t } from '../i18n';
import { Button, styles as ui } from '../ui';
import type { OfficeNav } from './OfficeApp';
import { officeApi } from './officeApi';
import { LoadState, Row } from './officeUi';
import { mapAvailable } from './mapAvailable';
import { pinsFor, type MapFilter, type Pin } from './pins';
import { useRemote } from './remote';

/** False on an Android build made without the Google Maps key: the list only. */
const CAN_DRAW = mapAvailable(
  Platform.OS,
  Constants.expoConfig?.extra as { googleMapsKey?: boolean } | undefined
);

/** Maputo, until there is something to show. */
const START: Region = { latitude: -25.95, longitude: 32.58, latitudeDelta: 0.35, longitudeDelta: 0.35 };

/** Office map (mockup A): the whole screen, filters on top, a list pulled up from the bottom. */
export function MapScreen({ nav }: { nav: OfficeNav }) {
  const [filter, setFilter] = useState<MapFilter>('staff');
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const map = useRef<MapView>(null);
  const data = useRemote(async (token) => {
    const [live, incidents] = await Promise.all([officeApi.live(token), officeApi.incidents(token)]);
    return { live, incidents };
  }, []);
  const { reload } = data;
  useEffect(() => {
    const timer = setInterval(reload, 30_000);
    return () => clearInterval(timer);
  }, [reload]);

  const all = useMemo(() => {
    if (!data.data) return { staff: [], incidents: [], tickets: [] } as Record<MapFilter, Pin[]>;
    const at = new Date();
    return {
      staff: pinsFor(data.data.live, data.data.incidents, 'staff', at),
      incidents: pinsFor(data.data.live, data.data.incidents, 'incidents', at),
      tickets: pinsFor(data.data.live, data.data.incidents, 'tickets', at)
    };
  }, [data.data]);
  const pins = all[filter];
  const staffById = new Map((data.data?.live.staff ?? []).map((s) => [s.id, s]));

  const choose = (p: Pin) => {
    setSelected(p.id);
    setOpen(true);
    map.current?.animateToRegion({
      latitude: p.lat,
      longitude: p.lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05
    });
  };
  const openPin = (p: Pin) => {
    if (p.kind === 'staff') {
      const phone = staffById.get(p.id)?.phone;
      if (phone) void Linking.openURL(`tel:${phone}`);
    } else nav.openTicket(p.id);
  };
  const listed = selected
    ? [...pins.filter((p) => p.id === selected), ...pins.filter((p) => p.id !== selected)]
    : pins;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {CAN_DRAW ? (
        <MapView ref={map} style={{ flex: 1 }} initialRegion={START} showsUserLocation={false}>
          {pins.map((p) => (
            <Marker
              key={`${p.kind}:${p.id}`}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              onPress={() => choose(p)}
              tracksViewChanges={false}
            >
              <View
                style={
                  p.kind === 'incident'
                    ? {
                        width: 0,
                        height: 0,
                        borderLeftWidth: 11,
                        borderRightWidth: 11,
                        borderBottomWidth: 19,
                        borderLeftColor: 'transparent',
                        borderRightColor: 'transparent',
                        borderBottomColor: p.color
                      }
                    : {
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: p.color,
                        borderWidth: 2,
                        borderColor: '#fff'
                      }
                }
              />
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={[ui.label, { textAlign: 'center' }]}>
            {t('The map is not available in this version. The list is below.')}
          </Text>
        </View>
      )}
      <View
        style={{
          position: 'absolute',
          top: 52,
          left: 12,
          right: 12,
          flexDirection: 'row',
          gap: 8,
          flexWrap: 'wrap'
        }}
      >
        {(
          [
            ['staff', 'Staff'],
            ['incidents', 'Incidents'],
            ['tickets', 'Tickets']
          ] as [MapFilter, string][]
        ).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === key }}
            onPress={() => {
              setFilter(key);
              setSelected(null);
            }}
            style={{
              backgroundColor: filter === key ? colors.brand : colors.surface,
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 8,
              elevation: 2,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 }
            }}
          >
            <Text style={{ fontWeight: '700', color: filter === key ? colors.brandInk : colors.text }}>
              {t(label)} {all[key].length}
            </Text>
          </Pressable>
        ))}
      </View>
      {!data.data && (
        <View style={{ position: 'absolute', top: 110, left: 16, right: 16 }}>
          <LoadState loading={data.loading} error={data.error} hasData={false} onRetry={data.reload} />
        </View>
      )}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.surface,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          maxHeight: open || !CAN_DRAW ? '70%' : 150,
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 8
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(open ? 'Show less' : 'Show the list')}
          onPress={() => setOpen(!open)}
          style={{ alignItems: 'center', paddingVertical: 8 }}
        >
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD' }} />
        </Pressable>
        <FlatList
          data={listed}
          keyExtractor={(p) => `${p.kind}:${p.id}`}
          ListEmptyComponent={<Text style={[ui.label, { padding: 16 }]}>{t('Nothing to show here.')}</Text>}
          renderItem={({ item }) => (
            <View>
              <Row dot={item.color} title={item.label} detail={item.detail} onPress={() => choose(item)} />
              {item.id === selected && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <Button
                    label={t(item.kind === 'staff' ? 'Call' : 'Open')}
                    kind="soft"
                    icon={item.kind === 'staff' ? 'phone' : 'file-text'}
                    disabled={item.kind === 'staff' && !staffById.get(item.id)?.phone}
                    onPress={() => openPin(item)}
                  />
                </View>
              )}
            </View>
          )}
        />
      </View>
    </View>
  );
}
