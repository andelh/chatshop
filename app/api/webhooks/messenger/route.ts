// app/api/webhooks/messenger/route.ts

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

          // Send a simple echo reply
          await sendMessage(senderId, `You said: ${messageText}`);
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Error", { status: 500 });
  }
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
