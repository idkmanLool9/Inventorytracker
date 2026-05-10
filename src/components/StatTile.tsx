import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/theme';

interface Props {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}

export function StatTile({ label, value, hint, tone = 'default' }: Props) {
  const accent =
    tone === 'warning'
      ? colors.warning
      : tone === 'danger'
      ? colors.danger
      : tone === 'success'
      ? colors.success
      : colors.primary;
  return (
    <View style={[styles.tile, { borderLeftColor: accent }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    minWidth: '47%',
    margin: spacing.xs,
  },
  label: { color: colors.muted, fontSize: 12, marginBottom: 4, textTransform: 'uppercase' },
  value: { color: colors.text, fontSize: 22, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
