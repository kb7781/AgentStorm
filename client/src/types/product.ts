export interface Product {
  id: string;
  merchantId: string;
  name: string;
  description: string;
  price: string; // Decimal comes as string from API
  stock: number;
  category: string;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  merchant?: {
    id: string;
    name: string;
  };
}

export interface ProductsResponse {
  products: Product[];
  count: number;
}

export interface ProductResponse {
  product: Product;
}
