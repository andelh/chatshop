import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { shopifyFetch } from "@/lib/shopify";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.2-codex"),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
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
                    availableForSale
                    variants(first: 10) {
                      edges {
                        node {
                          id
                          title
                          availableForSale
                          quantityAvailable
                        }
                      }
                    }
                  }
                }
              }
            }`,
            variables: { query: searchQuery },
          });

          const products =
            response.body?.data?.products?.edges?.map((edge: { node: any }) => {
              const product = edge.node;
              return {
                id: product.id,
                title: product.title,
                handle: product.handle,
                availableForSale: product.availableForSale,
                variants: product.variants.edges.map(
                  (variantEdge: { node: any }) => ({
                    id: variantEdge.node.id,
                    title: variantEdge.node.title,
                    availableForSale: variantEdge.node.availableForSale,
                    quantityAvailable: variantEdge.node.quantityAvailable,
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
