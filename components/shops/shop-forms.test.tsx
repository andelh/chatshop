// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AssistantProfileForm,
  BusinessHoursForm,
  CreateShopForm,
} from "./shop-forms";

// Rendering only; no Convex client.
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));

const shopId = "shop_1" as Id<"shops">;

function inputs(html: string): string[] {
  return html.match(/<input[^>]*>/g) ?? [];
}

describe("CreateShopForm", () => {
  it("asks for the profile and every required credential", () => {
    const html = renderToStaticMarkup(
      <CreateShopForm onCreated={() => {}} onCancel={() => {}} />,
    );
    for (const label of [
      "Store name",
      "Assistant name",
      "Storefront API URL",
      "Storefront access token",
      "Facebook Page ID",
      "Instagram account ID",
      "Page access token",
    ]) {
      expect(html).toContain(label);
    }
    // Tokens are masked; the Instagram ID is optional.
    expect(
      inputs(html).filter((i) => i.includes('type="password"')),
    ).toHaveLength(2);
    expect(inputs(html).filter((i) => i.includes("required"))).toHaveLength(6);
    expect(html).toContain("Create shop");
  });
});

describe("AssistantProfileForm", () => {
  it("explains that a shop without a profile uses the built-in prompt", () => {
    const html = renderToStaticMarkup(
      <AssistantProfileForm shopId={shopId} profile={undefined} />,
    );
    expect(html).toContain("still uses the original built-in prompt");
  });

  it("starts from the saved profile", () => {
    const html = renderToStaticMarkup(
      <AssistantProfileForm
        shopId={shopId}
        profile={{
          storeName: "Acme Outdoors",
          assistantName: "Sam",
          policies: "Returns: 14 days",
        }}
      />,
    );
    expect(html).not.toContain("built-in prompt");
    expect(html).toContain('value="Acme Outdoors"');
    expect(html).toContain('value="Sam"');
    expect(html).toContain("Returns: 14 days");
  });
});

describe("BusinessHoursForm", () => {
  it("is off with no day rows when the shop has no hours", () => {
    const html = renderToStaticMarkup(
      <BusinessHoursForm shopId={shopId} hours={undefined} />,
    );
    expect(html).toContain("Only reply during business hours");
    expect(inputs(html)[0]).not.toContain("checked");
    expect(html).not.toContain('type="time"');
  });

  it("shows saved hours, with missing days closed", () => {
    const html = renderToStaticMarkup(
      <BusinessHoursForm
        shopId={shopId}
        hours={{
          timezone: "America/Port_of_Spain",
          days: { mon: { open: "08:30", close: "16:00" } },
        }}
      />,
    );
    expect(inputs(html)[0]).toContain("checked");
    expect(html).toContain('value="America/Port_of_Spain"');
    expect(html).toContain('value="08:30"');
    expect(html).toContain('value="16:00"');
    expect(html.match(/type="time"/g)).toHaveLength(2);
    expect(html.match(/>Closed</g)).toHaveLength(6);
  });
});
