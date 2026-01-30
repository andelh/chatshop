export async function sendMetaMessage({
  recipientId,
  text,
  accessToken,
}: {
  recipientId: string;
  text: string;
  accessToken: string | undefined;
}) {
  if (!accessToken) {
    throw new Error("Missing META_PAGE_ACCESS_TOKEN for sending messages");
  }

  const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      access_token: accessToken,
    }),
  });

  const data = await response.json();
  return data;
}

export async function sendTypingIndicator({
  recipientId,
  accessToken,
  action,
}: {
  recipientId: string;
  accessToken: string | undefined;
  action: "typing_on" | "typing_off";
}) {
  if (!accessToken) {
    throw new Error("Missing META_PAGE_ACCESS_TOKEN for typing indicator");
  }

  const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      sender_action: action,
      access_token: accessToken,
    }),
  });

  return await response.json();
}
