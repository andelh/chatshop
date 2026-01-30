import { tool } from "ai";
import { z } from "zod";
import { shopifyFetch } from "@/lib/shopify";

interface StorefrontConfig {
  endpoint: string;
  accessToken: string;
}

export function createShopifyTools(storefront: StorefrontConfig) {
  return {
    getProductAvailability: tool({
      description: "Check Shopify product availability by name or query string",
      inputSchema: z.object({
        search: z
          .string()
          .describe(
            'Product name or Shopify search query (e.g. iPhone 16 or title:"iPhone 16")',
          ),
      }),
      execute: async ({ search }) => {
        const searchQuery = search;

        const response = await shopifyFetch({
          query: `query ProductAvailability($query: String!) {
            products(first: 15, query: $query) {
              edges {
                node {
                  id
                  title
                  handle
                  description
                  productType
                  tags
                  availableForSale
                  priceRange {
                    minVariantPrice {
                      amount
                      currencyCode
                    }
                    maxVariantPrice {
                      amount
                      currencyCode
                    }
                  }
                  options {
                    id
                    name
                    values
                  }
                  variants(first: 10) {
                    edges {
                      node {
                        id
                        title
                        availableForSale
                        quantityAvailable
                        price {
                          amount
                          currencyCode
                        }
                        compareAtPrice {
                          amount
                          currencyCode
                        }
                        selectedOptions {
                          name
                          value
                        }
                      }
                    }
                  }
                }
              }
            }
          }`,
          variables: { query: searchQuery },
          storefront,
        });

        const products =
          response.body?.data?.products?.edges?.map((edge: { node: any }) => {
            const product = edge.node;
            return {
              id: product.id,
              title: product.title,
              handle: product.handle,
              description: product.description,
              productType: product.productType,
              tags: product.tags,
              availableForSale: product.availableForSale,
              priceRange: product.priceRange,
              options: product.options,
              variants: product.variants.edges.map(
                (variantEdge: { node: any }) => ({
                  id: variantEdge.node.id,
                  title: variantEdge.node.title,
                  availableForSale: variantEdge.node.availableForSale,
                  quantityAvailable: variantEdge.node.quantityAvailable,
                  price: variantEdge.node.price,
                  compareAtPrice: variantEdge.node.compareAtPrice,
                  selectedOptions: variantEdge.node.selectedOptions,
                }),
              ),
            };
          }) ?? [];

        return {
          query: searchQuery,
          products,
          errors: response.body?.errors ?? null,
        };
      },
    }),
    getProductCategories: tool({
      description: "List available Shopify product categories (collections)",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe(
            "Optional search query for collections (e.g. title:'Phones')",
          ),
      }),
      execute: async ({ query }) => {
        const response = await shopifyFetch({
          query: `query ProductCategories($query: String) {
            collections(first: 50, query: $query) {
              edges {
                node {
                  id
                  title
                  handle
                  description
                  updatedAt
                }
              }
            }
          }`,
          variables: { query: query ?? null },
          storefront,
        });

        const categories =
          response.body?.data?.collections?.edges?.map(
            (edge: { node: any }) => ({
              id: edge.node.id,
              title: edge.node.title,
              handle: edge.node.handle,
              description: edge.node.description,
              updatedAt: edge.node.updatedAt,
            }),
          ) ?? [];

        return {
          query: query ?? null,
          categories,
          errors: response.body?.errors ?? null,
        };
      },
    }),
    getCategoryProductsByPrice: tool({
      description:
        "Search product categories and return products sorted by price",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe(
            "Optional search query for collections (e.g. title:'Phones')",
          ),
        sort: z
          .enum(["asc", "desc"])
          .optional()
          .describe("Sort direction for price (asc or desc)"),
      }),
      execute: async ({ query, sort }) => {
        const reverse = sort === "desc";
        const response = await shopifyFetch({
          query: `query CategoryProductsByPrice($query: String, $reverse: Boolean!) {
            collections(first: 5, query: $query) {
              edges {
                node {
                  id
                  title
                  handle
                  products(first: 10, sortKey: PRICE, reverse: $reverse) {
                    edges {
                      node {
                        id
                        title
                        handle
                        availableForSale
                        priceRange {
                          minVariantPrice {
                            amount
                            currencyCode
                          }
                          maxVariantPrice {
                            amount
                            currencyCode
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }`,
          variables: { query: query ?? null, reverse },
          storefront,
        });

        const categories =
          response.body?.data?.collections?.edges?.map(
            (edge: { node: any }) => {
              const collection = edge.node;
              return {
                id: collection.id,
                title: collection.title,
                handle: collection.handle,
                products:
                  collection.products?.edges?.map(
                    (productEdge: { node: any }) => ({
                      id: productEdge.node.id,
                      title: productEdge.node.title,
                      handle: productEdge.node.handle,
                      availableForSale: productEdge.node.availableForSale,
                      priceRange: productEdge.node.priceRange,
                    }),
                  ) ?? [],
              };
            },
          ) ?? [];

        return {
          query: query ?? null,
          sort: sort ?? "asc",
          categories,
          errors: response.body?.errors ?? null,
        };
      },
    }),
  };
}
