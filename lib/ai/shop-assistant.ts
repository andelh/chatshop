import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs } from "ai";
import { createShopifyTools } from "@/lib/ai/shopify-tools";
import { ISUPPLY_SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";

interface StorefrontConfig {
  endpoint: string;
  accessToken: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const DEFAULT_MODEL = "gpt-5.2";

const DEFAULT_PROVIDER_OPTIONS = {
  openai: {
    reasoningEffort: "medium",
    reasoningSummary: "auto" as const,
  },
};

export async function runShopAssistant({
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
    providerOptions: DEFAULT_PROVIDER_OPTIONS,
    stopWhen: stepCountIs(10),
  });
}

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
