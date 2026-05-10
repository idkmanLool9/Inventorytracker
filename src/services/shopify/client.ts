import { ShopifyConfig } from '@/types';

export interface ShopifyProductDTO {
  id: string;
  title: string;
  handle: string;
  vendor?: string;
  body_html?: string;
  status?: 'active' | 'draft' | 'archived';
  variants: ShopifyVariantDTO[];
  updated_at?: string;
}

export interface ShopifyVariantDTO {
  id: string;
  sku: string;
  barcode?: string | null;
  price: string;
  inventory_quantity: number;
  inventory_item_id: string;
  option1?: string | null;
  option2?: string | null;
}

export interface ShopifyLocationDTO {
  id: string;
  name: string;
}

export interface ShopifyInventoryLevel {
  inventory_item_id: string;
  location_id: string;
  available: number;
}

export interface CreateProductInput {
  title: string;
  body_html?: string;
  vendor?: string;
  status?: 'active' | 'draft';
  variants: Array<{
    sku?: string;
    barcode?: string | null;
    price?: string;
    option1?: string;
    option2?: string;
  }>;
}

export interface UpdateProductInput {
  id: string;
  title?: string;
  variants?: Array<{ id?: string; sku?: string; barcode?: string | null; price?: string }>;
}

/**
 * REST Admin API client (2024-04). All endpoints are JSON. The methods used
 * here are a curated subset — calls go through the same `request()` so
 * error handling and auth are consistent.
 *
 * Network errors surface as `Error` with the HTTP status in the message;
 * the sync engine treats those as retryable.
 */
export class ShopifyClient {
  constructor(private cfg: ShopifyConfig) {}

  private baseUrl() {
    return `https://${this.cfg.domain}/admin/api/${this.cfg.apiVersion}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.cfg.enabled || !this.cfg.domain || !this.cfg.accessToken) {
      throw new Error('Shopify is niet geconfigureerd');
    }
    const res = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: {
        'X-Shopify-Access-Token': this.cfg.accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Shopify API ${res.status}: ${body || res.statusText}`);
    }
    return (await res.json()) as T;
  }

  async listProducts(limit = 50): Promise<ShopifyProductDTO[]> {
    const data = await this.request<{ products: ShopifyProductDTO[] }>(
      `/products.json?limit=${limit}`
    );
    return data.products;
  }

  async getProduct(id: string): Promise<ShopifyProductDTO> {
    const data = await this.request<{ product: ShopifyProductDTO }>(`/products/${id}.json`);
    return data.product;
  }

  async createProduct(input: CreateProductInput): Promise<ShopifyProductDTO> {
    const data = await this.request<{ product: ShopifyProductDTO }>('/products.json', {
      method: 'POST',
      body: JSON.stringify({ product: input }),
    });
    return data.product;
  }

  async updateProduct(input: UpdateProductInput): Promise<ShopifyProductDTO> {
    const { id, ...rest } = input;
    const data = await this.request<{ product: ShopifyProductDTO }>(
      `/products/${id}.json`,
      { method: 'PUT', body: JSON.stringify({ product: { id, ...rest } }) }
    );
    return data.product;
  }

  async listLocations(): Promise<ShopifyLocationDTO[]> {
    const data = await this.request<{ locations: ShopifyLocationDTO[] }>('/locations.json');
    return data.locations;
  }

  async listInventoryLevels(inventoryItemIds: string[]): Promise<ShopifyInventoryLevel[]> {
    if (inventoryItemIds.length === 0) return [];
    const data = await this.request<{ inventory_levels: ShopifyInventoryLevel[] }>(
      `/inventory_levels.json?inventory_item_ids=${inventoryItemIds.join(',')}`
    );
    return data.inventory_levels;
  }

  /**
   * Set inventory at a specific location. Returns the resulting available qty.
   */
  async setInventoryLevel(
    inventoryItemId: string,
    locationId: string,
    available: number
  ): Promise<number> {
    const data = await this.request<{ inventory_level: { available: number } }>(
      '/inventory_levels/set.json',
      {
        method: 'POST',
        body: JSON.stringify({
          inventory_item_id: inventoryItemId,
          location_id: locationId,
          available,
        }),
      }
    );
    return data.inventory_level.available;
  }
}
