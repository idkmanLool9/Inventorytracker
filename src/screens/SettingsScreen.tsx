import React, { useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useShopifyStore } from '@/store/shopifyStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ROLE_LABEL: Record<string, string> = {
  owner: 'Eigenaar',
  manager: 'Manager',
  employee: 'Medewerker',
};

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuthStore();
  const { config, load: loadShopify } = useShopifyStore();

  useEffect(() => {
    void loadShopify();
  }, [loadShopify]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={typography.h2}>Instellingen</Text>

      <Card>
        <Text style={typography.h3}>Account</Text>
        {user ? (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={styles.row}>Naam: {user.name}</Text>
            <Text style={styles.row}>E-mail: {user.email}</Text>
            <Text style={styles.row}>Rol: {ROLE_LABEL[user.role]}</Text>
          </View>
        ) : null}
        <Button
          title="Uitloggen"
          variant="secondary"
          onPress={() => {
            Alert.alert('Uitloggen?', undefined, [
              { text: 'Annuleren', style: 'cancel' },
              { text: 'Uitloggen', style: 'destructive', onPress: signOut },
            ]);
          }}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card>
        <Text style={typography.h3}>Shopify</Text>
        <Text style={styles.row}>
          Status: {config.enabled ? 'Gekoppeld' : 'Niet gekoppeld'}
        </Text>
        {config.lastSyncAt ? (
          <Text style={styles.row}>
            Laatste sync: {new Date(config.lastSyncAt).toLocaleString('nl-NL')}
          </Text>
        ) : null}
        <Button
          title="Shopify-instellingen"
          onPress={() => navigation.navigate('ShopifySettings')}
          style={{ marginTop: spacing.md }}
        />
        <Button
          title="Locatie-mapping"
          variant="secondary"
          onPress={() => navigation.navigate('ShopifyLocations')}
          style={{ marginTop: spacing.sm }}
        />
        <Button
          title="Sync-wachtrij"
          variant="secondary"
          onPress={() => navigation.navigate('SyncQueue')}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      <Card>
        <Text style={typography.h3}>Voorraad</Text>
        <Button
          title="Voorraad tellen"
          onPress={() => navigation.navigate('StockCount')}
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { color: colors.text, marginTop: 4 },
});
