import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme';
import { clearQueue, listQueue } from '@/services/shopify/syncEngine';
import { SyncQueueItem } from '@/types';
import { formatDateTimeNL } from '@/utils/date';

const STATUS_COLOR: Record<string, string> = {
  pending: colors.warning,
  in_progress: colors.info,
  done: colors.success,
  failed: colors.danger,
};

export function SyncQueueScreen() {
  const [items, setItems] = useState<SyncQueueItem[]>([]);

  const reload = useCallback(async () => setItems(await listQueue()), []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          <Text style={styles.muted}>De wachtrij is leeg.</Text>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.op}>{item.operation}</Text>
              <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>
                {item.status}
              </Text>
            </View>
            <Text style={styles.muted}>Aangemaakt: {formatDateTimeNL(item.createdAt)}</Text>
            <Text style={styles.muted}>Pogingen: {item.attempts}</Text>
            {item.lastError ? <Text style={styles.error}>Fout: {item.lastError}</Text> : null}
          </Card>
        )}
      />
      <View style={styles.footer}>
        <Button
          title="Verwerkte items wissen"
          variant="secondary"
          onPress={async () => {
            await clearQueue();
            await reload();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  op: { fontWeight: '700', color: colors.text },
  status: { fontWeight: '700', textTransform: 'uppercase', fontSize: 12 },
  muted: { color: colors.muted, fontSize: 12, marginTop: 2 },
  error: { color: colors.danger, marginTop: spacing.xs, fontSize: 12 },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
