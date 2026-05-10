import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { colors, radii, spacing, typography } from '@/theme';
import {
  listShopifyLocations,
  setDefaultShopifyLocation,
  setLocalMapping,
} from '@/db/shopifyLocations';
import { listLocations } from '@/db/locations';
import { Location, ShopifyLocationMapping } from '@/types';
import { useShopifyStore } from '@/store/shopifyStore';
import { syncLocations } from '@/services/shopify/syncEngine';

/**
 * Map each Shopify location to a local store location. Exactly one Shopify
 * location is the "default" — that's where `push_stock` jobs send updates.
 */
export function ShopifyLocationsScreen() {
  const { config, syncing } = useShopifyStore();
  const [remote, setRemote] = useState<ShopifyLocationMapping[]>([]);
  const [local, setLocal] = useState<Location[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRemote(await listShopifyLocations());
    setLocal(await listLocations());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    if (!config.enabled) {
      Alert.alert('Shopify is uitgeschakeld');
      return;
    }
    setRefreshing(true);
    try {
      await syncLocations(config);
      await load();
    } catch (e) {
      Alert.alert('Sync mislukt', (e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const makeDefault = async (id: string) => {
    await setDefaultShopifyLocation(id);
    await load();
  };

  const setMapping = async (shopId: string, localId: string | null) => {
    await setLocalMapping(shopId, localId);
    await load();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={typography.h2}>Shopify-locaties</Text>
      <Text style={styles.muted}>
        Wijs Shopify-locaties toe aan jouw fysieke winkellocaties. De standaard-locatie ontvangt
        voorraadupdates.
      </Text>

      <Button
        title={refreshing || syncing ? 'Bezig...' : 'Locaties ophalen uit Shopify'}
        onPress={refresh}
        loading={refreshing || syncing}
        disabled={!config.enabled}
        style={{ marginTop: spacing.md, marginBottom: spacing.md }}
      />

      {remote.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Nog geen Shopify-locaties bekend.</Text>
        </Card>
      ) : (
        remote.map((r) => (
          <Card key={r.id}>
            <View style={styles.headerRow}>
              <Text style={styles.shopName}>{r.name}</Text>
              <Pressable
                onPress={() => makeDefault(r.id)}
                style={[styles.badge, r.isDefault && styles.badgeActive]}
              >
                <Text style={[styles.badgeText, r.isDefault && styles.badgeTextActive]}>
                  {r.isDefault ? 'Standaard' : 'Maak standaard'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.muted}>Gekoppeld aan fysieke locatie:</Text>
            <View style={styles.choices}>
              <Pressable
                onPress={() => setMapping(r.id, null)}
                style={[styles.chip, !r.localLocationId && styles.chipActive]}
              >
                <Text style={[styles.chipText, !r.localLocationId && styles.chipTextActive]}>
                  Geen
                </Text>
              </Pressable>
              {local.map((loc) => (
                <Pressable
                  key={loc.id}
                  onPress={() => setMapping(r.id, loc.id)}
                  style={[styles.chip, r.localLocationId === loc.id && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, r.localLocationId === loc.id && styles.chipTextActive]}
                  >
                    {loc.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  muted: { color: colors.muted, fontSize: 13, marginTop: spacing.xs },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shopName: { fontWeight: '700', color: colors.text, fontSize: 16 },
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  badgeText: { fontSize: 11, color: colors.muted },
  badgeTextActive: { color: '#fff', fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
