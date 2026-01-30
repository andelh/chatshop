"use client";

import { Instagram, MessageCircle, Phone } from "lucide-react";

interface PlatformIconProps {
  platform: string;
  className?: string;
}

const platformConfig = {
  instagram: {
    icon: Instagram,
    color: "text-pink-500",
    bgColor: "bg-pink-50",
    label: "Instagram",
  },
  messenger: {
    icon: MessageCircle,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    label: "Messenger",
  },
  whatsapp: {
    icon: Phone,
    color: "text-green-500",
    bgColor: "bg-green-50",
    label: "WhatsApp",
  },
};

export function PlatformIcon({ platform, className = "" }: PlatformIconProps) {
  const normalizedPlatform =
    platform.toLowerCase() as keyof typeof platformConfig;
  const config = platformConfig[normalizedPlatform] || platformConfig.messenger;
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center justify-center w-8 h-8 rounded-full ${config.bgColor} ${className}`}
      title={config.label}
    >
      <Icon className={`w-4 h-4 ${config.color}`} />
    </div>
  );
}
