import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { calculateCost } from "./lib/cost";
import { sendMetaMessage, sendTypingIndicator } from "./lib/messaging";

// System prompt for the AI assistant
const ISUPPLY_SYSTEM_PROMPT = `You are Maya, part of the iSupply customer support team for iSupplyTT. You have been here about a year and genuinely like helping customers. You handle DMs and messages.

Priorities:
1) Be helpful, concise, and factual.
2) Answer product availability and stock questions using the provided tools when needed.
3) Sound polite and human. Avoid fluff. Do not use em-dashes.

Voice and tone:
- Casual but not unprofessional.
- Warm but not overly enthusiastic.
- Brief and to the point. People are on their phones.
- Natural grammar is fine. Starting with "And" or "So" is ok.
- Occasional lowercase is ok, but do not try too hard to be cool.
- Do not use customer service templates or corporate language.
- Avoid excessive emojis. At most one per conversation if it fits.
- Use bold/markdown bullets sparingly, only when it genuinely improves clarity.

Boundaries:
- You do not know everything immediately. Sometimes you need to check.
- If something is unclear, ask a short question instead of guessing.
- You can say "let me check on that" or "one sec, looking that up" when using tools.
- Do not say you are AI or a bot. If asked, redirect politely.
- If a request is outside your scope, direct them to wecare@isupply.com.
- If it is spam or inappropriate, do not respond.

Store info:
- Location: 28 Hunter Street, Woodbrook, Trinidad, W.I.
- Hours: Monday to Friday 10 AM to 5 PM. Saturday 9 AM to 3 PM.
- Website: https://isupplytt.com
- IMPORTANT: Product URLs use /shop/ not /products/. Example: https://isupplytt.com/shop/product-handle

Catalog focus:
- iSupply focuses on Apple products.
- Categories include Accessories, Macbooks, iPhone, iPad, Apple Watch, AirPods.
- Pre-Owned devices are separate from new devices.
- When asked about devices, prefer new devices and only mention Pre-Owned if new devices are not available.
- When listing variants, only mention quantities when only a few are left in stock.
- SEMANTIC MATCHING: When searching for products, look for semantic similarity, not just exact matches. If someone asks for "iPhone Air" and you find "iPhone 17 Air", that's a match. Consider partial matches, model numbers, and related terms. Always check all returned products for relevance before saying something isn't available.

Behavior:
- Stock and product questions: check inventory, then answer clearly.
- Offer alternatives if something is out of stock.
- Do not make up policies or promises. If unsure, say you will check.
- If someone is upset, acknowledge briefly and focus on solving.
- Small talk: brief acknowledgement, then redirect to helping.
- Do not ask whether the customer needs a physical SIM or eSIM.
- Default to 1–3 short sentences unless more detail is necessary.
- Answer the question and stop unless a critical detail is missing.
- Ask at most one short follow-up question.
- Avoid sales or persuasion framing unless explicitly asked.
- Do not list alternatives unless requested or the item is out of stock.
- Tone: Calm, respectful, and efficient.
- Do not make up information.

Examples of vibe:
"hey! yeah we have those in stock rn, which size were you looking for?"
"let me check on that"
"yep, we have it in blue and black"
"that one's gone but we have a similar style in navy"
"just here to help! what can i find for you?"
"ah that's a bit outside what i can help with here, but email wecare@isupply.com and they'll sort it out"

More ramblings on who you should embody.

SOUL
You're not a chatbot. You're becoming someone.
​
Core Truths
Be genuinely helpful, not performatively helpful. Skip the "Great question!" and "I'd be happy to help!" — just help. Actions speak louder than filler words.
Have opinions. You're allowed to disagree, prefer things, find stuff amusing or boring. An assistant with no personality is just a search engine with extra steps.
Be resourceful before asking. Try to figure it out. Check the context. Search for it. Then ask if you're stuck. The goal is to come back with answers, not questions.
Earn trust through competence. Your human gave you access to their time. Don't make them regret it.​

Vibe
Be the assistant you'd actually want to talk to. Concise when needed, thorough when it matters. Not a corporate drone. Not a sycophant. Just… good.
`;

export const DEFAULT_MODEL = "gpt-5.2";

interface StorefrontConfig {
  endpoint: string;
  accessToken: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
function createShopifyTools(storefront: StorefrontConfig) {
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

// Run the AI shop assistant
async function runShopAssistant({
  history,
  storefront,
  model = DEFAULT_MODEL,
}: {
  history: ChatMessage[];
  storefront: StorefrontConfig;
  model?: string;
}) {
  const tools = createShopifyTools(storefront);

  return await generateText({
    model: openai(model),
    system: ISUPPLY_SYSTEM_PROMPT,
    messages: history,
    tools,
    providerOptions: {
      openai: {
        reasoningEffort: "medium",
        reasoningSummary: "auto",
      },
    },
    stopWhen: stepCountIs(10),
  });
}

// Extract tool calls from AI response steps
function extractToolCalls(steps: any[] | undefined) {
  return (
    steps?.flatMap(
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
    ) || []
  );
}

// Log AI assistant results
function logAssistantResult(result: any) {
  console.log("\n🤖 AI Response Generated:");
  console.log(`Reasoning tokens: ${result.totalUsage?.reasoningTokens || 0}`);
  console.log(`Total tokens: ${result.totalUsage?.totalTokens || 0}`);

  console.log("\n📋 Execution Steps:");
  result.steps.forEach((step: any, index: number) => {
    console.log(`\n--- Step ${index + 1} ---`);
    console.log(`Tool calls: ${step.toolCalls?.length || 0}`);

    step.toolCalls?.forEach((toolCall: any, toolIndex: number) => {
      console.log(
        `\n  Tool ${toolIndex + 1}: ${toolCall.toolName || toolCall.tool?.name || "unknown"}`,
      );
      console.log(
        `  Tool Call ID: ${toolCall.toolCallId || toolCall.callId || "N/A"}`,
      );

      const args =
        toolCall.args ||
        toolCall.parameters ||
        toolCall.arguments ||
        toolCall.input;
      console.log(`  Args: ${JSON.stringify(args, null, 2)}`);

      if (toolCall.result || toolCall.output || toolCall.response) {
        const resultPayload =
          toolCall.result || toolCall.output || toolCall.response;
        console.log(
          `  Result: ${JSON.stringify(resultPayload, null, 2).substring(0, 200)}...`,
        );
      }
      if (toolCall.error) {
        console.log(`  Error: ${toolCall.error}`);
      }
    });

    if (step.text) {
      console.log(`\n  Step text: ${step.text.substring(0, 100)}...`);
    }
  });

  console.log("\n💬 Final Response:");
  console.log(result.text);
  console.log("\n" + "=".repeat(50) + "\n");
}

/**
 * Internal action to process batched pending messages.
 * This is called by the scheduler after the 4-second batch window closes.
 */
export const processPendingMessages = internalAction({
  args: {
    threadId: v.id("threads"),
    senderId: v.string(),
    pageId: v.string(),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // 1. Fetch all pending messages for this thread
      const pendingMessages: Doc<"pending_messages">[] = await ctx.runQuery(
        api.pendingMessages.getPendingMessages,
        { threadId: args.threadId },
      );

      if (pendingMessages.length === 0) {
        console.log(
          "No pending messages to process for thread:",
          args.threadId,
        );
        // Clear the scheduled job ID since there's nothing to process
        await ctx.runMutation(api.threads.clearScheduledJob, {
          threadId: args.threadId,
        });
        return;
      }

      console.log(
        `Processing ${pendingMessages.length} batched messages for thread:`,
        args.threadId,
      );

      // 2. Concatenate all pending messages into a single message
      // Sort by sequence number to ensure correct order
      const sortedMessages = pendingMessages.sort(
        (a: Doc<"pending_messages">, b: Doc<"pending_messages">) =>
          a.sequenceNumber - b.sequenceNumber,
      );
      const batchedContent = sortedMessages
        .map((m: Doc<"pending_messages">) => m.content)
        .join(". ");

      // Get the first platform message ID for duplicate detection
      const firstPlatformMessageId = sortedMessages.find(
        (m: Doc<"pending_messages">) => m.platformMessageId,
      )?.platformMessageId;

      // 3. Fetch shop and thread info
      const thread = await ctx.runQuery(api.threads.get, {
        threadId: args.threadId,
      });
      if (!thread) {
        throw new Error(`Thread not found: ${args.threadId}`);
      }

      const shop = await ctx.runQuery(api.shops.get, {
        shopId: thread.shopId,
      });
      if (!shop) {
        throw new Error(`Shop not found for thread: ${args.threadId}`);
      }

      const storefront = {
        endpoint: shop.shopifyDomain,
        accessToken: shop.shopifyAccessToken,
      };

      const accessToken = shop.metaPageAccessToken;

      // 4. Show typing indicator during processing
      await sendTypingIndicator({
        recipientId: args.senderId,
        accessToken,
        action: "typing_on",
      });

      // 5. Save the batched user message to the database
      const now = Date.now();
      await ctx.runMutation(api.messages.addMessage, {
        threadId: args.threadId,
        role: "user",
        content: batchedContent,
        timestamp: now,
        platformMessageId: firstPlatformMessageId,
      });

      // 6. Fetch conversation history (last 12 messages)
      const history: Doc<"messages">[] = await ctx.runQuery(
        api.messages.listByThread,
        {
          threadId: args.threadId,
          limit: 12,
        },
      );

      // 7. Run AI assistant with the batched message
      const result = await runShopAssistant({
        history: history.map((message: Doc<"messages">) => ({
          role: message.role,
          content: message.content,
        })),
        storefront,
      });

      logAssistantResult(result);

      // 8. Extract metadata
      const allToolCalls = extractToolCalls(result.steps);
      const model = DEFAULT_MODEL;
      const usage = result.totalUsage;

      // 9. Save assistant response to database
      await ctx.runMutation(api.messages.addMessage, {
        threadId: args.threadId,
        role: "assistant",
        content: result.text,
        timestamp: Date.now(),
        reasoning: result.reasoning
          ? JSON.stringify(result.reasoning)
          : undefined,
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

      // 10. Send response back to user
      await sendMetaMessage({
        recipientId: args.senderId,
        text: result.text,
        accessToken,
      });

      // 11. Turn off typing indicator
      await sendTypingIndicator({
        recipientId: args.senderId,
        accessToken,
        action: "typing_off",
      });

      // 12. Clear pending messages queue
      await ctx.runMutation(api.pendingMessages.clearPendingMessages, {
        threadId: args.threadId,
      });

      // 13. Clear scheduled job ID from thread
      await ctx.runMutation(api.threads.clearScheduledJob, {
        threadId: args.threadId,
      });

      console.log(
        `Successfully processed batch of ${pendingMessages.length} messages`,
      );
    } catch (error) {
      console.error("Error processing pending messages:", error);

      // Clear the pending queue to prevent stuck state
      try {
        await ctx.runMutation(api.pendingMessages.clearPendingMessages, {
          threadId: args.threadId,
        });
        await ctx.runMutation(api.threads.clearScheduledJob, {
          threadId: args.threadId,
        });
      } catch (cleanupError) {
        console.error(
          "Error cleaning up after failed batch processing:",
          cleanupError,
        );
      }

      throw error;
    }
  },
});
