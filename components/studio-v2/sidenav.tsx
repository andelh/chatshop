"use client";

import { BarChart2, Inbox, Settings, Store, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SidenavProps {
  onSignOut: () => void;
  isSigningOut?: boolean;
  userName?: string;
  userEmail?: string;
}

const navItems = [
  { id: "inbox", label: "Inbox", icon: Inbox, href: "/studio-v2" },
  { id: "stores", label: "Stores", icon: Store, href: "/shops" },
  { id: "automation", label: "Automation", icon: Zap, href: "#" },
  { id: "analytics", label: "Analytics", icon: BarChart2, href: "#" },
];

export function Sidenav({ onSignOut, isSigningOut, userName, userEmail }: SidenavProps) {
  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (userEmail?.[0] ?? "U").toUpperCase();

  const displayName = userName || userEmail?.split("@")[0] || "Account";

  return (
    <aside className="flex flex-col w-[190px] h-full bg-[#FAFAF9] border-r border-[#EDECEA] shrink-0">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 shrink-0">
        <span className="text-[#2B7F8F] font-bold text-xl tracking-tight select-none">
          clerkit
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2.5 flex flex-col gap-0.5 overflow-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === "inbox";
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-[#F0F0EE] font-semibold text-[#1A1A1A]"
                  : "font-medium text-[#888] hover:bg-[#F0F0EE] hover:text-[#1A1A1A]",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-[#1A1A1A]" : "text-[#AAA]",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Settings + User */}
      <div className="px-2.5 pb-4 pt-3 border-t border-[#EDECEA] flex flex-col gap-0.5 shrink-0">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#888] hover:bg-[#F0F0EE] hover:text-[#1A1A1A] transition-colors"
        >
          <Settings className="h-4 w-4 shrink-0 text-[#AAA]" />
          <span>Settings</span>
        </Link>

        <button
          type="button"
          onClick={onSignOut}
          disabled={isSigningOut}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-[#F0F0EE] disabled:opacity-50"
        >
          <div className="w-6 h-6 rounded-full bg-[#E0ECF0] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-[#2B7F8F] leading-none">
              {initials}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[#1A1A1A] font-semibold text-xs truncate">
              {displayName}
            </span>
            <span className="text-[#AAA] text-[11px]">Sign out</span>
          </div>
        </button>
      </div>
    </aside>
  );
}
