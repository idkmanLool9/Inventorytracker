import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '@/theme';
import { listMovements } from '@/db/movements';
import { StockMovement } from '@/types';
import { formatDateTimeNL } from '@/utils/date';

const LABEL: Record<string, string> = {
  in: 'In',
  out_sale: 'Verkoop',
  out_loss: 'Verlies',
  out_damage: 'Schade',
  count_adjust: 'Telling',
  transfer_in: 'Overplaatsing in',
  transfer_out: 'Overplaatsing uit',
};

export function MovementsScreen() {
  const [movements, setMovements] = useState<StockMovement[]>([]);

  useFocusEffect(
    useCallback(() => {
      listMovements(undefined, 200).then(setMovements);
    }, [])
  );

  return (
    <FlatList
      style={styles.container}
      data={movements}
      keyExtractor={(m) => m.id}
      contentContainerStyle={{ padding: spacing.md }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.muted}>Nog geen mutaties geregistreerd.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.type}>{LABEL[item.type] ?? item.type}</Text>
            <Text style={styles.muted}>{formatDateTimeNL(item.createdAt)}</Text>
            {item.reason ? <Text style={styles.muted}>{item.reason}</Text> : null}
          </View>
          <Text
            style={[
              styles.qty,
              { color: item.type.startsWith('out') || item.type === 'transfer_out' ? colors.danger : colors.success },
            ]}
          >
            {item.type.startsWith('out') || item.type === 'transfer_out' ? '-' : '+'}
            {Math.abs(item.quantity)}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  type: { color: colors.text, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 12, marginTop: 2 },
  qty: { fontWeight: '700', fontSize: 18 },
  empty: { padding: spacing.xl, alignItems: 'center' },
});
