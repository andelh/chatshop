"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, ChevronLeft, Loader2, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import {
  AI_PROVIDERS,
  formatPrice,
  type ModelProvider,
} from "@/lib/models/config";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const settings = useQuery(api.settings.getSettings);
  const updateSettings = useMutation(api.settings.updateModelConfig);

  const [selectedProvider, setSelectedProvider] =
    useState<ModelProvider>("google");
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.0-flash");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const hasInitialized = useRef(false);

  // Initialize state from settings only once when they first load
  useEffect(() => {
    if (settings && !hasInitialized.current) {
      setSelectedProvider(settings.aiProvider as ModelProvider);
      setSelectedModel(settings.aiModel);
      hasInitialized.current = true;
    }
  }, [settings]);

  const currentProvider = AI_PROVIDERS.find((p) => p.id === selectedProvider);
  const currentModel = currentProvider?.models.find(
    (m) => m.id === selectedModel,
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateSettings({
        aiProvider: selectedProvider,
        aiModel: selectedModel,
        providerOptions: {
          openaiReasoningEffort: "medium",
          googleThinkingLevel: "high",
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleProviderChange = (providerId: ModelProvider) => {
    setSelectedProvider(providerId);
    // Select the recommended model for this provider, or the first one
    const providerConfig = AI_PROVIDERS.find((p) => p.id === providerId);
    const recommendedModel = providerConfig?.models.find((m) => m.recommended);
    const newModelId =
      recommendedModel?.id ?? providerConfig?.models[0]?.id ?? "";
    setSelectedModel(newModelId);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="flex items-center gap-4 px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/studio")}
            className="shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure global AI model preferences
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* AI Model Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Model Configuration
            </CardTitle>
            <CardDescription>
              Choose the AI model that powers your customer support assistant
              across all shops.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">AI Provider</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {AI_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleProviderChange(provider.id)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-all",
                      selectedProvider === provider.id
                        ? "border-primary bg-primary/5"
                        : "border-muted bg-popover hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <img
                      src={`https://models.dev/logos/${provider.logo}.svg`}
                      alt={provider.name}
                      className="h-6 w-6 dark:invert"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{provider.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {provider.models.length} models available
                      </div>
                    </div>
                    {selectedProvider === provider.id && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Model Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Model</Label>
              <Select value={selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {currentProvider?.models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                        {model.recommended && (
                          <Badge variant="secondary" className="text-xs">
                            Recommended
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Model Details */}
              {currentModel && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {currentModel.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Input:{" "}
                      <span className="font-medium text-foreground">
                        {formatPrice(currentModel.pricing.input)}
                      </span>
                      /M tokens
                    </span>
                    <span className="text-muted-foreground">
                      Output:{" "}
                      <span className="font-medium text-foreground">
                        {formatPrice(currentModel.pricing.output)}
                      </span>
                      /M tokens
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Current Selection Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Current Configuration</div>
              <div className="flex items-center gap-2 text-sm">
                <img
                  src={`https://models.dev/logos/${currentProvider?.logo}.svg`}
                  alt={currentProvider?.name}
                  className="h-4 w-4 dark:invert"
                />
                <span className="font-medium">{currentProvider?.name}</span>
                <span className="text-muted-foreground">→</span>
                <span>{currentModel?.name}</span>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
              {saveSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  Settings saved!
                </div>
              )}
              <Button onClick={handleSave} disabled={isSaving} size="lg">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50 border-none">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Note:</strong> Changes to the AI model will take effect
                immediately for all new conversations. Existing conversations
                will continue with their previously configured model.
              </p>
              <p>
                Model pricing is shown per 1 million tokens. Actual costs will
                vary based on conversation length and complexity.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
