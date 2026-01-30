// app/api/webhooks/messenger/route.ts

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { sendMetaMessage } from "@/lib/meta/messaging";

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

          // Check if it's a message
          if (
            webhookEvent.message?.is_echo ||
            webhookEvent.sender?.id === pageId
          ) {
            continue;
          }

          if (webhookEvent.message && webhookEvent.message.text) {
            const senderId = webhookEvent.sender.id;
            const messageText = webhookEvent.message.text;
            const platformMessageId = webhookEvent.message.mid ?? null;

            if (platformMessageId) {
              const existingMessage = await client.query(
                api.messages.getByPlatformMessageId,
                { platformMessageId },
              );
              if (existingMessage) {
                console.log("Skipping duplicate message:", platformMessageId);
                continue;
              }
            }

            console.log(`📩 Message from ${senderId}: ${messageText}`);

            // Add message to pending queue and schedule batch processing
            await queueMessageForBatching({
              client,
              messageText,
              pageId,
              senderId,
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

/**
 * Queue a message for batch processing.
 * Instead of immediately processing, we add it to a pending queue and schedule
 * batch processing after a 4-second delay. If more messages arrive within that window,
 * they're added to the same batch.
 */
async function queueMessageForBatching({
  client,
  messageText,
  pageId,
  senderId,
  platformMessageId,
}: {
  client: ConvexHttpClient;
  messageText: string;
  pageId: string;
  senderId: string;
  platformMessageId: string | null;
}) {
  // Get or create thread
  const shop = await client.query(api.shops.getByMetaPageId, {
    metaPageId: pageId,
  });

  if (!shop) {
    console.error("Shop not found for pageId:", pageId);
    // Send a fallback response immediately
    const accessToken =
      process.env.META_PAGE_ACCESS_TOKEN ??
      process.env.NEXT_PUBLIC_META_PAGE_ACCESS_TOKEN;
    await sendMetaMessage({
      recipientId: senderId,
      text: "Thanks for your message. We could not identify this shop yet.",
      accessToken,
    });
    return;
  }

  const threadId = await client.mutation(api.threads.getOrCreate, {
    shopId: shop._id,
    platform: "messenger",
    platformUserId: senderId,
  });

  // Get the thread to check for existing scheduled job
  const thread = await client.query(api.threads.get, { threadId });
  const existingJobId = thread?.scheduledJobId;

  // Cancel existing scheduled job if present
  if (existingJobId) {
    console.log("Cancelling existing scheduled job:", existingJobId);
    try {
      await client.action(api.scheduler.cancelScheduledJob, {
        jobId: existingJobId,
      });
    } catch (error) {
      console.error("Error cancelling job:", error);
      // Continue anyway - the job might have already run
    }
  }

  // Get next sequence number for this thread
  const sequenceNumber = await client.mutation(
    api.threads.getNextSequenceNumber,
    { threadId },
  );

  // Add message to pending queue
  await client.mutation(api.pendingMessages.addPendingMessage, {
    threadId,
    content: messageText,
    timestamp: Date.now(),
    platformMessageId: platformMessageId ?? undefined,
    sequenceNumber,
  });

  console.log(
    `Queued message #${sequenceNumber} for thread ${threadId}. Scheduling batch processing...`,
  );

  // Schedule new batch processing job
  const newJobId = await client.action(
    api.scheduler.scheduleMessageProcessing,
    {
      threadId,
      senderId,
      pageId,
      platform: "messenger",
    },
  );

  // Update thread with new job ID
  await client.mutation(api.threads.updateScheduledJob, {
    threadId,
    jobId: newJobId,
  });

  console.log("Scheduled batch processing job:", newJobId);
}

function createConvexClient() {
  const url =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL for Convex client");
  }

  return new ConvexHttpClient(url);
}
