"use client";

import { CartItem } from "@/types/product";

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price));
}

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: (email: string) => void;
  isCheckingOut: boolean;
  onClose: () => void;
}

export default function Cart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  isCheckingOut,
  onClose,
}: CartProps) {
  const total = items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  const handleCheckout = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    if (email && email.includes("@")) {
      onCheckout(email);
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white/90">Cart</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 text-sm"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-white/40 text-center py-6">
          Your cart is empty.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white/90">
          Cart ({items.length} {items.length === 1 ? "item" : "items"})
        </h2>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/70 text-sm"
        >
          ✕
        </button>
      </div>

      {/* Cart Items */}
      <div className="space-y-3 mb-4">
        {items.map((item) => {
          const lineTotal = Number(item.product.price) * item.quantity;
          return (
            <div
              key={item.product.id}
              className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-3"
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-sm font-medium text-white/90 truncate">
                  {item.product.name}
                </p>
                <p className="text-xs text-white/40">
                  {formatPrice(item.product.price)} each
                </p>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-2">
                <button
                  id={`qty-dec-${item.product.id}`}
                  onClick={() =>
                    item.quantity === 1
                      ? onRemoveItem(item.product.id)
                      : onUpdateQuantity(item.product.id, item.quantity - 1)
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white/90 text-sm"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-medium text-white/80">
                  {item.quantity}
                </span>
                <button
                  id={`qty-inc-${item.product.id}`}
                  onClick={() =>
                    onUpdateQuantity(item.product.id, item.quantity + 1)
                  }
                  disabled={item.quantity >= item.product.stock}
                  className={`flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] text-sm ${
                    item.quantity >= item.product.stock
                      ? "bg-white/[0.02] text-white/20 cursor-not-allowed"
                      : "bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white/90"
                  }`}
                >
                  +
                </button>
                <button
                  id={`remove-${item.product.id}`}
                  onClick={() => onRemoveItem(item.product.id)}
                  className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-red-400/60 hover:bg-red-500/10 hover:text-red-400 text-xs"
                  title="Remove"
                >
                  ✕
                </button>
              </div>

              <div className="ml-3 text-right min-w-[80px]">
                <p className="text-sm font-semibold text-white/90">
                  {formatPrice(lineTotal)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="border-t border-white/[0.06] pt-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/60">Total</span>
          <span className="text-lg font-bold text-white/90">
            {formatPrice(total)}
          </span>
        </div>
      </div>

      {/* Checkout form */}
      <form onSubmit={handleCheckout}>
        <input
          type="email"
          name="email"
          id="checkout-email"
          placeholder="Email for order"
          required
          className="mb-3 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
        />
        <button
          id="checkout-btn"
          type="submit"
          disabled={isCheckingOut}
          className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
            isCheckingOut
              ? "bg-violet-500/20 text-violet-300/60 cursor-not-allowed"
              : "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500 active:scale-[0.98]"
          }`}
        >
          {isCheckingOut ? "Processing..." : `Pay ${formatPrice(total)}`}
        </button>
      </form>
    </div>
  );
}
