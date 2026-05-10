import { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList>;
  ProductDetail: { id: string };
  ProductEdit: { id?: string; barcode?: string };
  StockIn: { productId?: string };
  StockOut: { productId?: string };
  StockCount: undefined;
  ShopifySettings: undefined;
  ShopifyLocations: undefined;
  SyncQueue: undefined;
  BatchScan: { mode: 'in' | 'out' };
};

export type TabsParamList = {
  Dashboard: undefined;
  Products: undefined;
  Scanner: undefined;
  Movements: undefined;
  Settings: undefined;
};
