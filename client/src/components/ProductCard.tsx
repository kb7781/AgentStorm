"use client";

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

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
  cartQuantity?: number;
}

export default function ProductCard({
  product,
  onAddToCart,
  onViewDetails,
  cartQuantity = 0,
}: ProductCardProps) {
  const colorClass =
    categoryColors[product.category] ||
    "bg-gray-500/10 text-gray-400 border-gray-500/20";

  const stockColor =
    product.stock > 20
      ? "text-emerald-400"
      : product.stock > 5
        ? "text-amber-400"
        : "text-red-400";

  const isOutOfStock = product.stock === 0;
  const isMaxedInCart = cartQuantity >= product.stock;

  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]">
      {/* Category badge & Stock */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${colorClass}`}
        >
          {product.category}
        </span>
        <span className={`text-xs font-medium ${stockColor}`}>
          {product.stock} in stock
        </span>
      </div>

      {/* Product info (Clickable to view details) */}
      <div
        className="cursor-pointer"
        onClick={() => onViewDetails && onViewDetails(product)}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">
            {product.name}
          </h3>
          <span className="text-[11px] font-medium text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
            Details &rarr;
          </span>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-white/40 line-clamp-2">
          {product.description}
        </p>
      </div>

      {/* Price + Add to Cart */}
      <div className="flex items-end justify-between">
        <span
          className="text-lg font-bold text-white/90 cursor-pointer"
          onClick={() => onViewDetails && onViewDetails(product)}
        >
          {formatPrice(product.price)}
        </span>
        {onAddToCart && (
          <button
            id={`add-to-cart-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            disabled={isOutOfStock || isMaxedInCart}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              isOutOfStock
                ? "bg-white/[0.03] text-white/20 cursor-not-allowed"
                : isMaxedInCart
                  ? "bg-violet-500/10 text-violet-400/60 border border-violet-500/20 cursor-not-allowed"
                  : "bg-violet-500/15 text-violet-400 border border-violet-500/20 hover:bg-violet-500/25 hover:text-violet-300 active:scale-95"
            }`}
          >
            {isOutOfStock
              ? "Out of Stock"
              : isMaxedInCart
                ? `${cartQuantity} in cart`
                : cartQuantity > 0
                  ? `In cart (${cartQuantity})`
                  : "Add to Cart"}
          </button>
        )}
      </div>
    </div>
  );
}
