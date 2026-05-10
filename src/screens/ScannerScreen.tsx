import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { BarCodeScanner, BarCodeScannerResult } from 'expo-barcode-scanner';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/types';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme';
import { useProductStore } from '@/store/productStore';
import { isValidEAN, normalizeBarcode } from '@/utils/barcode';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ScannerScreen() {
  const navigation = useNavigation<Nav>();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const findByBarcode = useProductStore((s) => s.findByBarcode);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) =>
      setHasPermission(status === 'granted')
    );
  }, []);

  const handleScan = async ({ data }: BarCodeScannerResult) => {
    if (scanned) return;
    setScanned(true);
    const code = normalizeBarcode(data);
    if (!code) {
      Alert.alert('Ongeldige barcode', 'Geen geldige code herkend.');
      setScanned(false);
      return;
    }
    const product = await findByBarcode(code);
    if (product) {
      navigation.navigate('ProductDetail', { id: product.id });
    } else {
      Alert.alert(
        'Onbekend product',
        `Barcode ${code} is niet gevonden.${
          isValidEAN(code) ? '' : ' (Checksum klopt niet, controleer de code.)'
        }`,
        [
          { text: 'Annuleren', style: 'cancel', onPress: () => setScanned(false) },
          {
            text: 'Nieuw product',
            onPress: () => {
              navigation.navigate('ProductEdit', { barcode: code });
              setTimeout(() => setScanned(false), 1000);
            },
          },
        ]
      );
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Camera-toestemming opvragen...</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera niet beschikbaar</Text>
        <Text style={styles.muted}>Sta cameratoegang toe via Instellingen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleScan}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.overlay}>
        <View style={styles.reticle} />
        <Text style={styles.hint}>Richt op een barcode</Text>
      </View>
      {scanned ? (
        <View style={styles.bottom}>
          <Button title="Opnieuw scannen" onPress={() => setScanned(false)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' },
  muted: { color: colors.muted, marginTop: spacing.sm, textAlign: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reticle: {
    width: 240,
    height: 140,
    borderColor: '#fff',
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  hint: { color: '#fff', marginTop: spacing.md, fontSize: 14 },
  bottom: { padding: spacing.lg, backgroundColor: 'rgba(0,0,0,0.6)' },
});
