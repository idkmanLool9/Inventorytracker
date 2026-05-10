import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '@/navigation/types';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme';
import { applyMovement } from '@/db/movements';
import { getProduct, findByBarcode } from '@/db/products';
import { Product } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useShopifyStore } from '@/store/shopifyStore';

type Nav = NativeStackNavigationProp<RootStackParamList, 'StockIn'>;
type Rt = RouteProp<RootStackParamList, 'StockIn'>;

export function StockInScreen() {
  const route = useRoute<Rt>();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const pushStock = useShopifyStore((s) => s.pushStock);

  const [product, setProduct] = useState<Product | null>(null);
  const [barcode, setBarcode] = useState('');
  const [qty, setQty] = useState('1');
  const [supplier, setSupplier] = useState('');
  const [batch, setBatch] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (route.params?.productId) {
      getProduct(route.params.productId).then(setProduct);
    }
  }, [route.params?.productId]);

  const lookup = async () => {
    const p = await findByBarcode(barcode.trim());
    if (p) {
      setProduct(p);
    } else {
      Alert.alert('Niet gevonden', `Geen product met barcode ${barcode}`);
    }
  };

  const handleSave = async () => {
    if (!product) {
      Alert.alert('Selecteer eerst een product');
      return;
    }
    const quantity = Number(qty);
    if (!quantity || quantity <= 0) {
      Alert.alert('Ongeldig aantal');
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      await applyMovement({
        productId: product.id,
        type: 'in',
        quantity,
        supplier: supplier.trim() || null,
        batchNumber: batch.trim() || null,
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

      <Input label="Aantal" value={qty} onChangeText={setQty} keyboardType="number-pad" />
      <Input label="Leverancier (optioneel)" value={supplier} onChangeText={setSupplier} />
      <Input label="Batchnummer (optioneel)" value={batch} onChangeText={setBatch} />
      <Input label="Notitie (optioneel)" value={note} onChangeText={setNote} multiline />
      <Button title="Inboeken" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  label: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  product: { fontWeight: '700', fontSize: 16, color: colors.text },
  muted: { color: colors.muted, marginTop: 4, marginBottom: spacing.md },
});
