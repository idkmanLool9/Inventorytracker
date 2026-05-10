export type UUID = string;

export type Role = 'owner' | 'manager' | 'employee';

export interface User {
  id: UUID;
  name: string;
  email: string;
  role: Role;
  pinHash?: string;
  createdAt: string;
}

export interface Category {
  id: UUID;
  name: string;
  parentId?: UUID | null;
}

export interface Location {
  id: UUID;
  name: string;
  aisle?: string;
  shelf?: string;
  shopifyLocationId?: string | null;
}

export interface Product {
  id: UUID;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId?: UUID | null;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  locationId?: UUID | null;
  photoUri?: string | null;
  shopifyProductId?: string | null;
  shopifyInventoryItemId?: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastMovementAt?: string | null;
}

export interface ProductVariant {
  id: UUID;
  productId: UUID;
  sku: string;
  barcode?: string | null;
  optionName: string;
  optionValue: string;
  stock: number;
  costPrice?: number | null;
  salePrice?: number | null;
  shopifyVariantId?: string | null;
  shopifyInventoryItemId?: string | null;
}

export interface ShopifyLocationMapping {
  id: string; // Shopify location id
  name: string;
  localLocationId?: string | null;
  isDefault: boolean;
}

export type MovementType =
  | 'in'
  | 'out_sale'
  | 'out_loss'
  | 'out_damage'
  | 'count_adjust'
  | 'transfer_in'
  | 'transfer_out';

export interface StockMovement {
  id: UUID;
  productId: UUID;
  variantId?: UUID | null;
  type: MovementType;
  quantity: number;
  reason?: string | null;
  supplier?: string | null;
  batchNumber?: string | null;
  fromLocationId?: UUID | null;
  toLocationId?: UUID | null;
  userId: UUID;
  note?: string | null;
  createdAt: string;
}

export type SyncOperation = 'pull_product' | 'push_stock' | 'push_product' | 'push_variant';
export type SyncStatus = 'pending' | 'in_progress' | 'done' | 'failed';

export interface SyncQueueItem {
  id: UUID;
  operation: SyncOperation;
  payload: string;
  status: SyncStatus;
  attempts: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictLogEntry {
  id: UUID;
  productId: UUID;
  field: string;
  localValue: string;
  remoteValue: string;
  resolution: 'local_wins' | 'remote_wins';
  resolvedAt: string;
}

export interface ShopifyConfig {
  enabled: boolean;
  domain?: string;
  accessToken?: string;
  apiVersion: string;
  lastSyncAt?: string | null;
}
