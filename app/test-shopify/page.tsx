"use client";
import { useState } from "react";

export default function Home() {
  const [products, setProducts] = useState<any>(null);
  const [collections, setCollections] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function getAllProducts() {
    setLoading("products");
    setError(null);
    try {
      const response = await fetch("/api/shopify/products");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to fetch products");
      }
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }

  async function getAllCollections() {
    setLoading("collections");
    setError(null);
    try {
      const response = await fetch("/api/shopify/collections");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to fetch collections");
      }
      setCollections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col gap-6 py-24 px-6 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={getAllProducts}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            disabled={loading === "products"}
          >
            {loading === "products" ? "Loading products..." : "Fetch Products"}
          </button>
          <button
            type="button"
            onClick={getAllCollections}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
            disabled={loading === "collections"}
          >
            {loading === "collections"
              ? "Loading collections..."
              : "Fetch Collections"}
          </button>
        </div>

        {error ? (
          <div className="w-full rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="w-full">
          <h2 className="text-sm font-semibold">Products</h2>
          <pre className="mt-2 max-h-80 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-xs">
            {products ? JSON.stringify(products, null, 2) : "No data yet"}
          </pre>
        </section>

        <section className="w-full">
          <h2 className="text-sm font-semibold">Collections</h2>
          <pre className="mt-2 max-h-80 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-xs">
            {collections ? JSON.stringify(collections, null, 2) : "No data yet"}
          </pre>
        </section>
      </main>
    </div>
  );
}
