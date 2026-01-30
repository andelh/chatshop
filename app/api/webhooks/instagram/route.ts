// app/api/webhooks/instagram/route.ts

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { calculateCost } from "@/lib/ai/cost";
import {
  DEFAULT_MODEL,
  extractToolCalls,
  runShopAssistant,
} from "@/lib/ai/shop-assistant";
import {
  fetchInstagramProfileName,
  sendMetaMessage,
} from "@/lib/meta/messaging";

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

            const { reply, accessToken } = await generateShopifyReply({
              messageText,
              instagramAccountId,
              senderId,
              platformMessageId,
            });
            await sendMetaMessage({
              recipientId: senderId,
              text: reply,
              accessToken:
                accessToken ??
                process.env.META_PAGE_ACCESS_TOKEN ??
                process.env.NEXT_PUBLIC_META_PAGE_ACCESS_TOKEN,
            });
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
}): Promise<{ reply: string; accessToken?: string }> {
  const client = createConvexClient();
  const shop = await client.query(api.shops.getByInstagramAccountId, {
    instagramAccountId,
  });

  if (!shop) {
    return {
      reply: "Thanks for your message. We could not identify this shop yet.",
      accessToken:
        process.env.META_PAGE_ACCESS_TOKEN ??
        process.env.NEXT_PUBLIC_META_PAGE_ACCESS_TOKEN,
    };
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

  const result = await runShopAssistant({
    history: history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    storefront,
  });

  const allToolCalls = extractToolCalls(result.steps);
  const model = DEFAULT_MODEL;
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

  return { reply: result.text, accessToken: shop.metaPageAccessToken };
}

function createConvexClient() {
  const url =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL for Convex client");
  }

  return new ConvexHttpClient(url);
}
