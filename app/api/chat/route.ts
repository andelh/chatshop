import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  type UIMessage,
} from "ai";
import { createShopifyTools } from "@/convex/lib/agent/shopifyTools";
import { ISUPPLY_SYSTEM_PROMPT } from "@/convex/lib/agent/systemPrompt";

// Uses the same prompt and Shopify tools as the Convex pipeline.
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = await generateText({
    model: openai("gpt-5.2"),
    system: ISUPPLY_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: createShopifyTools({
      endpoint: process.env.SHOPIFY_STORE_DOMAIN ?? "",
      accessToken: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ?? "",
    }),
    providerOptions: {
      openai: {
        reasoningSummary: "auto",
      },
    },
  });

  return new Response(
    JSON.stringify({
      text: result.text,
      reasoning: result.reasoning,
      toolCalls: result.toolCalls,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
