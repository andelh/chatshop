"use client";

import { useQuery } from "convex/react";
import { ChevronDown, Cpu, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import {
  AI_PROVIDERS,
  getModelById,
  getProviderById,
} from "@/lib/models/config";

export function ModelSelectorToolbar() {
  const settings = useQuery(api.settings.getSettings);

  if (!settings) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Cpu className="h-4 w-4 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  const currentProvider = getProviderById(
    settings.aiProvider as "openai" | "google",
  );
  const currentModel = getModelById(settings.aiModel);

  return (
    <div className="flex items-center gap-4">
      {/* Model Selector Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-2 text-muted-foreground hover:text-foreground"
          >
            <img
              src={`https://models.dev/logos/${currentProvider?.logo ?? "openai"}.svg`}
              alt={currentProvider?.name ?? "AI"}
              className="h-4 w-4 dark:invert"
            />
            <span className="hidden sm:inline text-xs">
              {currentModel?.name ?? settings.aiModel}
            </span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            AI Model
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Current Selection */}
          <div className="px-2 py-2 mb-2 bg-muted/50 rounded-md">
            <div className="flex items-center gap-2 text-sm">
              <img
                src={`https://models.dev/logos/${currentProvider?.logo ?? "openai"}.svg`}
                alt={currentProvider?.name ?? "AI"}
                className="h-4 w-4 dark:invert"
              />
              <span className="font-medium">
                {currentModel?.name ?? settings.aiModel}
              </span>
              {currentModel?.recommended && (
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Recommended
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {currentModel?.description}
            </p>
          </div>

          <DropdownMenuSeparator />

          {/* Quick Model Options */}
          {AI_PROVIDERS.map((provider) => (
            <div key={provider.id}>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {provider.name}
              </DropdownMenuLabel>
              {provider.models.slice(0, 3).map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  disabled={settings.aiModel === model.id}
                  className="text-xs"
                  asChild
                >
                  <Link href="/settings">
                    <span className="flex items-center gap-2 flex-1">
                      {model.name}
                      {model.recommended && (
                        <Sparkles className="h-3 w-3 text-primary" />
                      )}
                    </span>
                    {settings.aiModel === model.id && (
                      <span className="text-xs text-muted-foreground">
                        Active
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
          ))}

          <DropdownMenuSeparator />

          {/* Link to full settings */}
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2 text-xs">
              <Settings className="h-3 w-3" />
              Manage all settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
