import { create } from 'zustand';
import { Product } from '@/types';
import { listProducts, findByBarcode, getProduct } from '@/db/products';

interface ProductState {
  products: Product[];
  loading: boolean;
  search: string;
  showLowStockOnly: boolean;
  setSearch: (q: string) => void;
  toggleLowStock: () => void;
  refresh: () => Promise<void>;
  findByBarcode: (code: string) => Promise<Product | null>;
  getById: (id: string) => Promise<Product | null>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loading: false,
  search: '',
  showLowStockOnly: false,
  setSearch: (q) => {
    set({ search: q });
    void get().refresh();
  },
  toggleLowStock: () => {
    set({ showLowStockOnly: !get().showLowStockOnly });
    void get().refresh();
  },
  refresh: async () => {
    set({ loading: true });
    const products = await listProducts({
      search: get().search || undefined,
      lowStock: get().showLowStockOnly,
    });
    set({ products, loading: false });
  },
  findByBarcode: (code) => findByBarcode(code),
  getById: (id) => getProduct(id),
}));
