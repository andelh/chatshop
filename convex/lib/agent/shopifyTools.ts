import { tool } from "ai";
import { z } from "zod";

export interface StorefrontConfig {
  endpoint: string;
  accessToken: string;
}

// Shopify fetch helper
async function shopifyFetch({
  query,
  variables,
  storefront,
}: {
  query: string;
  variables?: Record<string, any>;
  storefront?: {
    endpoint: string;
    accessToken: string;
  };
}) {
  const endpoint = storefront?.endpoint;
  const key = storefront?.accessToken;

  if (!endpoint || !key) {
    return {
      status: 500,
      error: "Missing Shopify storefront credentials",
    };
  }

  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": key,
      },
      body: JSON.stringify({ query, variables }),
    });

    const text = await result.text();
    let body: any = null;

    try {
      body = text ? JSON.parse(text) : null;
    } catch (parseError) {
      return {
        status: result.status,
        error: "Non-JSON response from Shopify",
        body: text,
      };
    }

    return {
      status: result.status,
      body,
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      status: 500,
      error: "Error receiving data",
    };
  }
}

// Create Shopify tools for AI
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
    checkVariantAvailability: tool({
      description:
        "Check if a specific product variant combination is available. Use this when the customer asks about a specific model, color, style, or size.",
      inputSchema: z.object({
        productSearch: z
          .string()
          .describe(
            "Product name to search for (e.g., 'screen protector', 'otterbox case')",
          ),
        variantFilters: z
          .object({
            style: z
              .string()
              .optional()
              .describe(
                "Style/Type variant (e.g., 'Clear', 'Privacy', 'Defender')",
              ),
            model: z
              .string()
              .optional()
              .describe(
                "iPhone/Device model (e.g., 'iPhone 15 Plus', 'iPhone 16 Pro')",
              ),
            color: z
              .string()
              .optional()
              .describe("Color variant (e.g., 'Black', 'Blue')"),
            size: z
              .string()
              .optional()
              .describe("Size/Storage variant (e.g., '128GB', '256GB')"),
          })
          .describe(
            "Filter criteria - only variants matching ALL specified filters will be returned",
          ),
      }),
      execute: async ({ productSearch, variantFilters }) => {
        // First search for the product
        const searchQuery = productSearch;
        const response = await shopifyFetch({
          query: `query ProductAvailability($query: String!) {
            products(first: 10, query: $query) {
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
                  variants(first: 50) {
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

        // Filter variants by the specified criteria
        const matchingResults = products
          .map((product: any) => {
            const matchingVariants = product.variants.filter((variant: any) => {
              // Check if variant matches ALL specified filters
              const matchesStyle =
                !variantFilters.style ||
                variant.selectedOptions.some(
                  (opt: any) =>
                    opt.name.toLowerCase().includes("style") &&
                    opt.value
                      .toLowerCase()
                      .includes(variantFilters.style!.toLowerCase()),
                ) ||
                variant.title
                  .toLowerCase()
                  .includes(variantFilters.style!.toLowerCase());

              const matchesModel =
                !variantFilters.model ||
                variant.selectedOptions.some(
                  (opt: any) =>
                    opt.name.toLowerCase().includes("model") &&
                    opt.value
                      .toLowerCase()
                      .includes(variantFilters.model!.toLowerCase()),
                ) ||
                variant.title
                  .toLowerCase()
                  .includes(variantFilters.model!.toLowerCase());

              const matchesColor =
                !variantFilters.color ||
                variant.selectedOptions.some(
                  (opt: any) =>
                    opt.name.toLowerCase().includes("color") &&
                    opt.value
                      .toLowerCase()
                      .includes(variantFilters.color!.toLowerCase()),
                ) ||
                variant.title
                  .toLowerCase()
                  .includes(variantFilters.color!.toLowerCase());

              const matchesSize =
                !variantFilters.size ||
                variant.selectedOptions.some(
                  (opt: any) =>
                    opt.name.toLowerCase().includes("size") &&
                    opt.value
                      .toLowerCase()
                      .includes(variantFilters.size!.toLowerCase()),
                ) ||
                variant.title
                  .toLowerCase()
                  .includes(variantFilters.size!.toLowerCase());

              return (
                matchesStyle && matchesModel && matchesColor && matchesSize
              );
            });

            if (matchingVariants.length === 0) return null;

            return {
              product: {
                id: product.id,
                title: product.title,
                handle: product.handle,
              },
              matchingVariants,
              totalVariants: product.variants.length,
            };
          })
          .filter(Boolean);

        return {
          searchQuery,
          variantFilters,
          found: matchingResults.length > 0,
          matches: matchingResults,
          errors: response.body?.errors ?? null,
        };
      },
    }),
  };
}
