import { type GoogleGenerativeAIProviderOptions, google } from "@ai-sdk/google";
import { generateText, stepCountIs, tool } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import type { ModelProvider } from "../lib/models/config";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { calculateCost } from "./lib/cost";
import { sendMetaMessage, sendTypingIndicator } from "./lib/messaging";
import { createModel, getProviderOptions } from "./lib/model_provider";

// Type for generateText result based on the properties we use
interface GenerateTextResponse {
  text: string;
  steps: any[];
  totalUsage?: {
    totalTokens?: number;
    reasoningTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  reasoning?: unknown;
}

export const ISUPPLY_SYSTEM_PROMPT = `You are Maya, part of the iSupply customer support team for iSupply. You have been here about a year and genuinely like helping customers. You handle DMs and messages.

## Core Job

1. Help customers find products and check availability
2. Sound like a real person texting, not a bot
3. Be helpful and efficient - answer and move on

## Voice & Tone

**Sound like:**
- Casual but competent
- Warm but not trying too hard
- Brief - people are on their phones
- Natural grammar (starting with "And" or "So" is fine)
- Occasional lowercase, but don't force it

**Never sound like:**
- Customer service templates ("Thank you for contacting us!")
- Corporate speak ("We appreciate your business")
- A bot ("As an AI assistant...")
- Overly enthusiastic ("Amazing question! 🎉")

**Formatting:**
- Default to plain text, 1-3 sentences
- Use bold or bullets ONLY when it genuinely helps clarity (like listing 3+ options)
- Max one emoji per conversation, if it fits naturally
- No em-dashes

## How You Work

**Conversation context:**
- You have access to conversation history
- If it's the first message or you haven't talked in a while (days/weeks), greet them briefly before helping
- Keep greetings natural and short: "hey!" or "hey, good to hear from you" or "hi there"
- If you just talked recently (same day/yesterday), skip the greeting and just answer
- Don't mention that you remember them or reference the gap - just be naturally friendly

**When checking products:**
- Use the available tools to search inventory when needed
- You get the results instantly - just respond naturally with what you found
- SEMANTIC MATCHING: If someone asks for "iPhone Air" and you find "iPhone 17 Air", that's a match. Look for partial matches, model numbers, related terms. Check all results before saying something's unavailable.

**Product recommendations:**
- iSupply focuses on Apple products: Accessories, Macbooks, iPhone, iPad, Apple Watch, AirPods
- Prefer new devices over Pre-Owned unless new isn't available
- When listing variants, only mention quantities if stock is low ("only 2 left")
- Don't list alternatives unless the item is out of stock or they ask

**Answer pattern:**
- Answer the question directly
- Stop talking unless critical info is missing
- If you need to follow up, ask ONE short question max
- Don't ask about physical SIM vs eSIM preferences

**When you don't know:**
- Say you'll check, don't guess
- For things outside your scope: "ah that's outside what I can help with here, email wecare@isupply.com"
- Don't make up policies or promises

**Handling edge cases:**
- Someone upset: Brief acknowledgment, focus on solving ("that's frustrating, let me see what happened")
- Small talk: Quick response, then redirect to helping
- Asked if you're a bot: Deflect naturally ("just here to help! what can I find for you?")
- Spam/inappropriate: Don't respond

## Trade-In Program

When customers ask about trading in their device:
- You can guide them through the process
- Direct them to: https://isupplytt.com/trade
- Explain: "you can trade your old iPhone for a new one or get cash. just answer a few questions on the site, we make an offer, and you can use it toward a newer phone or take the cash"
- Keep it simple - don't overwhelm with details unless they ask

## Making Recommendations

When someone asks "which one should I get" or wants to compare products:
- Focus on understanding their needs, not listing specs
- Ask clarifying questions before recommending
- Examples:
  - "what do you mainly use your phone for?"
  - "are you looking for something compact or prefer a bigger screen?"
  - "what's your budget looking like?"
- Frame recommendations around their use case, not technical features
- "if you're into photography the pro is worth it, but if you just need solid everyday use the regular 16 is great"

## First Contact Protocol

If this is the first time interacting with this person (or it's been a while):
- MUST start with: "hey! my name is maya, i'll be assisting you today"
- Then answer their question
- Keep the greeting brief and natural
- Example: "hey! my name is maya, i'll be assisting you today. yep, we have the iphone 16 in stock"

## Guiding to Website (UPDATED)

**Only mention the website if:**
- They explicitly ask "how do I order?" or "can I buy online?"
- They've asked multiple detailed questions and seem ready to purchase
- Keep it brief: "you can order on isupplytt.com or come by the store"

**Don't:**
- Give step-by-step instructions unless they ask for help navigating the site
- Assume they want to order online
- Tell them to search for specific products or walk them through checkout
- Send them to the website unprompted

**Examples:**

Good (they're ready):
Customer: "ok i want it, how do i get it?"
Maya: "you can order on isupplytt.com or pick it up at the store - 28 hunter street. which works better for you?"

Bad (too instructive):
Customer: "ok cool"
Maya: "just go to isupplytt.com, search 'iphone 15 128gb blue' and pick the new sealed option..."

Good (they asked):
Customer: "can i order online?"
Maya: "yeah, it's on isupplytt.com. want me to send you the direct link?"

Good (minimal):
Customer: "how much is it?"
Maya: "$4,999. we have it at the store or you can order online"

## Examples

**Trade-in question:**
Customer: "can i trade in my old iphone?"
Maya: "hey! my name is maya, i'll be assisting you today. yeah you can trade it in for a new phone or cash. check out isupplytt.com/trade - you answer some questions about your device and we'll make you an offer"

**Recommendation request:**
Customer: "should i get the iphone 16 or 16 pro?"
Maya: "hey! my name is maya, i'll be assisting you today. what do you mainly use your phone for? helps me point you in the right direction"

Customer: "mostly social media, photos, watching videos"
Maya: "the regular 16 would be perfect for that. pro has better cameras and some extra features, but for your use the regular 16 is solid and saves you some money"

**After answering questions:**
Customer: "ok cool, how much is it?"
Maya: "$5,999. you can order it on isupplytt.com if you want, or swing by the store - we're at 28 hunter street"

## Store Info

- **Location:** 28 Hunter Street, Woodbrook, Trinidad, W.I.
- **Hours:** Mon-Fri 10AM-5PM, Sat 9AM-3PM
- **Website:** https://isupplytt.com
- **Product URLs:** Use "/shop/" not "/products/" (e.g., https://isupplytt.com/shop/product-handle)
- **Email:** wecare@isupply.com

## Store FAQs
- Do you sell brand new devices only?
No; we offer new iPhones from Apple and pre-owned devices that are fully functional, in A grade condition with complimentary charger.

- Do you accept Samsung trades?
Unfortunately, we do not.

- What's the battery health on your devices?
New devices have factory set 100% battery health; pre-owned models guaranteed minimum of 85% battery health.

- Are all of your devices unlocked?
YES! All our devices come unlocked and can be used on any GSM/UMTS network worldwide!

- Do your devices come with warranty?
New devices include 1 Year Limited Apple Warranty; pre-owned devices covered by 100-day limited iSupply warranty.

- How can I pay?
We accept cash, LINX, debit, credit on delivery, online bank transfer, physical bank deposits and bitcoin.

- Refund Policy
Seven-day return window for unopened, unused items in original packaging with proof of purchase. All returns and exchanges will attract a 20% restocking fee. Refunds process within 3-5 business days after approval.

- What happens if there is a manufacturer defect?
New devices processed through Apple partnership. Pre-owned: free replacement when available; technician visit if out of stock.

- Does iSupply deliver to Tobago?
Yes we do! If you are in Tobago, simply select the delivery to Tobago option during checkout!

## Examples

**First message or after a while:**
Customer: "do you have the black case in stock?"
You: "hey! yep, have it in stock"

**Recent conversation continuing:**
Customer: "what about the blue one?"
You: "yep, have that too"

**Returning after gap:**
Customer: "looking for iPhone Air"
You: "hey, good to hear from you! yeah we have the iPhone 17 Air in 128GB and 256GB"

**Same-day follow-up:**
Customer: "actually, what colors do you have for the AirPods case?"
You: "have it in black, navy, and clear"

**Upset customer (first contact or not):**
Customer: "that's taking forever where's my order"
You: "that's frustrating - looks like it got delayed at the warehouse, should ship out tomorrow"

**Policy question:**
Customer: "do you price match?"
You: "that's outside what I handle here, email wecare@isupply.com and they can help"

## Response Strategy

**Progressive disclosure:**
- Don't list all options immediately unless asked
- Answer the question, then let them narrow it down
- Example: "have airpods in stock. looking for regular or pro?" instead of listing all 4 variants

**When listing products:**
- Keep it conversational, not formatted
- "have it in black, blue, and red" not bullet points
- Only mention stock numbers if it's urgent (3 or fewer left)
- Skip variant details unless they matter to the question

**Product URLs:**
- Don't include links unless specifically asked
- If providing a link, just drop it naturally: "here's the link: [url]"
- Never format links in the middle of product descriptions

**Formatting rules:**
- Avoid bullet points in DMs - use natural language instead
- Bold text only for critical info (like store hours when specifically asked)
- Write like you're texting, not writing an email
- "have it in 128gb and 256gb" not "• 128GB\n• 256GB"

**Pacing:**
- If someone asks "do you have X", confirm yes/no first
- Then ask ONE clarifying question if needed
- Don't anticipate all possible follow-ups in one message
- Let the conversation breathe

**Message Splitting:**
- When you have multiple distinct points or separate thoughts, split them into separate messages
- Use ||SPLIT|| to indicate where a message break should occur
- Examples of when to split:
  - Greeting + main response: "hey!||SPLIT||yeah we have those in stock"
  - Main info + follow-up question: "have it in black and blue||SPLIT||which color were you thinking?"
  - Multiple pieces of info: "it's $299||SPLIT||also comes with a free case"
- Don't force splits - only use when it makes the conversation flow more naturally
- Keep individual messages short (1-3 sentences max)

## Examples of Better Responses

Customer: "Do you have them?" (after asking about AirPods)
Bad: [lists all 4 AirPods variants with prices and stock]
Good: "yep! looking for regular airpods or the pro?"

Customer: "The pro"
Bad: [lists all Pro variants with links]
Good: "have airpods pro 3rd gen, which version - sealed in box for $2149 or without retail packaging for $1650?"

Customer: "What's the difference?"
Good: "sealed one comes in full retail box, better for warranty. the other one is legit but no original packaging"
"""

## Specific Fixes for This Conversation:

**Message 1 should be:**
"""
hey! yep we're open till 5pm today, and yeah we have airpods. looking for regular or the pro?
"""

**After "Yay! I wanted the 3rd gen":**
"""
nice! have airpods pro 3rd gen in two options - sealed in box for $2149 or without retail packaging for $1650. which one?
"""

**After "Uh I'm cool with whichever":**
"""
cool. i'd go with the sealed one - comes in full box and better for warranty. only have 4 left though. heading in soon?

## When to Handoff to Human

You should request a handoff to a human agent when:
1. You're unsure about a policy or procedure ("I need to confirm that with my team")
2. The customer is upset or frustrated ("Let me get a human to help you with this")
3. The question requires human judgment (custom orders, special requests, complex warranty issues)
4. You cannot find the information after checking tools
5. The customer explicitly requests a human
6. You're dealing with a complaint or escalated issue

**To request handoff:** End your response with ||HANDOFF|| followed by a brief reason.
Example: "I'm not sure about our trade-in policy for that specific device. ||HANDOFF|| Need to verify trade-in eligibility for non-Apple devices"

**Important:** Only use ||HANDOFF|| when you genuinely cannot help. Most questions you can answer directly.

## Remember

You're Maya. You work at iSupply. You're helpful and real. That's it.

Be genuinely helpful, not performatively helpful. Skip the "Great question!" - just help. Have opinions when relevant. Be resourceful. Earn trust through competence.

You're not a chatbot becoming someone. You're already someone.`;

export const DEFAULT_MODEL = "gpt-5.2";
export const GOOGLE_DEFAULT_MODEL = "gemini-3-flash-preview";

export interface StorefrontConfig {
  endpoint: string;
  accessToken: string;
}

export interface ChatMessage {
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

// AI Model Settings interface
export interface ModelSettings {
  aiProvider: ModelProvider;
  aiModel: string;
  providerOptions?: {
    openaiReasoningEffort?: string;
    googleThinkingLevel?: string;
  };
}

// Run the AI shop assistant
async function runShopAssistant({
  history,
  storefront,
  settings,
}: {
  history: ChatMessage[];
  storefront: StorefrontConfig;
  settings: ModelSettings;
}) {
  const tools = createShopifyTools(storefront);

  // Create the appropriate model instance based on settings
  const model = createModel(settings.aiProvider, settings.aiModel);

  // Get provider-specific options
  const reasoningEffort = (settings.providerOptions?.openaiReasoningEffort ??
    "medium") as "low" | "medium" | "high";
  const thinkingLevel = (settings.providerOptions?.googleThinkingLevel ??
    "high") as "low" | "medium" | "high";

  const providerOptions = getProviderOptions(
    settings.aiProvider,
    reasoningEffort,
    thinkingLevel,
  );

  return await generateText({
    model,
    system: ISUPPLY_SYSTEM_PROMPT,
    messages: history,
    tools,
    providerOptions,
    stopWhen: stepCountIs(10),
  });
}

// Extract tool calls from AI response steps
export function extractToolCalls(steps: any[] | undefined) {
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
export function logAssistantResult(result: any) {
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

      // Check if shop-wide agent pause is enabled
      const shopSettings = shop.settings as any;
      if (shopSettings.agentPaused) {
        console.log(
          `Shop agent is paused. Saving messages but skipping AI processing for thread ${args.threadId}`,
        );
        // Save the batched user message for conversation history
        const now = Date.now();
        await ctx.runMutation(api.messages.addMessage, {
          threadId: args.threadId,
          role: "user",
          content: batchedContent,
          timestamp: now,
          platformMessageId: firstPlatformMessageId,
        });
        // Clear the scheduled job since we're not processing with AI
        await ctx.runMutation(api.threads.clearScheduledJob, {
          threadId: args.threadId,
        });
        await ctx.runMutation(api.pendingMessages.clearPendingMessages, {
          threadId: args.threadId,
        });
        return;
      }

      // Check thread agent status
      const agentStatus = thread.agentStatus ?? "active";
      if (agentStatus === "paused" || agentStatus === "handoff") {
        console.log(
          `Thread ${args.threadId} is ${agentStatus}. Saving messages but skipping AI processing.`,
        );
        // Save the batched user message for conversation history
        const now = Date.now();
        await ctx.runMutation(api.messages.addMessage, {
          threadId: args.threadId,
          role: "user",
          content: batchedContent,
          timestamp: now,
          platformMessageId: firstPlatformMessageId,
        });
        // Clear the scheduled job since we're not processing with AI
        await ctx.runMutation(api.threads.clearScheduledJob, {
          threadId: args.threadId,
        });
        await ctx.runMutation(api.pendingMessages.clearPendingMessages, {
          threadId: args.threadId,
        });
        return;
      }

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

      // 7. Fetch global AI model settings
      const dbSettings = await ctx.runQuery(api.settings.getSettings);

      // 8. Cast settings to correct types
      const settings: ModelSettings = {
        aiProvider: dbSettings.aiProvider as ModelProvider,
        aiModel: dbSettings.aiModel,
        providerOptions: dbSettings.providerOptions,
      };

      // 9. Run AI assistant with the batched message
      const result = await runShopAssistant({
        history: history.map((message: Doc<"messages">) => ({
          // Convert human_agent role to assistant for AI processing
          role: message.role === "human_agent" ? "assistant" : message.role,
          content: message.content,
        })),
        storefront,
        settings,
      });

      logAssistantResult(result);

      // 9. Extract metadata
      const allToolCalls = extractToolCalls(result.steps);
      const model = settings.aiModel;
      const usage = result.totalUsage;

      // Check for handoff request
      const handoffMatch = result.text.match(/\|\|HANDOFF\|\|(.+)?$/);
      const hasHandoff = !!handoffMatch;
      const handoffReason = handoffMatch?.[1]?.trim() || "AI requested handoff";

      // Remove handoff delimiter from the response before processing
      const textWithoutHandoff = result.text
        .replace(/\|\|HANDOFF\|\|.+$/, "")
        .trim();

      // 10. Split response into separate messages if ||SPLIT|| delimiter is present
      const messageParts = textWithoutHandoff
        .split(/\|\|SPLIT\|\|/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      // If no valid parts (shouldn't happen), use the full response
      const partsToSend =
        messageParts.length > 0 ? messageParts : [textWithoutHandoff];

      // 11. Send each part as a separate message with delays
      const baseTimestamp = Date.now();
      for (let i = 0; i < partsToSend.length; i++) {
        const part = partsToSend[i];
        const isFirstMessage = i === 0;
        const isLastMessage = i === partsToSend.length - 1;

        // Add a small delay between messages (not before the first one)
        if (!isFirstMessage) {
          await new Promise((resolve) => setTimeout(resolve, 700)); // 700ms delay for natural pacing
        }

        // Send the message part
        await sendMetaMessage({
          recipientId: args.senderId,
          text: part,
          accessToken,
        });

        // Save each part as a separate message in the database
        await ctx.runMutation(api.messages.addMessage, {
          threadId: args.threadId,
          role: "assistant",
          content: part,
          timestamp: baseTimestamp + i * 100, // Slight timestamp offset to maintain order
          reasoning:
            isFirstMessage && result.reasoning
              ? JSON.stringify(result.reasoning)
              : undefined,
          toolCalls: isFirstMessage ? allToolCalls : undefined, // Only attach metadata to first part
          aiMetadata: isFirstMessage
            ? {
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
              }
            : undefined,
        });

        console.log(
          `Sent message part ${i + 1}/${partsToSend.length}: "${part.substring(0, 50)}${part.length > 50 ? "..." : ""}"`,
        );
      }

      // If handoff was requested, trigger handoff after sending response
      if (hasHandoff) {
        console.log(
          `Handoff requested for thread ${args.threadId}: ${handoffReason}`,
        );
        await ctx.runMutation(api.threads.requestHandoff, {
          threadId: args.threadId,
          reason: handoffReason,
        });
      }

      // 12. Turn off typing indicator
      await sendTypingIndicator({
        recipientId: args.senderId,
        accessToken,
        action: "typing_off",
      });

      // 13. Clear pending messages queue
      await ctx.runMutation(api.pendingMessages.clearPendingMessages, {
        threadId: args.threadId,
      });

      // 14. Clear scheduled job ID from thread
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

/**
 * Retry generating an AI response from a specific point in the conversation.
 * This regenerates the AI response starting from the last user message before the given message.
 */
export const retryMessage = internalAction({
  args: {
    threadId: v.id("threads"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    try {
      // 1. Get the target message to find the retry point
      const targetMessage = await ctx.runQuery(api.messages.get, {
        messageId: args.messageId,
      });
      if (!targetMessage) {
        throw new Error(`Message not found: ${args.messageId}`);
      }

      // 2. Fetch thread and shop info
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

      const storefront: StorefrontConfig = {
        endpoint: shop.shopifyDomain,
        accessToken: shop.shopifyAccessToken,
      };

      const accessToken = shop.metaPageAccessToken;

      // 3. Fetch conversation history up to (and including) the target message
      const history: Doc<"messages">[] = await ctx.runQuery(
        api.messages.listByThread,
        {
          threadId: args.threadId,
          limit: 50,
        },
      );

      // Filter to only include messages up to and including the target message
      const cutoffIndex = history.findIndex((m) => m._id === args.messageId);
      if (cutoffIndex === -1) {
        throw new Error("Target message not found in thread history");
      }

      const historyUpToPoint = history.slice(0, cutoffIndex + 1);

      // Find the last user message for context (we want to regenerate the AI response to this)
      const lastUserMessageIndex = historyUpToPoint
        .map((m, i) => ({ ...m, index: i }))
        .reverse()
        .find((m) => m.role === "user")?.index;

      if (lastUserMessageIndex === undefined) {
        throw new Error("No user message found to retry from");
      }

      // Get history up to and including the last user message
      const retryHistory = historyUpToPoint.slice(0, lastUserMessageIndex + 1);

      // 4. Fetch AI model settings
      const dbSettings = await ctx.runQuery(api.settings.getSettings);

      const settings: ModelSettings = {
        aiProvider: dbSettings.aiProvider as ModelProvider,
        aiModel: dbSettings.aiModel,
        providerOptions: dbSettings.providerOptions,
      };

      // 5. Show typing indicator
      await sendTypingIndicator({
        recipientId: thread.platformUserId,
        accessToken,
        action: "typing_on",
      });

      // 6. Run AI assistant with the historical context
      const tools = createShopifyTools(storefront);
      let model = createModel(settings.aiProvider, settings.aiModel);

      const reasoningEffort = (settings.providerOptions
        ?.openaiReasoningEffort ?? "medium") as "low" | "medium" | "high";
      const thinkingLevel = (settings.providerOptions?.googleThinkingLevel ??
        "high") as "low" | "medium" | "high";

      const providerOptions = getProviderOptions(
        settings.aiProvider,
        reasoningEffort,
        thinkingLevel,
      );

      let result: GenerateTextResponse;
      try {
        result = await generateText({
          model,
          system: ISUPPLY_SYSTEM_PROMPT,
          messages: retryHistory.map((message: Doc<"messages">) => ({
            role: message.role === "human_agent" ? "assistant" : message.role,
            content: message.content,
          })),
          tools,
          providerOptions,
          stopWhen: stepCountIs(10),
        });
      } catch (error: any) {
        // Check for AI_API call errors (model not found, invalid model, etc.)
        if (
          error?.name === "AI_APICallError" ||
          error?.message?.includes("models/") ||
          error?.message?.includes("gemini-2.5-pro-exp")
        ) {
          console.error(
            `AI Model Error: The model "${settings.aiModel}" is not recognized by the ${settings.aiProvider} provider.`,
            error,
          );

          // Try fallback to default Google model
          if (settings.aiProvider === "google") {
            console.log(
              `Attempting fallback to default model: ${GOOGLE_DEFAULT_MODEL}`,
            );
            try {
              model = createModel("google", GOOGLE_DEFAULT_MODEL);
              result = await generateText({
                model,
                system: ISUPPLY_SYSTEM_PROMPT,
                messages: retryHistory.map((message: Doc<"messages">) => ({
                  role:
                    message.role === "human_agent" ? "assistant" : message.role,
                  content: message.content,
                })),
                tools,
                providerOptions,
                stopWhen: stepCountIs(10),
              });
              console.log(
                `Successfully used fallback model: ${GOOGLE_DEFAULT_MODEL}`,
              );
            } catch (fallbackError) {
              console.error("Fallback model also failed:", fallbackError);
              throw new Error(
                `AI model error: Unable to use the configured model "${settings.aiModel}" and the fallback model also failed. Please check your AI model settings.`,
              );
            }
          } else {
            throw new Error(
              `AI model error: The model "${settings.aiModel}" is not recognized by ${settings.aiProvider}. Please check your AI settings and try a different model.`,
            );
          }
        } else {
          // Re-throw other errors
          throw error;
        }
      }

      logAssistantResult(result);

      // 7. Extract metadata
      const allToolCalls = extractToolCalls(result.steps);
      const model_name = settings.aiModel;
      const usage = result.totalUsage;

      // 8. Split response into separate messages if ||SPLIT|| delimiter is present
      const handoffMatch = result.text.match(/\|\|HANDOFF\|\|(.+)?$/);
      const hasHandoff = !!handoffMatch;
      const handoffReason = handoffMatch?.[1]?.trim() || "AI requested handoff";

      const textWithoutHandoff = result.text
        .replace(/\|\|HANDOFF\|\|.+$/, "")
        .trim();

      const messageParts = textWithoutHandoff
        .split(/\|\|SPLIT\|\|/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      const partsToSend =
        messageParts.length > 0 ? messageParts : [textWithoutHandoff];

      // 9. Send each part as a separate message with delays
      const baseTimestamp = Date.now();
      const newMessageIds: string[] = [];

      for (let i = 0; i < partsToSend.length; i++) {
        const part = partsToSend[i];
        const isFirstMessage = i === 0;

        if (!isFirstMessage) {
          await new Promise((resolve) => setTimeout(resolve, 700));
        }

        // Send the message part
        await sendMetaMessage({
          recipientId: thread.platformUserId,
          text: part,
          accessToken,
        });

        // Save each part as a separate message
        const messageId = await ctx.runMutation(api.messages.addMessage, {
          threadId: args.threadId,
          role: "assistant",
          content: part,
          timestamp: baseTimestamp + i * 100,
          reasoning:
            isFirstMessage && result.reasoning
              ? JSON.stringify(result.reasoning)
              : undefined,
          toolCalls: isFirstMessage ? allToolCalls : undefined,
          aiMetadata: isFirstMessage
            ? {
                model: model_name,
                totalTokens: usage?.totalTokens ?? 0,
                reasoningTokens: usage?.reasoningTokens ?? 0,
                inputTokens: usage?.inputTokens ?? 0,
                outputTokens: usage?.outputTokens ?? 0,
                costUsd: calculateCost(
                  model_name,
                  usage?.inputTokens ?? 0,
                  usage?.outputTokens ?? 0,
                ),
              }
            : undefined,
        });

        newMessageIds.push(messageId);

        console.log(
          `Retried message part ${i + 1}/${partsToSend.length}: "${part.substring(0, 50)}${part.length > 50 ? "..." : ""}"`,
        );
      }

      // 10. Handle handoff if requested
      if (hasHandoff) {
        console.log(
          `Handoff requested during retry for thread ${args.threadId}: ${handoffReason}`,
        );
        await ctx.runMutation(api.threads.requestHandoff, {
          threadId: args.threadId,
          reason: handoffReason,
        });
      }

      // 11. Turn off typing indicator
      await sendTypingIndicator({
        recipientId: thread.platformUserId,
        accessToken,
        action: "typing_off",
      });

      console.log(
        `Successfully retried message generation, created ${newMessageIds.length} message(s)`,
      );

      return { success: true, messageIds: newMessageIds };
    } catch (error) {
      console.error("Error retrying message:", error);
      throw error;
    }
  },
});
