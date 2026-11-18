import { generateText, stepCountIs } from "ai";
import {
  calculateModelCost,
  type ModelProvider,
} from "../../../lib/models/config";
import {
  createModel,
  getProviderOptions,
  type StoredProviderOptions,
} from "../model_provider";
import { createShopifyTools, type StorefrontConfig } from "./shopifyTools";

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

/**
 * Drop turns before the first customer message. A history window can start
 * mid-conversation on an assistant (or staff) turn, and providers expect the
 * conversation to open with the user.
 */
export function trimToFirstUserTurn(history: ChatMessage[]): ChatMessage[] {
  const firstUser = history.findIndex((message) => message.role === "user");
  return firstUser === -1 ? [] : history.slice(firstUser);
}

/** Run the shop assistant over a conversation that ends on a user turn. */
export async function runShopAssistant({
  history,
  storefront,
  settings,
  system,
}: {
  history: ChatMessage[];
  storefront: StorefrontConfig;
  settings: ModelSettings;
  /** The shop's system prompt (see systemPromptFor). */
  system: string;
}) {
  return await generateText({
    model: createModel(settings.aiProvider, settings.aiModel),
    system,
    messages: trimToFirstUserTurn(history),
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

/**
 * One tool call in the shape Studio stores. AI SDK step objects have used
 * different field names across versions, so read each field from any of them.
 */
function normalizeToolCall(toolCall: any) {
  const result = toolCall.result || toolCall.output || toolCall.response;
  return {
    toolCallId: toolCall.toolCallId || toolCall.callId,
    toolName: toolCall.toolName || toolCall.tool?.name,
    args:
      toolCall.args ||
      toolCall.parameters ||
      toolCall.arguments ||
      toolCall.input,
    result,
    state: toolCall.state || (result ? "output-available" : "input-available"),
  };
}

/** Tool calls from every step of a reply, for the message's `toolCalls`. */
export function extractToolCalls(steps: any[] | undefined) {
  return (
    steps?.flatMap(
      (step: any) => step.toolCalls?.map(normalizeToolCall) || [],
    ) || []
  );
}

/** Log a reply's token usage, steps and tool calls. */
export function logAssistantResult(result: any) {
  console.log("\n🤖 AI Response Generated:");
  console.log(`Reasoning tokens: ${result.totalUsage?.reasoningTokens || 0}`);
  console.log(`Total tokens: ${result.totalUsage?.totalTokens || 0}`);

  console.log("\n📋 Execution Steps:");
  result.steps.forEach((step: any, index: number) => {
    console.log(`\n--- Step ${index + 1} ---`);
    console.log(`Tool calls: ${step.toolCalls?.length || 0}`);

    step.toolCalls?.forEach((rawToolCall: any, toolIndex: number) => {
      const toolCall = normalizeToolCall(rawToolCall);
      console.log(
        `\n  Tool ${toolIndex + 1}: ${toolCall.toolName || "unknown"}`,
      );
      console.log(`  Tool Call ID: ${toolCall.toolCallId || "N/A"}`);
      console.log(`  Args: ${JSON.stringify(toolCall.args, null, 2)}`);
      if (toolCall.result) {
        console.log(
          `  Result: ${JSON.stringify(toolCall.result, null, 2).substring(0, 200)}...`,
        );
      }
      if (rawToolCall.error) {
        console.log(`  Error: ${rawToolCall.error}`);
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
