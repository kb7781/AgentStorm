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

// ─── Day 2: Commerce Types ─────────────────────────────

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  product?: {
    id: string;
    name: string;
    category: string;
  };
}

export interface Payment {
  id: string;
  status: "PENDING" | "CAPTURED" | "FAILED";
  razorpayPaymentId: string | null;
  amount: string;
  createdAt: string;
}

export interface Order {
  id: string;
  email: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  totalAmount: string;
  razorpayOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payment: Payment | null;
}

export interface CreateOrderResponse {
  order: Order;
}

export interface CreatePaymentResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentResponse {
  verified: boolean;
  orderId: string;
  status: string;
  message: string;
}

// Razorpay Checkout types
export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id: string;
      payment_id: string;
    };
  };
}
