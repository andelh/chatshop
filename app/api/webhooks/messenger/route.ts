// app/api/webhooks/messenger/route.ts

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

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
      const client = createConvexClient();
      for (const entry of body.entry) {
        const pageId = entry.id;
        for (const webhookEvent of entry.messaging ?? []) {
          console.log("Event:", webhookEvent);

          // Skip echoes and messages sent by the page itself
          if (
            webhookEvent.message?.is_echo ||
            webhookEvent.sender?.id === pageId
          ) {
            continue;
          }

          if (webhookEvent.message && webhookEvent.message.text) {
            const senderId = webhookEvent.sender.id;
            const messageText = webhookEvent.message.text;
            const platformMessageId = webhookEvent.message.mid ?? undefined;

            // Deduplicate
            if (platformMessageId) {
              const existing = await client.query(
                api.messages.getByPlatformMessageId,
                { platformMessageId },
              );
              if (existing) {
                console.log("Skipping duplicate message:", platformMessageId);
                continue;
              }
            }

            console.log(`📩 Message from ${senderId}: ${messageText}`);

            await client.action(api.webhooks.queueIncomingMessage, {
              platform: "messenger",
              pageId,
              senderId,
              messageText,
              platformMessageId,
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

function createConvexClient() {
  const url =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL for Convex client");
  }
  return new ConvexHttpClient(url);
}
