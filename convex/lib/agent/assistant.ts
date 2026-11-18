import { generateText, stepCountIs } from "ai";
import type { ModelProvider } from "../../../lib/models/config";
import { calculateModelCost } from "../../../lib/models/config";
import { createModel, getProviderOptions, type StoredProviderOptions } from "../model_provider";
import { createShopifyTools, type StorefrontConfig } from "./shopifyTools";
import { ISUPPLY_SYSTEM_PROMPT } from "./systemPrompt";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** The global AI settings (`app_settings`). */
export interface ModelSettings {
  aiProvider: ModelProvider;
  aiModel: string;
  providerOptions?: StoredProviderOptions;
}

/** Run the shop assistant over a conversation that ends on a user turn. */
export async function runShopAssistant({
  history,
  storefront,
  settings,
}: {
  history: ChatMessage[];
  storefront: StorefrontConfig;
  settings: ModelSettings;
}) {
  return await generateText({
    model: createModel(settings.aiProvider, settings.aiModel),
    system: ISUPPLY_SYSTEM_PROMPT,
    messages: history,
    tools: createShopifyTools(storefront),
    providerOptions: getProviderOptions(
      settings.aiProvider,
      settings.providerOptions,
    ),
    stopWhen: stepCountIs(10),
  });
}

type AssistantResult = Awaited<ReturnType<typeof runShopAssistant>>;

/** Token usage and cost, stored on the first message of a reply. */
export function buildAiMetadata(model: string, result: AssistantResult) {
  const usage = result.totalUsage;
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  return {
    model,
    totalTokens: usage?.totalTokens ?? 0,
    reasoningTokens: usage?.reasoningTokens ?? 0,
    inputTokens,
    outputTokens,
    costUsd: calculateModelCost(model, inputTokens, outputTokens),
  };
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
