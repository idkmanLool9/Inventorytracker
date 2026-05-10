import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '@/navigation/types';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { colors, radii, spacing } from '@/theme';
import { applyMovement } from '@/db/movements';
import { findByBarcode, getProduct } from '@/db/products';
import { MovementType, Product } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useShopifyStore } from '@/store/shopifyStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'StockOut'>;
type Rt = RouteProp<RootStackParamList, 'StockOut'>;

const REASONS: { type: MovementType; label: string }[] = [
  { type: 'out_sale', label: 'Verkoop' },
  { type: 'out_damage', label: 'Schade' },
  { type: 'out_loss', label: 'Verlies/diefstal' },
];

export function StockOutScreen() {
  const route = useRoute<Rt>();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const pushStock = useShopifyStore((s) => s.pushStock);

  const [product, setProduct] = useState<Product | null>(null);
  const [barcode, setBarcode] = useState('');
  const [qty, setQty] = useState('1');
  const [type, setType] = useState<MovementType>('out_sale');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (route.params?.productId) getProduct(route.params.productId).then(setProduct);
  }, [route.params?.productId]);

  const lookup = async () => {
    const p = await findByBarcode(barcode.trim());
    if (p) setProduct(p);
    else Alert.alert('Niet gevonden', `Geen product met barcode ${barcode}`);
  };

  const handleSave = async () => {
    if (!product || !user) return;
    const quantity = Number(qty);
    if (!quantity || quantity <= 0) {
      Alert.alert('Ongeldig aantal');
      return;
    }
    setSaving(true);
    try {
      await applyMovement({
        productId: product.id,
        type,
        quantity,
        reason: REASONS.find((r) => r.type === type)?.label ?? null,
        note: note.trim() || null,
        userId: user.id,
      });
      const updated = await getProduct(product.id);
      if (updated) await pushStock(updated.id, updated.stock);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Fout', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      {!product ? (
        <View>
          <Input
            label="Scan of typ barcode"
            value={barcode}
            onChangeText={setBarcode}
            keyboardType="number-pad"
            onSubmitEditing={lookup}
          />
          <Button title="Zoek product" variant="secondary" onPress={lookup} />
        </View>
      ) : (
        <View>
          <Text style={styles.label}>Product</Text>
          <Text style={styles.product}>{product.name}</Text>
          <Text style={styles.muted}>Huidige voorraad: {product.stock}</Text>
        </View>
      )}

      <Text style={styles.label}>Reden</Text>
      <View style={styles.reasonRow}>
        {REASONS.map((r) => (
          <Pressable
            key={r.type}
            onPress={() => setType(r.type)}
            style={[styles.chip, type === r.type && styles.chipActive]}
          >
            <Text style={[styles.chipText, type === r.type && styles.chipTextActive]}>
              {r.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input label="Aantal" value={qty} onChangeText={setQty} keyboardType="number-pad" />
      <Input label="Notitie (optioneel)" value={note} onChangeText={setNote} multiline />
      <Button title="Uitboeken" variant="danger" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  label: { color: colors.muted, fontSize: 12, marginBottom: spacing.xs, marginTop: spacing.md },
  product: { fontWeight: '700', fontSize: 16, color: colors.text },
  muted: { color: colors.muted, marginTop: 4, marginBottom: spacing.md },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
});
