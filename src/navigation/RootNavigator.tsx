import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { RootStackParamList, TabsParamList } from './types';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { ProductListScreen } from '@/screens/ProductListScreen';
import { ProductDetailScreen } from '@/screens/ProductDetailScreen';
import { ProductEditScreen } from '@/screens/ProductEditScreen';
import { ScannerScreen } from '@/screens/ScannerScreen';
import { MovementsScreen } from '@/screens/MovementsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { StockInScreen } from '@/screens/StockInScreen';
import { StockOutScreen } from '@/screens/StockOutScreen';
import { StockCountScreen } from '@/screens/StockCountScreen';
import { ShopifySettingsScreen } from '@/screens/ShopifySettingsScreen';
import { SyncQueueScreen } from '@/screens/SyncQueueScreen';
import { colors } from '@/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabsParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Tabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Overzicht' }}
      />
      <Tabs.Screen
        name="Products"
        component={ProductListScreen}
        options={{ title: 'Producten' }}
      />
      <Tabs.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Scan' }} />
      <Tabs.Screen
        name="Movements"
        component={MovementsScreen}
        options={{ title: 'Mutaties' }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Instellingen' }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'Productdetails' }}
      />
      <Stack.Screen
        name="ProductEdit"
        component={ProductEditScreen}
        options={{ title: 'Product bewerken' }}
      />
      <Stack.Screen name="StockIn" component={StockInScreen} options={{ title: 'Voorraad in' }} />
      <Stack.Screen
        name="StockOut"
        component={StockOutScreen}
        options={{ title: 'Voorraad uit' }}
      />
      <Stack.Screen
        name="StockCount"
        component={StockCountScreen}
        options={{ title: 'Voorraadtelling' }}
      />
      <Stack.Screen
        name="ShopifySettings"
        component={ShopifySettingsScreen}
        options={{ title: 'Shopify-koppeling' }}
      />
      <Stack.Screen
        name="SyncQueue"
        component={SyncQueueScreen}
        options={{ title: 'Sync-wachtrij' }}
      />
    </Stack.Navigator>
  );
}
