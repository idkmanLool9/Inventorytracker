import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { colors, spacing } from '@/theme';
import { listProducts } from '@/db/products';
import { applyStockCount } from '@/db/movements';
import { Product } from '@/types';
import { useAuthStore } from '@/store/authStore';

interface CountRow {
  product: Product;
  actual: string;
}

/**
 * Guided counting mode: walk through products and enter the actual count.
 * Any non-zero delta is recorded as a `count_adjust` movement.
 */
export function StockCountScreen() {
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<CountRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listProducts().then((ps) =>
      setRows(ps.map((p) => ({ product: p, actual: String(p.stock) })))
    );
  }, []);

  const setActual = (id: string, val: string) =>
    setRows((rs) => rs.map((r) => (r.product.id === id ? { ...r, actual: val } : r)));

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    let adjustments = 0;
    try {
      for (const r of rows) {
        const n = Number(r.actual);
        if (!Number.isFinite(n)) continue;
        const m = await applyStockCount(r.product.id, n, user.id);
        if (m) adjustments++;
      }
      Alert.alert('Telling opgeslagen', `${adjustments} aanpassing(en) geregistreerd.`);
    } catch (e) {
      Alert.alert('Fout', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.product.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        renderItem={({ item }) => {
          const delta = Number(item.actual) - item.product.stock;
          return (
            <Card>
              <Text style={styles.name}>{item.product.name}</Text>
              <Text style={styles.muted}>SKU: {item.product.sku}</Text>
              <Text style={styles.muted}>Systeem: {item.product.stock}</Text>
              <Input
                label="Werkelijk aantal"
                value={item.actual}
                onChangeText={(v) => setActual(item.product.id, v)}
                keyboardType="number-pad"
              />
              {delta !== 0 ? (
                <Text style={[styles.delta, { color: delta < 0 ? colors.danger : colors.success }]}>
                  {delta > 0 ? '+' : ''}
                  {delta}
                </Text>
              ) : null}
            </Card>
          );
        }}
      />
      <View style={styles.footer}>
        <Button title="Telling opslaan" onPress={handleSubmit} loading={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  name: { fontWeight: '700', color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 12, marginTop: 2 },
  delta: { fontWeight: '700' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
