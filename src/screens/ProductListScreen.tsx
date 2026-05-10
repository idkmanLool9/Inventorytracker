import React, { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';

import { useProductStore } from '@/store/productStore';
import { useAuthStore, canEditProducts, canSeeFinancials } from '@/store/authStore';
import { ProductListItem } from '@/components/ProductListItem';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { colors, spacing } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProductListScreen() {
  const navigation = useNavigation<Nav>();
  const { products, refresh, search, setSearch, showLowStockOnly, toggleLowStock } =
    useProductStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Input
          placeholder="Zoek op naam, SKU of barcode"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          style={{ marginBottom: 0 }}
        />
        <View style={styles.row}>
          <Button
            title={showLowStockOnly ? 'Toon alles' : 'Alleen lage voorraad'}
            variant="secondary"
            onPress={toggleLowStock}
            style={{ flex: 1, marginRight: spacing.sm }}
          />
          {canEditProducts(user) ? (
            <Button
              title="+ Nieuw"
              onPress={() => navigation.navigate('ProductEdit', {})}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </View>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <ProductListItem
            product={item}
            onPress={() => navigation.navigate('ProductDetail', { id: item.id })}
            showFinancials={canSeeFinancials(user)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Geen producten"
            hint="Voeg producten toe of importeer een CSV via Instellingen."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: { padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: 'row', marginTop: spacing.md },
});
