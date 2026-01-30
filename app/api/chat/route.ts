import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { ISUPPLY_SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";
import { shopifyFetch } from "@/lib/shopify";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.2-codex"),
    system: ISUPPLY_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      weather: tool({
        description: "Get the weather in a location (fahrenheit)",
        inputSchema: z.object({
          location: z.string().describe("The location to get the weather for"),
        }),
        execute: async ({ location }) => {
          const temperature = Math.round(Math.random() * (90 - 32) + 32);
          return {
            location,
            temperature,
          };
        },
      }),
      getProductAvailability: tool({
        description:
          "Check Shopify product availability by name or query string",
        inputSchema: z.object({
          search: z
            .string()
            .describe(
              'Product name or Shopify search query (e.g. iPhone 16 or title:"iPhone 16")',
            ),
        }),
        execute: async ({ search }) => {
          const searchQuery = /\w+:/.test(search)
            ? search
            : `title:${JSON.stringify(search)}`;

          const response = await shopifyFetch({
            query: `query ProductAvailability($query: String!) {
              products(first: 5, query: $query) {
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
            `,
            variables: { query: searchQuery },
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
    },
    onStepFinish: ({ toolResults }) => {
      console.log(toolResults);
    },
  });

  return result.toUIMessageStreamResponse();
}
