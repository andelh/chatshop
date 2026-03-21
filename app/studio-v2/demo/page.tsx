"use client";

/**
 * Static demo page — no Convex, no auth required.
 * Shows the studio-v2 layout with hardcoded mock data.
 */

import { useState } from "react";
import {
  BarChart2,
  Bot,
  Check,
  Instagram,
  MessageCircle,
  MessageSquare,
  Pause,
  Phone,
  Play,
  Search,
  Settings,
  Store,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Mock data ───────────────────────────────────────────────────────────────

const DEMO_SHOP_ID = "j971661b007fktwgrkh3zxd3p9804eej";

const THREADS = [
  {
    id: "t1",
    customerName: "Sarah K.",
    platform: "instagram",
    lastMessageAt: Date.now() - 1000 * 60 * 12,
    unreadCount: 2,
    agentStatus: "active",
    messages: [
      {
        id: "m1",
        role: "user",
        content:
          "Hi, I placed an order 5 days ago and still haven't received a tracking number. My order number is #4821.",
        timestamp: Date.now() - 1000 * 60 * 14,
      },
      {
        id: "m2",
        role: "user",
        content:
          "I've been waiting for a while and I'm starting to get worried. This was a birthday gift and the event is coming up soon.",
        timestamp: Date.now() - 1000 * 60 * 12,
      },
    ],
  },
  {
    id: "t2",
    customerName: "Marcus T.",
    platform: "messenger",
    lastMessageAt: Date.now() - 1000 * 60 * 38,
    unreadCount: 1,
    agentStatus: "active",
    messages: [
      {
        id: "m3",
        role: "user",
        content:
          "I ordered the black version but received the grey one. Can you help me exchange it?",
        timestamp: Date.now() - 1000 * 60 * 38,
      },
    ],
  },
  {
    id: "t3",
    customerName: "Priya M.",
    platform: "whatsapp",
    lastMessageAt: Date.now() - 1000 * 60 * 60 * 18,
    unreadCount: 0,
    agentStatus: "paused",
    messages: [
      {
        id: "m4",
        role: "user",
        content:
          "Hi, I'd like to return a dress I purchased last week. It doesn't fit properly and the zipper feels loose.",
        timestamp: Date.now() - 1000 * 60 * 60 * 18,
      },
      {
        id: "m5",
        role: "assistant",
        content:
          "Hi Priya! I'm sorry to hear that. I can help you initiate a return. Could you please confirm your order number so I can pull up the details?",
        timestamp: Date.now() - 1000 * 60 * 60 * 17,
      },
    ],
  },
  {
    id: "t4",
    customerName: "James W.",
    platform: "instagram",
    lastMessageAt: Date.now() - 1000 * 60 * 60 * 26,
    unreadCount: 0,
    agentStatus: "active",
    messages: [
      {
        id: "m6",
        role: "user",
        content:
          "I tried using the code SAVE20 at checkout but it keeps saying invalid. Can you help?",
        timestamp: Date.now() - 1000 * 60 * 60 * 26,
      },
    ],
  },
  {
    id: "t5",
    customerName: "Leila N.",
    platform: "whatsapp",
    lastMessageAt: Date.now() - 1000 * 60 * 60 * 72,
    unreadCount: 0,
    agentStatus: "handoff",
    messages: [
      {
        id: "m7",
        role: "user",
        content:
          "It's been 10 days since I submitted my refund request. Any update on this?",
        timestamp: Date.now() - 1000 * 60 * 60 * 72,
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Now";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d === 1) return "Yesterday";
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const platformConfig = {
  instagram: { label: "Instagram", color: "#E1306C", bg: "#FEF0F5", Icon: Instagram },
  messenger: { label: "Messenger", color: "#0099FF", bg: "#EFF7FF", Icon: MessageCircle },
  whatsapp:  { label: "WhatsApp",  color: "#25D366", bg: "#F0FBF4", Icon: Phone },
} as const;

function PlatformPill({ platform }: { platform: string }) {
  const cfg = platformConfig[platform as keyof typeof platformConfig] ?? platformConfig.messenger;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

function CustomerAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const palette = [
    { bg: "#F0ECF8", text: "#7C55C8" },
    { bg: "#EFF7FF", text: "#0099FF" },
    { bg: "#FEF0F5", text: "#E1306C" },
    { bg: "#F0FBF4", text: "#25D366" },
    { bg: "#FFF7ED", text: "#EA7C1E" },
  ];
  const color = palette[name.charCodeAt(0) % palette.length];
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : "w-8 h-8 text-[11px]";
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center shrink-0 font-bold leading-none`}
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {initials}
    </div>
  );
}

// ─── Sidenav ─────────────────────────────────────────────────────────────────

function Sidenav() {
  const items = [
    { label: "Inbox",      Icon: MessageSquare, active: true },
    { label: "Stores",     Icon: Store,         active: false },
    { label: "Automation", Icon: Zap,           active: false },
    { label: "Analytics",  Icon: BarChart2,     active: false },
  ];
  return (
    <aside className="flex flex-col w-[190px] h-full bg-[#FAFAF9] border-r border-[#EDECEA] shrink-0">
      <div className="px-5 pt-6 pb-5 shrink-0">
        <span className="text-[#2B7F8F] font-bold text-xl tracking-tight">clerkit</span>
      </div>
      <nav className="flex-1 px-2.5 flex flex-col gap-0.5 overflow-hidden">
        {items.map(({ label, Icon, active }) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors",
              active
                ? "bg-[#F0F0EE] font-semibold text-[#1A1A1A]"
                : "font-medium text-[#888] hover:bg-[#F0F0EE] hover:text-[#1A1A1A]",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#1A1A1A]" : "text-[#CCC]")} />
            {label}
          </div>
        ))}
      </nav>
      <div className="px-2.5 pb-4 pt-3 border-t border-[#EDECEA] flex flex-col gap-0.5 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#888] hover:bg-[#F0F0EE] cursor-pointer transition-colors">
          <Settings className="h-4 w-4 shrink-0 text-[#CCC]" />
          Settings
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#F0F0EE] transition-colors">
          <div className="w-6 h-6 rounded-full bg-[#E0ECF0] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-[#2B7F8F] leading-none">AH</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[#1A1A1A] font-semibold text-xs truncate">Andel H.</span>
            <span className="text-[#AAA] text-[11px]">Admin</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Thread list ──────────────────────────────────────────────────────────────

type FilterTab = "all" | "unread" | "paused";

function ThreadList({
  threads,
  selectedId,
  onSelect,
}: {
  threads: typeof THREADS;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = threads.filter((t) => {
    if (filter === "unread") return t.unreadCount > 0;
    if (filter === "paused") return t.agentStatus === "paused" || t.agentStatus === "handoff";
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex items-center gap-1 px-4 pt-5 pb-3 shrink-0">
        {(["all", "unread", "paused"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[12px] font-medium capitalize transition-colors",
              filter === tab
                ? "bg-[#1A1A1A] text-white"
                : "text-[#888] hover:bg-[#F0F0EE] hover:text-[#1A1A1A]",
            )}
          >
            {tab}
          </button>
        ))}
        <button type="button" className="ml-auto p-1.5 text-[#BBB] hover:text-[#555] transition-colors">
          <Search className="h-[15px] w-[15px]" />
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((t, i) => (
          <div key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              className={cn(
                "w-full text-left px-5 py-4 flex flex-col gap-1.5 transition-colors border-l-2 border-transparent focus:outline-none hover:bg-[#F7F7F5]",
                selectedId === t.id && "bg-[#F5F5F3] border-l-[#1A1A1A]",
                t.agentStatus === "paused" && selectedId !== t.id && "bg-amber-50/40",
                t.agentStatus === "handoff" && selectedId !== t.id && "bg-red-50/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-[15px] truncate", t.unreadCount > 0 ? "font-bold text-[#1A1A1A]" : "font-semibold text-[#1A1A1A]")}>
                  {t.customerName}
                </span>
                <span className="text-[12px] text-[#AAA] whitespace-nowrap shrink-0">
                  {formatRelativeTime(t.lastMessageAt)}
                </span>
              </div>
              <span className={cn("text-[13px] truncate", t.unreadCount > 0 ? "font-semibold text-[#1A1A1A]" : "font-medium text-[#666]")}>
                {t.unreadCount > 0
                  ? `${t.unreadCount} new message${t.unreadCount > 1 ? "s" : ""}`
                  : t.agentStatus === "handoff"
                  ? "Handoff requested"
                  : t.agentStatus === "paused"
                  ? "AI paused · Human responding"
                  : "View conversation"}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <PlatformPill platform={t.platform} />
                {t.agentStatus === "paused" && (
                  <span className="text-[11px] text-amber-600 font-medium">· AI paused</span>
                )}
                {t.agentStatus === "handoff" && (
                  <span className="text-[11px] text-red-500 font-medium">· Handoff</span>
                )}
              </div>
            </button>
            {i < filtered.length - 1 && <div className="h-px bg-[#F0EFED]" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Thread view ─────────────────────────────────────────────────────────────

function ThreadView({ thread }: { thread: (typeof THREADS)[number] }) {
  const [isPaused, setIsPaused] = useState(
    thread.agentStatus === "paused" || thread.agentStatus === "handoff",
  );
  const [replyValue, setReplyValue] = useState("");
  const [messages, setMessages] = useState(thread.messages);

  const handleSend = () => {
    if (!replyValue.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, role: "human_agent", content: replyValue.trim(), timestamp: Date.now() },
    ]);
    setReplyValue("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-[#EDECEA] shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <CustomerAvatar name={thread.customerName} />
          <span className="text-[14px] font-semibold text-[#1A1A1A] truncate">
            {thread.customerName}
          </span>
          {thread.unreadCount > 0 && (
            <span className="text-[11px] font-bold bg-[#1A1A1A] text-white px-1.5 py-0.5 rounded-full shrink-0">
              {thread.unreadCount}
            </span>
          )}
          <PlatformPill platform={thread.platform} />
          {isPaused && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              AI paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="h-8 px-3 flex items-center gap-1.5 text-[12px] border border-[#E8E8E6] rounded-lg text-[#555] hover:border-[#1A1A1A] hover:text-[#1A1A1A] transition-colors"
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {isPaused ? "Resume AI" : "Pause AI"}
          </button>
          <button
            type="button"
            className="h-8 px-3 flex items-center gap-1.5 text-[12px] bg-[#1A1A1A] text-white rounded-lg hover:bg-[#333] transition-colors"
          >
            <Check className="h-3 w-3" />
            Resolve
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-12 py-8 flex flex-col gap-6">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isAgent = msg.role === "human_agent";
          const isAI = msg.role === "assistant";
          return (
            <div key={msg.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                    isUser ? "bg-[#F0ECF8]" : isAgent ? "bg-green-100" : "bg-[#F5F5F3]",
                  )}
                >
                  {isUser ? (
                    <User className="h-3.5 w-3.5 text-[#7C55C8]" />
                  ) : isAgent ? (
                    <User className="h-3.5 w-3.5 text-green-700" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-[#555]" />
                  )}
                </div>
                <span className="text-[13px] font-semibold text-[#1A1A1A]">
                  {isUser ? thread.customerName : isAgent ? "Human Agent" : "Maya AI"}
                </span>
                <span className="text-[12px] text-[#BBB]">
                  {formatRelativeTime(msg.timestamp)}
                </span>
              </div>
              <p className="text-[15px] text-[#1A1A1A] leading-[26px] pl-[38px]">
                {msg.content}
              </p>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <div className="mx-6 mb-5 border border-[#EDECEA] rounded-xl overflow-hidden shrink-0">
        <textarea
          value={replyValue}
          onChange={(e) => setReplyValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Reply to ${thread.customerName}...`}
          rows={3}
          className="w-full px-4 pt-3 pb-2 text-[14px] text-[#1A1A1A] placeholder:text-[#BBB] resize-none focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-[#F3F2F0]">
          <span className="text-[12px] text-[#BBB]">Enter to send · Shift+Enter for newline</span>
          <button
            type="button"
            onClick={handleSend}
            disabled={!replyValue.trim()}
            className="h-8 px-4 flex items-center gap-1.5 text-[12px] font-medium bg-[#1A1A1A] text-white rounded-lg hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
            <MessageCircle className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudioV2DemoPage() {
  const [selectedId, setSelectedId] = useState(THREADS[0].id);
  const selectedThread = THREADS.find((t) => t.id === selectedId) ?? THREADS[0];

  return (
    <div className="h-screen bg-[#E8E7E4] p-5 overflow-hidden">
      <div className="h-full bg-white rounded-2xl flex flex-row overflow-hidden shadow-sm">
        <Sidenav />
        <div className="w-[340px] h-full border-r border-[#EDECEA] shrink-0">
          <ThreadList threads={THREADS} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <main className="flex-1 min-w-0 h-full overflow-hidden">
          <ThreadView key={selectedId} thread={selectedThread} />
        </main>
      </div>
    </div>
  );
}
