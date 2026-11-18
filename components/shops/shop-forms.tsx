"use client";

import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  type BusinessHours,
  type DayHours,
  WEEKDAYS,
  type Weekday,
} from "@/convex/lib/businessHours";
import { cn } from "@/lib/utils";

export type AgentProfile = {
  storeName: string;
  assistantName: string;
  persona?: string;
  policies?: string;
};

function errorText(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  return "Something went wrong. Please try again.";
}

type Submission = {
  error: string | null;
  saving: boolean;
  saved: boolean;
  /** Clear "Saved" after the draft changes. */
  markDirty: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
};

/** Saving/error/saved state shared by the forms below. */
function useSubmission(save: () => Promise<void>): Submission {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await save();
      setSaved(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return {
    error,
    saving,
    saved,
    markDirty: () => setSaved(false),
    handleSubmit,
  };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-widest text-[#BBB]">
      {children}
    </span>
  );
}

const inputClass =
  "w-full rounded-lg border border-[#E2E1DE] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] placeholder:text-[#BBB] focus:border-[#2B7F8F] focus:outline-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed as children
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[#1A1A1A]">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-[#AAA]">{hint}</span>}
    </label>
  );
}

function FormFooter({
  error,
  saving,
  label,
  saved,
}: {
  error: string | null;
  saving: boolean;
  label: string;
  saved?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-[#1A1A1A] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : label}
      </button>
      {error && (
        <span role="alert" className="text-[12px] text-[#E03131]">
          {error}
        </span>
      )}
      {saved && !error && (
        <span className="text-[12px] text-emerald-600">Saved</span>
      )}
    </div>
  );
}

function ProfileFields({
  profile,
  onChange,
}: {
  profile: AgentProfile;
  onChange: (profile: AgentProfile) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Store name">
          <input
            className={inputClass}
            value={profile.storeName}
            onChange={(e) =>
              onChange({ ...profile, storeName: e.target.value })
            }
            placeholder="Acme Outdoors"
            required
          />
        </Field>
        <Field label="Assistant name">
          <input
            className={inputClass}
            value={profile.assistantName}
            onChange={(e) =>
              onChange({ ...profile, assistantName: e.target.value })
            }
            placeholder="Sam"
            required
          />
        </Field>
      </div>
      <Field label="Voice" hint="Optional. How the assistant should sound.">
        <input
          className={inputClass}
          value={profile.persona ?? ""}
          onChange={(e) => onChange({ ...profile, persona: e.target.value })}
          placeholder="Friendly and direct, a little playful"
        />
      </Field>
      <Field
        label="Store information"
        hint="Website, address, opening hours, delivery, returns, warranty and FAQs. The assistant only quotes what's here and hands off anything else."
      >
        <textarea
          className={cn(inputClass, "min-h-[140px] resize-y")}
          value={profile.policies ?? ""}
          onChange={(e) => onChange({ ...profile, policies: e.target.value })}
          placeholder={
            "Website: https://acme.example\nDelivery: island-wide, 2-3 days\nReturns: 14 days, unopened"
          }
        />
      </Field>
    </>
  );
}

const EMPTY_PROFILE: AgentProfile = { storeName: "", assistantName: "" };

/** Add a shop with manually entered credentials; the creator becomes owner. */
export function CreateShopForm({
  onCreated,
  onCancel,
}: {
  onCreated: (shopId: Id<"shops">) => void;
  onCancel: () => void;
}) {
  const create = useMutation(api.shops.create);
  const [profile, setProfile] = useState<AgentProfile>(EMPTY_PROFILE);
  const [credentials, setCredentials] = useState({
    shopifyDomain: "",
    shopifyAccessToken: "",
    metaPageId: "",
    metaPageAccessToken: "",
    instagramAccountId: "",
  });
  const { error, saving, handleSubmit } = useSubmission(async () => {
    const shopId = await create({
      profile,
      ...credentials,
      instagramAccountId: credentials.instagramAccountId || undefined,
    });
    onCreated(shopId);
  });

  function set(key: keyof typeof credentials) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setCredentials({ ...credentials, [key]: e.target.value });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-1 overflow-y-auto px-6 py-7 flex flex-col gap-5 max-w-[560px]"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-[#1A1A1A]">Add a shop</h2>
          <p className="text-[12px] text-[#888] mt-1">
            You'll be its owner. Credentials stay on the server and are never
            shown again.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-[12px] font-medium text-[#888] hover:text-[#1A1A1A]"
        >
          Cancel
        </button>
      </div>

      <SectionLabel>Assistant</SectionLabel>
      <ProfileFields profile={profile} onChange={setProfile} />

      <SectionLabel>Shopify</SectionLabel>
      <Field
        label="Storefront API URL"
        hint="https://<store>.myshopify.com/api/<version>/graphql.json"
      >
        <input
          className={inputClass}
          value={credentials.shopifyDomain}
          onChange={set("shopifyDomain")}
          placeholder="https://acme.myshopify.com/api/2025-01/graphql.json"
          required
        />
      </Field>
      <Field
        label="Storefront access token"
        hint="From a Headless or custom app with Storefront API access."
      >
        <input
          className={inputClass}
          type="password"
          autoComplete="off"
          value={credentials.shopifyAccessToken}
          onChange={set("shopifyAccessToken")}
          required
        />
      </Field>

      <SectionLabel>Meta</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Facebook Page ID">
          <input
            className={inputClass}
            value={credentials.metaPageId}
            onChange={set("metaPageId")}
            required
          />
        </Field>
        <Field label="Instagram account ID" hint="Optional.">
          <input
            className={inputClass}
            value={credentials.instagramAccountId}
            onChange={set("instagramAccountId")}
          />
        </Field>
      </div>
      <Field
        label="Page access token"
        hint="A long-lived Page token with pages_messaging (and instagram_manage_messages for Instagram)."
      >
        <input
          className={inputClass}
          type="password"
          autoComplete="off"
          value={credentials.metaPageAccessToken}
          onChange={set("metaPageAccessToken")}
          required
        />
      </Field>

      <FormFooter error={error} saving={saving} label="Create shop" />
    </form>
  );
}

/** Edit who the assistant is for a shop. Owners only. */
export function AssistantProfileForm({
  shopId,
  profile,
}: {
  shopId: Id<"shops">;
  profile: AgentProfile | undefined;
}) {
  const update = useMutation(api.shops.updateAgentProfile);
  const [draft, setDraft] = useState<AgentProfile>(profile ?? EMPTY_PROFILE);
  const { error, saving, saved, markDirty, handleSubmit } = useSubmission(
    async () => {
      await update({ shopId, profile: draft });
    },
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!profile && (
        <p className="text-[12px] text-[#888] rounded-lg bg-[#FAFAF9] border border-[#EDECEA] px-3.5 py-2.5">
          This shop still uses the original built-in prompt. Saving a profile
          switches it to one built from these fields.
        </p>
      )}
      <ProfileFields
        profile={draft}
        onChange={(next) => {
          setDraft(next);
          markDirty();
        }}
      />
      <FormFooter
        error={error}
        saving={saving}
        saved={saved}
        label="Save assistant"
      />
    </form>
  );
}

const DAY_LABELS: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function defaultHours(): BusinessHours {
  const weekday: DayHours = { open: "09:00", close: "17:00" };
  return {
    timezone: browserTimeZone(),
    days: {
      mon: weekday,
      tue: weekday,
      wed: weekday,
      thu: weekday,
      fri: weekday,
    },
  };
}

/** When the AI may reply. Unset means any time. */
export function BusinessHoursForm({
  shopId,
  hours,
}: {
  shopId: Id<"shops">;
  hours: BusinessHours | undefined;
}) {
  const update = useMutation(api.shops.updateShopSettings);
  const [enabled, setEnabled] = useState(Boolean(hours));
  const [draft, setDraft] = useState<BusinessHours>(hours ?? defaultHours());
  const { error, saving, saved, markDirty, handleSubmit } = useSubmission(
    async () => {
      await update({ shopId, businessHours: enabled ? draft : null });
    },
  );

  function setDay(day: Weekday, value: DayHours | undefined): void {
    setDraft({ ...draft, days: { ...draft.days, [day]: value } });
    markDirty();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-0.5 accent-[#2B7F8F]"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            markDirty();
          }}
        />
        <span>
          <span className="block text-[13px] font-semibold text-[#1A1A1A]">
            Only reply during business hours
          </span>
          <span className="block text-[12px] text-[#AAA] mt-0.5">
            Outside these hours, messages wait in the inbox for your team. When
            off, the AI replies at any time.
          </span>
        </span>
      </label>

      {enabled && (
        <>
          <Field label="Time zone" hint="IANA name, e.g. America/Port_of_Spain">
            <input
              className={inputClass}
              value={draft.timezone}
              onChange={(e) => {
                setDraft({ ...draft, timezone: e.target.value });
                markDirty();
              }}
              required
            />
          </Field>
          <div className="flex flex-col gap-2">
            {WEEKDAYS.map((day) => {
              const value = draft.days[day];
              return (
                <div key={day} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-[72px] text-[13px] text-[#1A1A1A]">
                    <input
                      type="checkbox"
                      className="accent-[#2B7F8F]"
                      checked={Boolean(value)}
                      onChange={(e) =>
                        setDay(
                          day,
                          e.target.checked
                            ? { open: "09:00", close: "17:00" }
                            : undefined,
                        )
                      }
                    />
                    {DAY_LABELS[day]}
                  </label>
                  {value ? (
                    <>
                      <input
                        type="time"
                        aria-label={`${DAY_LABELS[day]} opens`}
                        className={cn(inputClass, "w-[110px]")}
                        value={value.open}
                        onChange={(e) =>
                          setDay(day, { ...value, open: e.target.value })
                        }
                        required
                      />
                      <span className="text-[12px] text-[#AAA]">to</span>
                      <input
                        type="time"
                        aria-label={`${DAY_LABELS[day]} closes`}
                        className={cn(inputClass, "w-[110px]")}
                        value={value.close}
                        onChange={(e) =>
                          setDay(day, { ...value, close: e.target.value })
                        }
                        required
                      />
                    </>
                  ) : (
                    <span className="text-[12px] text-[#AAA]">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <FormFooter
        error={error}
        saving={saving}
        saved={saved}
        label="Save hours"
      />
    </form>
  );
}
