// app/api/webhooks/messenger/route.ts

import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { shopifyFetch } from "@/lib/shopify";

const ISUPPLY_SYSTEM_PROMPT =
  "You are the iSupply social assistant. Answer questions about product availability and stock using the provided tools when needed. Be concise, factual, and helpful. Avoid fluff. Sound polite and human.";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = "my_test_token_12345"; // Choose any string

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📨 Webhook received:", JSON.stringify(body, null, 2));

    if (body.object === "page") {
      for (const entry of body.entry) {
        const webhookEvent = entry.messaging[0];
        console.log("Event:", webhookEvent);

        // Check if it's a message
        if (webhookEvent.message && webhookEvent.message.text) {
          const senderId = webhookEvent.sender.id;
          const messageText = webhookEvent.message.text;

          console.log(`📩 Message from ${senderId}: ${messageText}`);

          const reply = await generateShopifyReply(messageText);
          await sendMessage(senderId, reply);
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Error", { status: 500 });
  }
}

async function generateShopifyReply(messageText: string) {
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
  };

  const result = await generateText({
    model: openai("gpt-5.2-codex"),
    system: ISUPPLY_SYSTEM_PROMPT,
    messages: [{ role: "user", content: messageText }],
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.text;
}

// Helper function to send messages
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
  console.log("✉️ Reply sent:", data);
  return data;
}
