"use client";

import { useEffect } from "react";
import { Product } from "@/types/product";

const categoryColors: Record<string, string> = {
  laptops: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  headphones: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  keyboards: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  mice: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  monitors: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price));
}

function formatAttributeKey(key: string): string {
  // Convert camelCase or kebab-case to Title Case (e.g. waterResistance -> Water Resistance)
  const result = key.replace(/([A-Z])/g, " $1");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function formatAttributeValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (value === null || value === undefined) {
    return "N/A";
  }
  return String(value);
}

interface ProductDetailsModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart?: (product: Product) => void;
  cartQuantity?: number;
}

export default function ProductDetailsModal({
  product,
  onClose,
  onAddToCart,
  cartQuantity = 0,
}: ProductDetailsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!product) return null;

  const colorClass =
    categoryColors[product.category] ||
    "bg-gray-500/10 text-gray-400 border-gray-500/20";

  const stockColor =
    product.stock > 20
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      : product.stock > 5
        ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
        : product.stock > 0
          ? "text-red-400 bg-red-500/10 border-red-500/20"
          : "text-red-400/60 bg-red-500/5 border-red-500/10";

  const isOutOfStock = product.stock === 0;
  const isMaxedInCart = cartQuantity >= product.stock;

  const attributesList = product.attributes ? Object.entries(product.attributes) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-purple-950/40 z-10 custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Close product details"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Category & Stock Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3 pr-8">
          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold capitalize ${colorClass}`}>
            {product.category}
          </span>
          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${stockColor}`}>
            {isOutOfStock ? "Out of Stock" : `${product.stock} Units Available`}
          </span>
        </div>

        {/* Product Title */}
        <h2 className="text-xl font-bold text-white mb-2">{product.name}</h2>

        {/* Price */}
        <div className="text-2xl font-extrabold text-white mb-4">
          {formatPrice(product.price)}
        </div>

        {/* Description */}
        <div className="mb-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">
            Description
          </h3>
          <p className="text-sm leading-relaxed text-white/80">
            {product.description}
          </p>
        </div>

        {/* Product Specifications / Attributes Grid */}
        {attributesList.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
              Technical Specifications & Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {attributesList.map(([key, val]) => (
                <div
                  key={key}
                  className="flex flex-col rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <span className="text-[11px] font-medium text-white/40">
                    {formatAttributeKey(key)}
                  </span>
                  <span className="text-xs font-semibold text-white/90 mt-0.5">
                    {formatAttributeValue(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-6">
          <div>
            <span className="text-xs text-white/40 block">Total Price</span>
            <span className="text-lg font-bold text-white">
              {formatPrice(product.price)}
            </span>
          </div>

          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              disabled={isOutOfStock || isMaxedInCart}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                isOutOfStock
                  ? "bg-white/5 text-white/30 cursor-not-allowed border border-white/5"
                  : isMaxedInCart
                    ? "bg-violet-500/10 text-violet-400/60 border border-violet-500/20 cursor-not-allowed"
                    : "bg-violet-600 text-white hover:bg-violet-500 active:scale-95 shadow-lg shadow-violet-600/30"
              }`}
            >
              {isOutOfStock
                ? "Out of Stock"
                : isMaxedInCart
                  ? `Max in cart (${cartQuantity})`
                  : cartQuantity > 0
                    ? `Add Another (In Cart: ${cartQuantity})`
                    : "Add to Cart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
