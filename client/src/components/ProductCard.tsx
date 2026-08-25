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

export default function ProductCard({ product }: { product: Product }) {
  const colorClass =
    categoryColors[product.category] ||
    "bg-gray-500/10 text-gray-400 border-gray-500/20";

  const stockColor =
    product.stock > 20
      ? "text-emerald-400"
      : product.stock > 5
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]">
      {/* Category badge */}
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

      {/* Product info */}
      <h3 className="mb-1.5 text-sm font-semibold text-white/90 group-hover:text-white transition-colors">
        {product.name}
      </h3>
      <p className="mb-4 text-xs leading-relaxed text-white/40 line-clamp-2">
        {product.description}
      </p>

      {/* Price */}
      <div className="flex items-end justify-between">
        <span className="text-lg font-bold text-white/90">
          {formatPrice(product.price)}
        </span>
      </div>
    </div>
  );
}
