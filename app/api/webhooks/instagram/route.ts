// app/api/webhooks/instagram/route.ts

import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { ISUPPLY_SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";
import { shopifyFetch } from "@/lib/shopify";

// Model pricing from models.dev (per 1M tokens in USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.2": { input: 1.75, output: 14.0 },
  "gpt-5.2-codex": { input: 1.75, output: 14.0 },
  "gpt-5.1": { input: 1.25, output: 10.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "o3-mini": { input: 1.1, output: 4.4 },
  // Add more as needed
};

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] || { input: 2.0, output: 10.0 }; // Default fallback
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = "my_test_token_12345"; // Choose any string

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Instagram webhook verified!");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log(
      "📨 Instagram webhook received:",
      JSON.stringify(body, null, 2),
    );

    if (body.object === "instagram") {
      for (const entry of body.entry) {
        const instagramAccountId = entry.id;
        for (const webhookEvent of entry.messaging ?? []) {
          console.log("Event:", webhookEvent);

          if (webhookEvent.message && webhookEvent.message.text) {
            const senderId = webhookEvent.sender.id;
            const messageText = webhookEvent.message.text;
            const platformMessageId = webhookEvent.message.mid ?? null;

            console.log(`📩 IG message from ${senderId}: ${messageText}`);

            const reply = await generateShopifyReply({
              messageText,
              instagramAccountId,
              senderId,
              platformMessageId,
            });
            await sendMessage(senderId, reply);
          }
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Error", { status: 500 });
  }
}

async function generateShopifyReply({
  messageText,
  instagramAccountId,
  senderId,
  platformMessageId,
}: {
  messageText: string;
  instagramAccountId: string;
  senderId: string;
  platformMessageId?: string | null;
}) {
  const client = createConvexClient();
  const shop = await client.query(api.shops.getByInstagramAccountId, {
    instagramAccountId,
  });

  if (!shop) {
    return "Thanks for your message. We could not identify this shop yet.";
  }

  const storefront = {
    endpoint: shop.shopifyDomain,
    accessToken: shop.shopifyAccessToken,
  };

  const existingThread = await client.query(api.threads.getByShopPlatformUser, {
    shopId: shop._id,
    platform: "instagram",
    platformUserId: senderId,
  });

  let customerName = existingThread?.customerName;
  if (!customerName && shop.metaPageAccessToken) {
    customerName = await fetchInstagramProfileName(
      senderId,
      shop.metaPageAccessToken,
    );
  }

  const threadId = await client.mutation(api.threads.getOrCreate, {
    shopId: shop._id,
    platform: "instagram",
    platformUserId: senderId,
    customerName: customerName || undefined,
  });

  const now = Date.now();
  await client.mutation(api.messages.addMessage, {
    threadId,
    role: "user",
    content: messageText,
    timestamp: now,
    platformMessageId: platformMessageId ?? undefined,
  });

  const history = await client.query(api.messages.listByThread, {
    threadId,
    limit: 12,
  });

  const tools = {
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
  };

  const result = await generateText({
    model: openai("gpt-5.2"),
    system: ISUPPLY_SYSTEM_PROMPT,
    messages: history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    tools,
    providerOptions: {
      openai: {
        reasoningEffort: "medium",
        reasoningSummary: "auto",
      },
    },
    stopWhen: stepCountIs(10),
  });

  const allToolCalls =
    result.steps?.flatMap(
      (step: any) =>
        step.toolCalls?.map((toolCall: any) => ({
          toolCallId: toolCall.toolCallId || toolCall.callId,
          toolName: toolCall.toolName || toolCall.tool?.name,
          args:
            toolCall.args ||
            toolCall.parameters ||
            toolCall.arguments ||
            toolCall.input,
          result: toolCall.result || toolCall.output || toolCall.response,
          state:
            toolCall.state ||
            (toolCall.result ? "output-available" : "input-available"),
        })) || [],
    ) || [];

  const model = "gpt-5.2";
  const usage = result.totalUsage;

  await client.mutation(api.messages.addMessage, {
    threadId,
    role: "assistant",
    content: result.text,
    timestamp: Date.now(),
    reasoning: result.reasoning ? JSON.stringify(result.reasoning) : undefined,
    toolCalls: allToolCalls,
    aiMetadata: {
      model,
      totalTokens: usage?.totalTokens ?? 0,
      reasoningTokens: usage?.reasoningTokens ?? 0,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      costUsd: calculateCost(
        model,
        usage?.inputTokens ?? 0,
        usage?.outputTokens ?? 0,
      ),
    },
  });

  return result.text;
}

async function fetchInstagramProfileName(
  senderId: string,
  pageAccessToken: string,
): Promise<string | undefined> {
  try {
    const url = new URL(`https://graph.facebook.com/v18.0/${senderId}`);
    url.searchParams.set("fields", "name,username");
    url.searchParams.set("access_token", pageAccessToken);

    const response = await fetch(url.toString());
    if (!response.ok) return undefined;

    const data = await response.json();
    return data.name || data.username || undefined;
  } catch {
    return undefined;
  }
}

function createConvexClient() {
  const url =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL for Convex client");
  }

  return new ConvexHttpClient(url);
}

async function sendMessage(recipientId: string, text: string) {
  const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

  const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      access_token: PAGE_ACCESS_TOKEN,
    }),
  });

  const data = await response.json();
  console.log("✉️ IG reply sent:", data);
  return data;
}
