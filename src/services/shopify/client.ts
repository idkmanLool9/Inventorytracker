import { ShopifyConfig } from '@/types';

export interface ShopifyProductDTO {
  id: string;
  title: string;
  handle: string;
  vendor?: string;
  variants: ShopifyVariantDTO[];
}

export interface ShopifyVariantDTO {
  id: string;
  sku: string;
  barcode?: string;
  price: string;
  inventory_quantity: number;
  inventory_item_id: string;
  option1?: string;
  option2?: string;
}

export interface ShopifyLocationDTO {
  id: string;
  name: string;
}

/**
 * Minimal Shopify Admin API client. In production this would call
 * https://{domain}/admin/api/{version}/... — for offline/dev/testing we
 * expose a mock-friendly interface and let the sync engine work either way.
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

  async listLocations(): Promise<ShopifyLocationDTO[]> {
    const data = await this.request<{ locations: ShopifyLocationDTO[] }>('/locations.json');
    return data.locations;
  }

  /**
   * Push stock to Shopify using the Inventory Levels endpoint.
   * Returns the new available quantity reported by Shopify.
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
