import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '@/navigation/types';
import { colors, radii, spacing } from '@/theme';
import { Button } from '@/components/Button';
import { Product } from '@/types';
import { findByBarcode, getProduct } from '@/db/products';
import { applyMovement } from '@/db/movements';
import { normalizeBarcode } from '@/utils/barcode';
import { useAuthStore } from '@/store/authStore';
import { useShopifyStore } from '@/store/shopifyStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'BatchScan'>;
type Rt = RouteProp<RootStackParamList, 'BatchScan'>;

interface ScanLine {
  scanId: string;
  productId: string;
  name: string;
  count: number;
  lastMovementId: string;
}

/**
 * Continuous +1-per-scan batch flow. Each scan:
 *   1. Looks up the product by barcode.
 *   2. Applies a movement (stock_in or stock_out) of qty 1.
 *   3. Coalesces into the on-screen list (same product → bump counter).
 *   4. Plays a haptic tap on success, an error rumble on failure.
 *
 * Tap a row to undo its last unit (reverses the most recent +1).
 */
export function BatchScanScreen() {
  const route = useRoute<Rt>();
  const navigation = useNavigation<Nav>();
  const mode = route.params.mode;
  const user = useAuthStore((s) => s.user);
  const pushStock = useShopifyStore((s) => s.pushStock);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const lockRef = useRef(false); // dedupe rapid duplicate scans (~600ms)

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) =>
      setHasPermission(status === 'granted')
    );
  }, []);

  const recordSuccess = useCallback(
    (product: Product, movementId: string) => {
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.productId === product.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            count: next[idx].count + 1,
            lastMovementId: movementId,
          };
          return next;
        }
        return [
          {
            scanId: movementId,
            productId: product.id,
            name: product.name,
            count: 1,
            lastMovementId: movementId,
          },
          ...prev,
        ];
      });
    },
    []
  );

  const onScan = async ({ data }: { data: string }) => {
    if (lockRef.current || !user) return;
    lockRef.current = true;
    setTimeout(() => {
      lockRef.current = false;
    }, 600);

    const code = normalizeBarcode(data);
    setLastCode(code);
    if (!code) return;

    try {
      const product = await findByBarcode(code);
      if (!product) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      const movement = await applyMovement({
        productId: product.id,
        type: mode === 'in' ? 'in' : 'out_sale',
        quantity: 1,
        userId: user.id,
        reason: mode === 'out' ? 'Verkoop' : null,
      });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      recordSuccess(product, movement.id);

      // Push stock to Shopify asynchronously (uses the queue if offline).
      const refreshed = await getProduct(product.id);
      if (refreshed) await pushStock(refreshed.id, refreshed.stock);
    } catch (e) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Fout', (e as Error).message);
    }
  };

  const undoLine = async (line: ScanLine) => {
    if (!user) return;
    try {
      // Reverse a single unit by issuing the opposite movement.
      // For 'in' batch: reverse with out_loss; for 'out': reverse with 'in'.
      await applyMovement({
        productId: line.productId,
        type: mode === 'in' ? 'out_loss' : 'in',
        quantity: 1,
        userId: user.id,
        note: 'Undo van batchscan',
      });
      setLines((prev) =>
        prev
          .map((l) =>
            l.scanId === line.scanId ? { ...l, count: l.count - 1 } : l
          )
          .filter((l) => l.count > 0)
      );
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      Alert.alert('Undo mislukt', (e as Error).message);
    }
  };

  const totalUnits = lines.reduce((s, l) => s + l.count, 0);

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Camera-toestemming geweigerd.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.scannerWrap}>
        {hasPermission ? (
          <BarCodeScanner onBarCodeScanned={onScan} style={StyleSheet.absoluteFillObject} />
        ) : null}
        <View style={styles.overlay}>
          <View style={styles.reticle} />
        </View>
      </View>

      <View style={styles.bar}>
        <Text style={styles.barTitle}>
          {mode === 'in' ? 'Voorraad in (+1 per scan)' : 'Verkoop (-1 per scan)'}
        </Text>
        <Text style={styles.barSubtitle}>
          {totalUnits} item(s) gescand · laatste: {lastCode ?? '—'}
        </Text>
      </View>

      <FlatList
        style={styles.list}
        data={lines}
        keyExtractor={(l) => l.scanId}
        contentContainerStyle={{ padding: spacing.md }}
        ListEmptyComponent={
          <Text style={styles.muted}>Scan een barcode om te beginnen.</Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => undoLine(item)} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.muted}>Tik om laatste eenheid terug te draaien</Text>
            </View>
            <Text style={[styles.count, mode === 'out' && { color: colors.danger }]}>
              {mode === 'in' ? '+' : '-'}
              {item.count}
            </Text>
          </Pressable>
        )}
      />

      <View style={styles.footer}>
        <Button title="Klaar" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  scannerWrap: { height: 220, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  reticle: { width: 220, height: 80, borderColor: '#fff', borderWidth: 2, borderRadius: 8 },
  bar: { padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  barTitle: { fontWeight: '700', color: colors.text },
  barSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowName: { color: colors.text, fontWeight: '600' },
  count: { color: colors.success, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
