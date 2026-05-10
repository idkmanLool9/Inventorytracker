import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '@/navigation/types';
import { getProduct, upsertProduct } from '@/db/products';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme';
import { parseEUR } from '@/utils/currency';
import { useShopifyStore } from '@/store/shopifyStore';
import { queueProductPush } from '@/services/shopify/syncEngine';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductEdit'>;
type Rt = RouteProp<RootStackParamList, 'ProductEdit'>;

interface FormState {
  name: string;
  sku: string;
  barcode: string;
  costPrice: string;
  salePrice: string;
  minStock: string;
  initialStock: string;
}

const EMPTY: FormState = {
  name: '',
  sku: '',
  barcode: '',
  costPrice: '',
  salePrice: '',
  minStock: '0',
  initialStock: '0',
};

export function ProductEditScreen() {
  const route = useRoute<Rt>();
  const navigation = useNavigation<Nav>();
  const { config } = useShopifyStore();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const isNew = !route.params?.id;

  useEffect(() => {
    if (route.params?.id) {
      getProduct(route.params.id).then((p) => {
        if (!p) return;
        setForm({
          name: p.name,
          sku: p.sku,
          barcode: p.barcode ?? '',
          costPrice: String(p.costPrice),
          salePrice: String(p.salePrice),
          minStock: String(p.minStock),
          initialStock: String(p.stock),
        });
      });
    } else if (route.params?.barcode) {
      setForm((f) => ({ ...f, barcode: route.params!.barcode! }));
    }
  }, [route.params]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Naam is verplicht';
    if (!form.sku.trim()) next.sku = 'SKU is verplicht';
    if (parseEUR(form.salePrice) < 0) next.salePrice = 'Mag niet negatief zijn';
    if (parseEUR(form.costPrice) < 0) next.costPrice = 'Mag niet negatief zijn';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const saved = await upsertProduct({
        id: route.params?.id,
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || null,
        costPrice: parseEUR(form.costPrice),
        salePrice: parseEUR(form.salePrice),
        stock: Number(form.initialStock) || 0,
        minStock: Number(form.minStock) || 0,
      });
      if (config.enabled) {
        await queueProductPush(saved.id);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Opslaan mislukt', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.section}>{isNew ? 'Nieuw product' : 'Product bewerken'}</Text>
      <Input
        label="Naam"
        value={form.name}
        onChangeText={(v) => set('name', v)}
        error={errors.name}
      />
      <Input label="SKU" value={form.sku} onChangeText={(v) => set('sku', v)} error={errors.sku} autoCapitalize="none" />
      <Input
        label="Barcode (EAN/UPC)"
        value={form.barcode}
        onChangeText={(v) => set('barcode', v)}
        keyboardType="number-pad"
      />
      <View style={styles.row}>
        <View style={styles.col}>
          <Input
            label="Kostprijs"
            value={form.costPrice}
            onChangeText={(v) => set('costPrice', v)}
            keyboardType="decimal-pad"
            error={errors.costPrice}
          />
        </View>
        <View style={styles.col}>
          <Input
            label="Verkoopprijs"
            value={form.salePrice}
            onChangeText={(v) => set('salePrice', v)}
            keyboardType="decimal-pad"
            error={errors.salePrice}
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Input
            label="Min. voorraad"
            value={form.minStock}
            onChangeText={(v) => set('minStock', v)}
            keyboardType="number-pad"
          />
        </View>
        {isNew ? (
          <View style={styles.col}>
            <Input
              label="Beginvoorraad"
              value={form.initialStock}
              onChangeText={(v) => set('initialStock', v)}
              keyboardType="number-pad"
            />
          </View>
        ) : null}
      </View>
      <Button title="Opslaan" onPress={handleSave} loading={saving} />
      <Button
        title="Annuleren"
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: 'row' },
  col: { flex: 1, marginRight: spacing.sm },
});
