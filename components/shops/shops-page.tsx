"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Shop = {
  _id: Id<"shops">;
  shopifyDomain: string;
  metaPageId: string;
  instagramAccountId?: string;
  settings: {
    autoReplyEnabled: boolean;
    agentPaused?: boolean;
    agentPausedAt?: number;
    agentPausedReason?: string;
    businessHours?: unknown;
  };
  role: "owner" | "member";
  membershipId: Id<"shopMembers">;
};

function ShopRow({
  shop,
  isSelected,
  onClick,
}: {
  shop: Shop;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isPaused = shop.settings.agentPaused ?? false;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 rounded-xl transition-colors group",
        isSelected
          ? "bg-[#F0F0EE]"
          : "hover:bg-[#F8F7F5]",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div
          className={cn(
            "w-2 h-2 rounded-full shrink-0 mt-0.5",
            isPaused ? "bg-amber-400" : "bg-emerald-400",
          )}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[#1A1A1A] truncate">
              {shop.shopifyDomain}
            </span>
            {shop.role === "owner" && (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[#2B7F8F] bg-[#E8F4F6] px-1.5 py-0.5 rounded">
                Owner
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                "text-[11px]",
                isPaused ? "text-amber-600" : "text-emerald-600",
              )}
            >
              {isPaused ? "Agent paused" : "Agent active"}
            </span>
            <span className="text-[#DDD]">·</span>
            <span className="text-[11px] text-[#AAA]">
              {shop.instagramAccountId ? "3 channels" : "2 channels"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none disabled:opacity-40",
        checked ? "bg-[#2B7F8F]" : "bg-[#DDD]",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-[#F0F0EE] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#1A1A1A]">{label}</div>
        {description && (
          <div className="text-[12px] text-[#AAA] mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-6 pt-6 pb-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#BBB]">
        {title}
      </span>
    </div>
  );
}

function ShopSettings({ shop }: { shop: Shop }) {
  const pauseAgent = useMutation(api.shops.pauseShopAgent);
  const resumeAgent = useMutation(api.shops.resumeShopAgent);
  const updateSettings = useMutation(api.shops.updateShopSettings);
  const members = useQuery(
    api.shopMembers.listByShop,
    shop.role === "owner" ? { shopId: shop._id } : "skip",
  );

  const [togglingAgent, setTogglingAgent] = useState(false);
  const [togglingReply, setTogglingReply] = useState(false);

  const isPaused = shop.settings.agentPaused ?? false;
  const autoReply = shop.settings.autoReplyEnabled;

  const handleAgentToggle = async () => {
    setTogglingAgent(true);
    try {
      if (isPaused) {
        await resumeAgent({ shopId: shop._id });
      } else {
        await pauseAgent({ shopId: shop._id });
      }
    } finally {
      setTogglingAgent(false);
    }
  };

  const handleAutoReplyToggle = async (value: boolean) => {
    setTogglingReply(true);
    try {
      await updateSettings({ shopId: shop._id, autoReplyEnabled: value });
    } finally {
      setTogglingReply(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Shop header */}
      <div className="px-6 pt-7 pb-5 border-b border-[#F0F0EE]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E8F4F6] flex items-center justify-center shrink-0">
            <span className="text-[#2B7F8F] font-bold text-sm">
              {shop.shopifyDomain[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">
              {shop.shopifyDomain}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isPaused ? "bg-amber-400" : "bg-emerald-400",
                )}
              />
              <span className="text-[12px] text-[#888]">
                {isPaused ? "Agent paused" : "Agent active"} ·{" "}
                {shop.role === "owner" ? "Owner" : "Member"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Channels */}
      <SectionHeader title="Connected Channels" />
      <div className="px-6 pb-2">
        <div className="flex flex-col gap-2">
          <ChannelBadge name="Shopify" detail={shop.shopifyDomain} active />
          <ChannelBadge
            name="Facebook Messenger"
            detail={`Page ${shop.metaPageId}`}
            active
          />
          {shop.instagramAccountId && (
            <ChannelBadge
              name="Instagram"
              detail={`Account ${shop.instagramAccountId}`}
              active
            />
          )}
        </div>
      </div>

      {/* Agent settings */}
      <SectionHeader title="Agent" />
      <div className="px-6">
        <SettingRow
          label="AI Agent"
          description={
            isPaused
              ? "Agent is paused — no automatic replies are sent"
              : "Agent is active and responding to all conversations"
          }
        >
          <Toggle
            checked={!isPaused}
            onChange={handleAgentToggle}
            disabled={togglingAgent}
          />
        </SettingRow>
        <SettingRow
          label="Auto-reply"
          description="Automatically respond when new messages arrive"
        >
          <Toggle
            checked={autoReply}
            onChange={handleAutoReplyToggle}
            disabled={togglingReply}
          />
        </SettingRow>
      </div>

      {/* Credentials */}
      <SectionHeader title="Credentials" />
      <div className="px-6 pb-2">
        <div className="flex flex-col gap-2">
          <CredentialRow label="Shopify domain" value={shop.shopifyDomain} />
          <CredentialRow label="Shopify access token" value="••••••••••••••••" />
          <CredentialRow label="Meta Page ID" value={shop.metaPageId} />
          <CredentialRow label="Meta access token" value="••••••••••••••••" />
          {shop.instagramAccountId && (
            <CredentialRow
              label="Instagram Account ID"
              value={shop.instagramAccountId}
            />
          )}
        </div>
      </div>

      {/* Members (owners only) */}
      {shop.role === "owner" && (
        <>
          <SectionHeader title="Team" />
          <div className="px-6 pb-6">
            {members === undefined ? (
              <div className="text-[12px] text-[#AAA]">Loading...</div>
            ) : (
              <div className="flex flex-col gap-1">
                {members.map((m) => (
                  <div
                    key={m._id}
                    className="flex items-center justify-between py-2.5 border-b border-[#F0F0EE] last:border-0"
                  >
                    <span className="text-[13px] text-[#555] font-mono">
                      {m.userId.slice(0, 16)}…
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        m.role === "owner"
                          ? "text-[#2B7F8F] bg-[#E8F4F6]"
                          : "text-[#888] bg-[#F0F0EE]",
                      )}
                    >
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ChannelBadge({
  name,
  detail,
  active,
}: {
  name: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#FAFAF9] border border-[#EDECEA]">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            active ? "bg-emerald-400" : "bg-[#DDD]",
          )}
        />
        <span className="text-[13px] font-medium text-[#1A1A1A]">{name}</span>
      </div>
      <span className="text-[11px] text-[#AAA] font-mono truncate max-w-[140px]">
        {detail}
      </span>
    </div>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#FAFAF9] border border-[#EDECEA]">
      <span className="text-[12px] text-[#888]">{label}</span>
      <span className="text-[12px] font-mono text-[#555] truncate max-w-[180px]">
        {value}
      </span>
    </div>
  );
}

export function ShopsPageClient() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [isSigningOut, startSignOutTransition] = useTransition();

  const shops = useQuery(
    api.shopMembers.listUserShops,
    sessionPending ? "skip" : undefined,
  ) as Shop[] | undefined;

  const [selectedId, setSelectedId] = useState<Id<"shops"> | null>(null);

  const selectedShop =
    shops?.find((s) => s._id === selectedId) ?? shops?.[0] ?? null;

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      await authClient.signOut();
      router.push("/auth");
      router.refresh();
    });
  };

  return (
    <div className="h-screen bg-[#E8E7E4] p-5 overflow-hidden">
      <div className="h-full bg-white rounded-2xl flex flex-row overflow-hidden shadow-sm">
        {/* ── Sidenav ── */}
        <aside className="flex flex-col w-[190px] h-full bg-[#FAFAF9] border-r border-[#EDECEA] shrink-0">
          <div className="px-5 pt-6 pb-5 shrink-0">
            <span className="text-[#2B7F8F] font-bold text-xl tracking-tight select-none">
              clerkit
            </span>
          </div>

          <nav className="flex-1 px-2.5 flex flex-col gap-0.5 overflow-hidden">
            <Link
              href="/studio-v2"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#888] hover:bg-[#F0F0EE] hover:text-[#1A1A1A] transition-colors"
            >
              <InboxIcon />
              <span className="truncate">Inbox</span>
            </Link>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-[#F0F0EE] font-semibold text-[#1A1A1A]">
              <StoreIcon />
              <span className="truncate">Stores</span>
            </div>
            <span className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#CCC] cursor-not-allowed">
              <ZapIcon />
              <span className="truncate">Automation</span>
            </span>
            <span className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#CCC] cursor-not-allowed">
              <ChartIcon />
              <span className="truncate">Analytics</span>
            </span>
          </nav>

          <div className="px-2.5 pb-4 pt-3 border-t border-[#EDECEA] flex flex-col gap-0.5 shrink-0">
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#888] hover:bg-[#F0F0EE] hover:text-[#1A1A1A] transition-colors"
            >
              <SettingsIcon />
              <span>Settings</span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-[#F0F0EE] disabled:opacity-50"
            >
              <div className="w-6 h-6 rounded-full bg-[#E0ECF0] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[#2B7F8F] leading-none">
                  {(session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? "U").toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[#1A1A1A] font-semibold text-xs truncate">
                  {session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Account"}
                </span>
                <span className="text-[#AAA] text-[11px]">Sign out</span>
              </div>
            </button>
          </div>
        </aside>

        {/* ── Shop list ── */}
        <div className="w-[260px] h-full border-r border-[#EDECEA] flex flex-col shrink-0">
          <div className="px-5 pt-6 pb-4 border-b border-[#F0F0EE] shrink-0">
            <h1 className="text-[15px] font-bold text-[#1A1A1A]">Shops</h1>
            <p className="text-[12px] text-[#AAA] mt-0.5">
              {shops ? `${shops.length} ${shops.length === 1 ? "shop" : "shops"}` : "Loading..."}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {shops === undefined ? (
              <div className="flex items-center justify-center h-24">
                <div className="w-5 h-5 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : shops.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-[#AAA]">No shops yet</p>
                <p className="text-[12px] text-[#CCC] mt-1">
                  Ask an owner to invite you
                </p>
              </div>
            ) : (
              shops.map((shop) => (
                <ShopRow
                  key={shop._id}
                  shop={shop}
                  isSelected={
                    selectedShop ? shop._id === selectedShop._id : false
                  }
                  onClick={() => setSelectedId(shop._id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Settings panel ── */}
        <main className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
          {selectedShop ? (
            <ShopSettings shop={selectedShop} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-[#CCC]">Select a shop</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Inline icon components to avoid import bloat ──
function InboxIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[#AAA]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
    </svg>
  );
}
function StoreIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
    </svg>
  );
}
function ZapIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[#DDD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[#DDD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[#AAA]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
