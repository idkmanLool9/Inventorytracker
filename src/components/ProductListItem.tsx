import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Product } from '@/types';
import { colors, radii, spacing } from '@/theme';
import { formatEUR } from '@/utils/currency';

interface Props {
  product: Product;
  onPress: () => void;
  showFinancials?: boolean;
}

export function ProductListItem({ product, onPress, showFinancials = true }: Props) {
  const isLow = product.stock <= product.minStock;
  const isOOS = product.stock === 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      {product.photoUri ? (
        <Image source={{ uri: product.photoUri }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.placeholderText}>{product.name[0]?.toUpperCase() ?? '?'}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.sku}>SKU: {product.sku}</Text>
        {showFinancials ? <Text style={styles.price}>{formatEUR(product.salePrice)}</Text> : null}
      </View>
      <View style={styles.stockBox}>
        <Text
          style={[
            styles.stock,
            isOOS && { color: colors.danger },
            !isOOS && isLow && { color: colors.warning },
          ]}
        >
          {product.stock}
        </Text>
        <Text style={styles.stockLabel}>op voorraad</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  photo: { width: 48, height: 48, borderRadius: radii.sm, marginRight: spacing.md },
  photoPlaceholder: {
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { color: colors.muted, fontWeight: '700' },
  info: { flex: 1 },
  name: { color: colors.text, fontWeight: '600', fontSize: 15 },
  sku: { color: colors.muted, fontSize: 12, marginTop: 2 },
  price: { color: colors.text, fontSize: 13, marginTop: 2 },
  stockBox: { alignItems: 'flex-end', minWidth: 56 },
  stock: { color: colors.text, fontWeight: '700', fontSize: 18 },
  stockLabel: { color: colors.muted, fontSize: 11 },
});
