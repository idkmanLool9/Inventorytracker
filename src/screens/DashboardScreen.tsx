import React, { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart, LineChart } from 'react-native-chart-kit';

import { colors, spacing, typography } from '@/theme';
import {
  DashboardSummary,
  TopMover,
  DailyMovementBucket,
  getDashboardSummary,
  getDailyMovements,
  getTopMovers,
  getLowStockProducts,
} from '@/db/insights';
import { StatTile } from '@/components/StatTile';
import { Card } from '@/components/Card';
import { formatEUR } from '@/utils/currency';
import { useAuthStore, canSeeFinancials } from '@/store/authStore';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(15, 118, 110, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
  propsForBackgroundLines: { stroke: '#E2E8F0' },
};

export function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [daily, setDaily] = useState<DailyMovementBucket[]>([]);
  const [movers, setMovers] = useState<TopMover[]>([]);
  const [lowStock, setLowStock] = useState<{ id: string; name: string; stock: number; min_stock: number }[]>([]);

  const load = useCallback(async () => {
    setSummary(await getDashboardSummary());
    setDaily(await getDailyMovements(7));
    setMovers(await getTopMovers(30, 5));
    setLowStock(await getLowStockProducts(5));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const showFinancials = canSeeFinancials(user);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.grid}>
        <StatTile
          label="Producten"
          value={summary ? String(summary.totalProducts) : '—'}
          hint="actief"
        />
        {showFinancials ? (
          <StatTile
            label="Voorraadwaarde"
            value={summary ? formatEUR(summary.totalStockValueCost) : '—'}
            hint="kostprijs"
            tone="success"
          />
        ) : null}
        <StatTile
          label="Lage voorraad"
          value={summary ? String(summary.lowStock) : '—'}
          tone="warning"
        />
        <StatTile
          label="Niet op voorraad"
          value={summary ? String(summary.outOfStock) : '—'}
          tone="danger"
        />
        <StatTile
          label="Dode voorraad"
          value={summary ? String(summary.deadStock) : '—'}
          hint=">90 dagen"
        />
      </View>

      <Text style={[typography.h3, styles.section]}>Mutaties laatste 7 dagen</Text>
      <Card>
        {daily.length === 0 ? (
          <Text style={styles.muted}>Geen mutaties.</Text>
        ) : (
          <LineChart
            data={{
              labels: daily.map((d) => d.date.slice(5)),
              datasets: [
                { data: daily.map((d) => d.inUnits), color: () => colors.success },
                { data: daily.map((d) => d.outUnits), color: () => colors.danger },
              ],
              legend: ['In', 'Uit'],
            }}
            width={screenWidth - spacing.md * 4}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        )}
      </Card>

      <Text style={[typography.h3, styles.section]}>Top verkopers (30d)</Text>
      <Card>
        {movers.length === 0 ? (
          <Text style={styles.muted}>Nog geen verkopen.</Text>
        ) : (
          <BarChart
            data={{
              labels: movers.map((m) => m.name.slice(0, 8)),
              datasets: [{ data: movers.map((m) => m.unitsSold) }],
            }}
            width={screenWidth - spacing.md * 4}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
            fromZero
            style={styles.chart}
          />
        )}
      </Card>

      <Text style={[typography.h3, styles.section]}>Lage voorraad</Text>
      <Card>
        {lowStock.length === 0 ? (
          <Text style={styles.muted}>Niets om bij te bestellen.</Text>
        ) : (
          lowStock.map((p) => (
            <View key={p.id} style={styles.lowRow}>
              <Text style={styles.lowName}>{p.name}</Text>
              <Text style={styles.lowStock}>
                {p.stock} / {p.min_stock}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs },
  chart: { borderRadius: 12 },
  muted: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  lowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lowName: { color: colors.text },
  lowStock: { color: colors.warning, fontWeight: '700' },
});
