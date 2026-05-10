import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { runMigrations } from '@/db/migrations';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        await restoreSession();
        setReady(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [restoreSession]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Fout bij opstarten: {error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loading}>Voorraad laden...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loading: { marginTop: 12, color: colors.muted },
  error: { color: colors.danger, textAlign: 'center' },
});
