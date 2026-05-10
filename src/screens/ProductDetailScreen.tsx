import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '@/navigation/types';
import { Product, StockMovement } from '@/types';
import { getProduct, archiveProduct } from '@/db/products';
import { listMovements } from '@/db/movements';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { formatEUR } from '@/utils/currency';
import { formatDateTimeNL, daysSince } from '@/utils/date';
import { useAuthStore, canEditProducts, canSeeFinancials } from '@/store/authStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductDetail'>;
type Rt = RouteProp<RootStackParamList, 'ProductDetail'>;

const MOVEMENT_LABELS: Record<string, string> = {
  in: 'Ingeboekt',
  out_sale: 'Verkoop',
  out_loss: 'Verlies',
  out_damage: 'Schade',
  count_adjust: 'Telling',
  transfer_in: 'Overplaatsing in',
  transfer_out: 'Overplaatsing uit',
};

export function ProductDetailScreen() {
  const route = useRoute<Rt>();
  const navigation = useNavigation<Nav>();
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const user = useAuthStore((s) => s.user);

  const load = useCallback(async () => {
    const p = await getProduct(route.params.id);
    setProduct(p);
    if (p) setMovements(await listMovements(p.id, 20));
  }, [route.params.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!product) {
    return (
      <View style={styles.center}>
        <Text>Product niet gevonden.</Text>
      </View>
    );
  }

  const handleArchive = () => {
    Alert.alert('Product archiveren?', 'Het product wordt verborgen.', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Archiveren',
        style: 'destructive',
        onPress: async () => {
          await archiveProduct(product.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const dead = (daysSince(product.lastMovementAt) ?? Infinity) > 90 && product.stock > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <Text style={typography.h2}>{product.name}</Text>
        <Text style={styles.sku}>SKU: {product.sku}</Text>
        {product.barcode ? <Text style={styles.sku}>Barcode: {product.barcode}</Text> : null}
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Voorraad</Text>
            <Text style={styles.statValue}>{product.stock}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Min.</Text>
            <Text style={styles.statValue}>{product.minStock}</Text>
          </View>
          {canSeeFinancials(user) ? (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Verkoopprijs</Text>
              <Text style={styles.statValue}>{formatEUR(product.salePrice)}</Text>
            </View>
          ) : null}
        </View>
        {dead ? <Text style={styles.warn}>Geen beweging in &gt;90 dagen — dode voorraad</Text> : null}
      </Card>

      <View style={styles.actions}>
        <Button
          title="Voorraad in"
          onPress={() => navigation.navigate('StockIn', { productId: product.id })}
          style={{ flex: 1, marginRight: spacing.sm }}
        />
        <Button
          title="Voorraad uit"
          variant="danger"
          onPress={() => navigation.navigate('StockOut', { productId: product.id })}
          style={{ flex: 1 }}
        />
      </View>
      {canEditProducts(user) ? (
        <Button
          title="Bewerken"
          variant="secondary"
          onPress={() => navigation.navigate('ProductEdit', { id: product.id })}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}

      <Text style={[typography.h3, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
        Laatste mutaties
      </Text>
      {movements.length === 0 ? (
        <Text style={styles.muted}>Nog geen mutaties.</Text>
      ) : (
        movements.map((m) => (
          <Card key={m.id}>
            <Text style={{ fontWeight: '600' }}>
              {MOVEMENT_LABELS[m.type] ?? m.type} — {m.quantity > 0 ? '+' : ''}
              {m.quantity}
            </Text>
            <Text style={styles.muted}>{formatDateTimeNL(m.createdAt)}</Text>
            {m.reason ? <Text style={styles.muted}>Reden: {m.reason}</Text> : null}
            {m.supplier ? <Text style={styles.muted}>Leverancier: {m.supplier}</Text> : null}
            {m.batchNumber ? <Text style={styles.muted}>Batch: {m.batchNumber}</Text> : null}
          </Card>
        ))
      )}

      {canEditProducts(user) ? (
        <Button
          title="Product archiveren"
          variant="ghost"
          onPress={handleArchive}
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sku: { color: colors.muted, marginTop: 4 },
  statRow: { flexDirection: 'row', marginTop: spacing.md },
  stat: { flex: 1 },
  statLabel: { color: colors.muted, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 2 },
  warn: { color: colors.warning, marginTop: spacing.sm, fontWeight: '600' },
  actions: { flexDirection: 'row' },
  muted: { color: colors.muted, fontSize: 13 },
});
