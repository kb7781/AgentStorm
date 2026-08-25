"use client";

import { useEffect, useState } from "react";
import { Product, ProductsResponse } from "@/types/product";
import ProductCard from "@/components/ProductCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="min-h-screen bg-[#09090b]">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-8">
        <div className="mx-auto max-w-6xl">
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
        </div>
      </header>

      {/* Products Section */}
      <section className="px-6 py-8">
        <div className="mx-auto max-w-6xl">
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
                <ProductCard key={product.id} product={product} />
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
      </section>
    </main>
  );
}
