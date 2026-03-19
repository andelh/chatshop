import { type GoogleGenerativeAIProviderOptions, google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { ModelProvider } from "../../lib/models/config";

/**
 * Factory function to create a model instance based on provider and model ID
 */
export function createModel(
  provider: ModelProvider,
  modelId: string,
): LanguageModel {
  switch (provider) {
    case "openai":
      return openai(modelId);
    case "google":
      return google(modelId);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Get provider-specific options for the AI SDK
 */
export function getProviderOptions(
  provider: ModelProvider,
  reasoningEffort: "low" | "medium" | "high" = "medium",
  thinkingLevel: "low" | "medium" | "high" = "high",
): Record<string, any> {
  return {
    openai: {
      reasoningEffort: reasoningEffort,
      reasoningSummary: "auto",
    },
    google: {
      thinkingConfig: {
        thinkingLevel: thinkingLevel,
        includeThoughts: true,
      },
    } satisfies GoogleGenerativeAIProviderOptions,
  };
}

/**
 * Validate that a model ID is supported for a given provider
 */
export function isValidModel(
  provider: ModelProvider,
  modelId: string,
): boolean {
  const validModels: Record<ModelProvider, string[]> = {
    openai: [
      "gpt-5.4-mini",
      "gpt-5.4",
      "gpt-5.2",
      "gpt-5.1",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "gpt-4o-mini",
      "o3-mini",
      "o4-mini",
    ],
    google: [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-2.5-pro-exp-03-25",
    ],
  };

  return validModels[provider]?.includes(modelId) ?? false;
}
