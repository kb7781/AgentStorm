"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Product,
  ProductsResponse,
  CartItem,
  Order,
  RazorpaySuccessResponse,
  CreatePaymentResponse,
  VerifyPaymentResponse,
  CreateOrderResponse,
} from "@/types/product";
import ProductCard from "@/components/ProductCard";
import Cart from "@/components/Cart";
import BuyerPanel from "@/components/BuyerPanel";
import SimulationPanel from "@/components/SimulationPanel";
import BuyerIntelligence from "@/components/BuyerIntelligence";
import SimulationIntelligence from "@/components/SimulationIntelligence";
import ProductDetailsModal from "@/components/ProductDetailsModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Razorpay checkout window type
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: () => void) => void;
    };
  }
}

type CheckoutState =
  | { step: "idle" }
  | { step: "creating_order" }
  | { step: "creating_payment" }
  | { step: "awaiting_payment" }
  | { step: "verifying" }
  | { step: "success"; order: Order }
  | { step: "failed"; message: string };

type ActiveTab = "products" | "buyers" | "simulation" | "analytics" | "sim_analytics";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cart state: Map of productId -> CartItem
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [showCart, setShowCart] = useState(false);
  const [isCartHydrated, setIsCartHydrated] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);

  // Checkout state
  const [checkout, setCheckout] = useState<CheckoutState>({ step: "idle" });
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");

  // Hydrate cart from localStorage on client mount (prevents SSR hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("agentstorm_cart");
      if (stored) {
        const parsed: CartItem[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const loadedMap = new Map<string, CartItem>();
          for (const item of parsed) {
            if (
              item &&
              item.product &&
              typeof item.product.id === "string" &&
              typeof item.quantity === "number" &&
              item.quantity > 0
            ) {
              loadedMap.set(item.product.id, {
                product: item.product,
                quantity: Math.max(1, Math.floor(item.quantity)),
              });
            }
          }
          setCart(loadedMap);
        }
      }
    } catch (err) {
      console.error("Failed to load cart from localStorage:", err);
      // Safe fallback to empty cart
    } finally {
      setIsCartHydrated(true);
    }
  }, []);

  // Persist cart to localStorage whenever cart state changes (after initial hydration)
  useEffect(() => {
    if (!isCartHydrated) return;
    try {
      const itemsArray = Array.from(cart.values());
      if (itemsArray.length === 0) {
        localStorage.removeItem("agentstorm_cart");
      } else {
        localStorage.setItem("agentstorm_cart", JSON.stringify(itemsArray));
      }
    } catch (err) {
      console.error("Failed to save cart to localStorage:", err);
    }
  }, [cart, isCartHydrated]);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`${API_URL}/api/products`);
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const data: ProductsResponse = await res.json();
        setProducts(data.products);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch products";
        setError(message);
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  // Sync fresh product metadata & stock caps to hydrated cart items
  useEffect(() => {
    if (products.length === 0 || cart.size === 0) return;
    setCart((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, item] of prev.entries()) {
        const fresh = products.find((p) => p.id === id);
        if (fresh) {
          const cappedQty = Math.min(item.quantity, fresh.stock);
          if (cappedQty <= 0) {
            next.delete(id);
            changed = true;
          } else if (item.product.stock !== fresh.stock || item.product.price !== fresh.price || item.quantity !== cappedQty) {
            next.set(id, { product: fresh, quantity: cappedQty });
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [products]);

  // Cart operations
  const addToCart = useCallback(
    (product: Product) => {
      setCart((prev) => {
        const next = new Map(prev);
        const existing = next.get(product.id);
        const currentQty = existing ? existing.quantity : 0;

        // Cap at available stock
        if (currentQty >= product.stock) return prev;

        next.set(product.id, {
          product,
          quantity: currentQty + 1,
        });
        return next;
      });
      setShowCart(true);
    },
    []
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      setCart((prev) => {
        const next = new Map(prev);
        const item = next.get(productId);
        if (!item) return prev;

        // Cap at available stock, minimum 1
        const capped = Math.min(Math.max(1, quantity), item.product.stock);
        next.set(productId, { ...item, quantity: capped });
        return next;
      });
    },
    []
  );

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  }, []);

  const cartItems = Array.from(cart.values());
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Full checkout flow
  const handleCheckout = useCallback(
    async (email: string) => {
      if (cartItems.length === 0) return;

      try {
        // Step 1: Create order
        setCheckout({ step: "creating_order" });

        const orderItems = cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        }));

        const orderRes = await fetch(`${API_URL}/api/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, items: orderItems }),
        });

        if (!orderRes.ok) {
          const err = await orderRes.json();
          throw new Error(err.error || "Failed to create order");
        }

        const { order }: CreateOrderResponse = await orderRes.json();

        // Step 2: Create Razorpay payment
        setCheckout({ step: "creating_payment" });

        const paymentRes = await fetch(`${API_URL}/api/payments/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id }),
        });

        if (!paymentRes.ok) {
          const err = await paymentRes.json();
          throw new Error(err.error || "Failed to create payment");
        }

        const paymentData: CreatePaymentResponse = await paymentRes.json();

        // Step 3: Open Razorpay checkout
        setCheckout({ step: "awaiting_payment" });

        if (!window.Razorpay) {
          throw new Error(
            "Razorpay SDK not loaded. Please refresh and try again."
          );
        }

        const rzp = new window.Razorpay({
          key: paymentData.keyId,
          amount: paymentData.amount,
          currency: paymentData.currency,
          name: "AgentStorm",
          description: `Order ${order.id.slice(-8)}`,
          order_id: paymentData.razorpayOrderId,
          prefill: {
            email: email,
          },
          theme: {
            color: "#7c3aed",
          },
          handler: async (response: RazorpaySuccessResponse) => {
            // Step 4: Verify payment server-side
            try {
              setCheckout({ step: "verifying" });

              const verifyRes = await fetch(`${API_URL}/api/payments/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              });

              if (!verifyRes.ok) {
                const err = await verifyRes.json();
                throw new Error(err.error || "Payment verification failed");
              }

              const verifyData: VerifyPaymentResponse =
                await verifyRes.json();

              if (verifyData.verified) {
                // Fetch updated order
                const updatedOrderRes = await fetch(
                  `${API_URL}/api/orders/${order.id}`
                );
                const updatedData = await updatedOrderRes.json();

                setCheckout({ step: "success", order: updatedData.order });
                setCart(new Map()); // Clear cart

                // Refresh products to reflect updated stock
                const productsRes = await fetch(`${API_URL}/api/products`);
                if (productsRes.ok) {
                  const prodData: ProductsResponse =
                    await productsRes.json();
                  setProducts(prodData.products);
                }
              } else {
                setCheckout({
                  step: "failed",
                  message: "Payment verification failed",
                });
              }
            } catch (verifyErr) {
              const msg =
                verifyErr instanceof Error
                  ? verifyErr.message
                  : "Verification failed";
              setCheckout({ step: "failed", message: msg });
            }
          },
          modal: {
            ondismiss: () => {
              setCheckout({
                step: "failed",
                message: "Payment was cancelled",
              });
            },
          },
        });

        rzp.open();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Checkout failed";
        setCheckout({ step: "failed", message });
      }
    },
    [cartItems]
  );

  const isCheckingOut =
    checkout.step === "creating_order" ||
    checkout.step === "creating_payment" ||
    checkout.step === "awaiting_payment" ||
    checkout.step === "verifying";

  return (
    <main className="min-h-screen bg-[#09090b]">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                  <span className="text-sm font-bold text-white">⚡</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  AgentStorm
                </h1>
              </div>
              <p className="text-sm text-white/40">
                Chaos testing for the agentic commerce economy.
              </p>
              <div className="flex gap-1 mt-3">
                <button
                  onClick={() => setActiveTab("products")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "products"
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "text-white/40 hover:text-white/60 border border-transparent"
                  }`}
                >
                  Products
                </button>
                <button
                  onClick={() => setActiveTab("buyers")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "buyers"
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "text-white/40 hover:text-white/60 border border-transparent"
                  }`}
                >
                  ⚡ AI Buyers
                </button>
                <button
                  onClick={() => setActiveTab("simulation")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "simulation"
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "text-white/40 hover:text-white/60 border border-transparent"
                  }`}
                >
                  🌪️ Simulation Storm
                </button>
                <button
                  onClick={() => setActiveTab("analytics")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "analytics"
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "text-white/40 hover:text-white/60 border border-transparent"
                  }`}
                >
                  🧠 Buyer Intelligence
                </button>
                <button
                  onClick={() => setActiveTab("sim_analytics")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "sim_analytics"
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "text-white/40 hover:text-white/60 border border-transparent"
                  }`}
                >
                  📊 Simulation Intelligence
                </button>
              </div>
            </div>

            {/* Cart button */}
            <button
              id="cart-toggle"
              onClick={() => setShowCart(!showCart)}
              className="relative flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white/90 transition-colors"
            >
              🛒 Cart
              {cartCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1.5 text-xs font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {activeTab === "sim_analytics" ? (
          <SimulationIntelligence />
        ) : activeTab === "analytics" ? (
          <BuyerIntelligence />
        ) : activeTab === "simulation" ? (
          <SimulationPanel />
        ) : activeTab === "buyers" ? (
          <BuyerPanel />
        ) : (
        <div className={`flex gap-6 ${showCart ? "" : ""}`}>
          {/* Main content */}
          <div className={`${showCart ? "flex-1 min-w-0" : "w-full"}`}>
            {/* Checkout result banners */}
            {checkout.step === "success" && checkout.order && (
              <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400">
                      Payment Successful
                    </h3>
                    <p className="mt-1 text-xs text-emerald-400/70">
                      Order{" "}
                      <span className="font-mono">
                        {checkout.order.id.slice(-8)}
                      </span>{" "}
                      is now{" "}
                      <span className="font-semibold">
                        {checkout.order.status}
                      </span>
                    </p>
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-white/50">
                        <span className="text-white/30">Email:</span>{" "}
                        {checkout.order.email}
                      </p>
                      <p className="text-xs text-white/50">
                        <span className="text-white/30">Total:</span>{" "}
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          maximumFractionDigits: 0,
                        }).format(Number(checkout.order.totalAmount))}
                      </p>
                      <p className="text-xs text-white/50">
                        <span className="text-white/30">Items:</span>{" "}
                        {checkout.order.items.length}
                      </p>
                      {checkout.order.payment && (
                        <p className="text-xs text-white/50">
                          <span className="text-white/30">Payment:</span>{" "}
                          <span className="font-mono text-emerald-400/70">
                            {checkout.order.payment.status}
                          </span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setCheckout({ step: "idle" })}
                      className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {checkout.step === "failed" && (
              <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">❌</span>
                  <div>
                    <h3 className="text-sm font-semibold text-red-400">
                      Checkout Failed
                    </h3>
                    <p className="mt-1 text-xs text-red-400/70">
                      {checkout.message}
                    </p>
                    <button
                      onClick={() => setCheckout({ step: "idle" })}
                      className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Processing banner */}
            {isCheckingOut && (
              <div className="mb-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                  <p className="text-sm text-violet-300">
                    {checkout.step === "creating_order" &&
                      "Creating order..."}
                    {checkout.step === "creating_payment" &&
                      "Initializing payment..."}
                    {checkout.step === "awaiting_payment" &&
                      "Waiting for payment..."}
                    {checkout.step === "verifying" &&
                      "Verifying payment..."}
                  </p>
                </div>
              </div>
            )}

            {/* Products Section */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white/90">
                  Product Catalog
                </h2>
                <p className="text-xs text-white/40 mt-0.5">
                  {loading
                    ? "Loading..."
                    : `${products.length} products from database`}
                </p>
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-40 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]"
                  />
                ))}
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                <p className="text-sm font-medium text-red-400">
                  Failed to load products
                </p>
                <p className="mt-1 text-xs text-red-400/60">{error}</p>
                <p className="mt-3 text-xs text-white/30">
                  Make sure the backend is running on {API_URL}
                </p>
              </div>
            )}

            {/* Products grid */}
            {!loading && !error && products.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    onViewDetails={(p) => setSelectedProductForDetails(p)}
                    cartQuantity={cart.get(product.id)?.quantity || 0}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && products.length === 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
                <p className="text-sm text-white/40">No products found.</p>
                <p className="mt-1 text-xs text-white/20">
                  Run the seed script to populate the database.
                </p>
              </div>
            )}
          </div>

          {/* Cart sidebar */}
          {showCart && (
            <div className="w-80 flex-shrink-0">
              <div className="sticky top-24">
                <Cart
                  items={cartItems}
                  onUpdateQuantity={updateQuantity}
                  onRemoveItem={removeItem}
                  onClose={() => setShowCart(false)}
                  onCheckout={handleCheckout}
                  isCheckingOut={checkout.step !== "idle" && checkout.step !== "success" && checkout.step !== "failed"}
                />
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Product Details Modal */}
      <ProductDetailsModal
        product={selectedProductForDetails}
        onClose={() => setSelectedProductForDetails(null)}
        onAddToCart={addToCart}
        cartQuantity={
          selectedProductForDetails
            ? cart.get(selectedProductForDetails.id)?.quantity || 0
            : 0
        }
      />
    </main>
  );
}
