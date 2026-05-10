import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';
import { useShopifyStore } from '@/store/shopifyStore';

export function ShopifySettingsScreen() {
  const { config, load, updateConfig, syncNow, syncing, lastError } = useShopifyStore();
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    load().then(() => {
      setDomain(config.domain ?? '');
      setToken(config.accessToken ?? '');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    await updateConfig({ domain: domain.trim(), accessToken: token.trim() });
    Alert.alert('Opgeslagen');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <View style={styles.row}>
          <Text style={typography.h3}>Koppeling actief</Text>
          <Switch
            value={config.enabled}
            onValueChange={(v) => updateConfig({ enabled: v })}
          />
        </View>
        <Text style={styles.muted}>
          Indien uitgeschakeld werkt de app volledig lokaal en wordt er niets naar Shopify
          gestuurd.
        </Text>
      </Card>

      <Card>
        <Text style={typography.h3}>API-toegang</Text>
        <Input
          label="Shop-domein"
          value={domain}
          onChangeText={setDomain}
          placeholder="mijnwinkel.myshopify.com"
          autoCapitalize="none"
        />
        <Input
          label="Admin access token"
          value={token}
          onChangeText={setToken}
          secureTextEntry
          autoCapitalize="none"
        />
        <Button title="Opslaan" onPress={save} />
      </Card>

      <Card>
        <Text style={typography.h3}>Synchroniseren</Text>
        <Text style={styles.muted}>
          Trekt producten op uit Shopify en verstuurt openstaande wijzigingen uit de wachtrij.
        </Text>
        <Button
          title={syncing ? 'Bezig...' : 'Synchroniseer nu'}
          onPress={syncNow}
          loading={syncing}
          disabled={!config.enabled}
          style={{ marginTop: spacing.sm }}
        />
        {lastError ? <Text style={styles.error}>Fout: {lastError}</Text> : null}
        {config.lastSyncAt ? (
          <Text style={styles.muted}>
            Laatste sync: {new Date(config.lastSyncAt).toLocaleString('nl-NL')}
          </Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: colors.muted, fontSize: 13, marginTop: spacing.xs },
  error: { color: colors.danger, marginTop: spacing.sm },
});
