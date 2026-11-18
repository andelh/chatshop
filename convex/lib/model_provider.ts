import {
  type AnthropicLanguageModelOptions,
  anthropic,
} from "@ai-sdk/anthropic";
import { type GoogleGenerativeAIProviderOptions, google } from "@ai-sdk/google";
import { type OpenAIResponsesProviderOptions, openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import {
  ANTHROPIC_EFFORT_LEVELS,
  type AnthropicEffort,
  DEFAULT_MODEL_CONFIG,
  getModelsByProvider,
  type ModelProvider,
} from "../../lib/models/config";

/** Provider options as stored in `app_settings.providerOptions`. */
export interface StoredProviderOptions {
  anthropicEffort?: string;
  openaiReasoningEffort?: string;
  googleThinkingLevel?: string;
}

type ProviderOptions = NonNullable<
  Parameters<typeof import("ai").generateText>[0]["providerOptions"]
>;

/**
 * Factory function to create a model instance based on provider and model ID
 */
export function createModel(
  provider: ModelProvider,
  modelId: string,
): LanguageModel {
  switch (provider) {
    case "anthropic":
      return anthropic(modelId);
    case "openai":
      return openai(modelId);
    case "google":
      return google(modelId);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

function isAnthropicEffort(value: unknown): value is AnthropicEffort {
  return (ANTHROPIC_EFFORT_LEVELS as readonly unknown[]).includes(value);
}

type ThreeLevel = "low" | "medium" | "high";
function isThreeLevel(value: unknown): value is ThreeLevel {
  return value === "low" || value === "medium" || value === "high";
}

/**
 * Provider-specific options for the configured provider only.
 *
 * Anthropic: Claude 5.5 models always think adaptively (thinking can't be
 * disabled); `effort` sets how much. Thinking is summarized so Studio can
 * show the reasoning.
 */
export function getProviderOptions(
  provider: ModelProvider,
  stored: StoredProviderOptions = {},
): ProviderOptions {
  const defaults = DEFAULT_MODEL_CONFIG.providerOptions;
  switch (provider) {
    case "anthropic":
      return {
        anthropic: {
          effort: isAnthropicEffort(stored.anthropicEffort)
            ? stored.anthropicEffort
            : defaults.anthropicEffort,
          thinking: { type: "adaptive", display: "summarized" },
        } satisfies AnthropicLanguageModelOptions,
      };
    case "openai":
      return {
        openai: {
          reasoningEffort: isThreeLevel(stored.openaiReasoningEffort)
            ? stored.openaiReasoningEffort
            : "medium",
          reasoningSummary: "auto",
        } satisfies OpenAIResponsesProviderOptions,
      };
    case "google":
      return {
        google: {
          thinkingConfig: {
            thinkingLevel: isThreeLevel(stored.googleThinkingLevel)
              ? stored.googleThinkingLevel
              : "high",
            includeThoughts: true,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      };
    default:
      return {};
  }
}

/**
 * Validate that a model ID is supported for a given provider
 */
export function isValidModel(
  provider: ModelProvider,
  modelId: string,
): boolean {
  return getModelsByProvider(provider).some((model) => model.id === modelId);
}
