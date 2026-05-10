import { create } from 'zustand';
import { ShopifyConfig } from '@/types';
import { getJsonSetting, setJsonSetting } from '@/db/settings';
import { runFullSync, queueStockPush } from '@/services/shopify/syncEngine';

const SETTING_KEY = 'shopify_config';

const DEFAULT_CONFIG: ShopifyConfig = {
  enabled: false,
  apiVersion: '2024-04',
  lastSyncAt: null,
};

interface ShopifyState {
  config: ShopifyConfig;
  syncing: boolean;
  lastError: string | null;
  load: () => Promise<void>;
  updateConfig: (patch: Partial<ShopifyConfig>) => Promise<void>;
  toggle: (enabled: boolean) => Promise<void>;
  syncNow: () => Promise<void>;
  pushStock: (productId: string, newStock: number) => Promise<void>;
}

export const useShopifyStore = create<ShopifyState>((set, get) => ({
  config: DEFAULT_CONFIG,
  syncing: false,
  lastError: null,
  load: async () => {
    const saved = await getJsonSetting<ShopifyConfig>(SETTING_KEY);
    set({ config: saved ?? DEFAULT_CONFIG });
  },
  updateConfig: async (patch) => {
    const next = { ...get().config, ...patch };
    await setJsonSetting(SETTING_KEY, next);
    set({ config: next });
  },
  toggle: async (enabled) => {
    await get().updateConfig({ enabled });
  },
  syncNow: async () => {
    if (!get().config.enabled) return;
    set({ syncing: true, lastError: null });
    try {
      await runFullSync(get().config);
      await get().updateConfig({ lastSyncAt: new Date().toISOString() });
    } catch (e) {
      set({ lastError: (e as Error).message });
    } finally {
      set({ syncing: false });
    }
  },
  pushStock: async (productId, newStock) => {
    if (!get().config.enabled) return;
    await queueStockPush(productId, newStock);
  },
}));
