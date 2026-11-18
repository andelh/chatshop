import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { setupConvex, signInAs } from "./test.setup";

const SHOP = {
  profile: {
    storeName: "  Acme Outdoors ",
    assistantName: "Sam",
    persona: "Relaxed and outdoorsy",
    policies: "Free delivery over $200.",
  },
  shopifyDomain: "https://acme.myshopify.com/api/2025-01/graphql.json",
  shopifyAccessToken: "storefront_token",
  metaPageId: "page_acme",
  metaPageAccessToken: "page_token",
  instagramAccountId: "ig_acme",
};

async function signedIn() {
  const t = setupConvex();
  const [aliceId, bobId] = await t.run(async (ctx) => [
    await ctx.db.insert("users", {}),
    await ctx.db.insert("users", {}),
  ]);
  return {
    t,
    alice: t.withIdentity(await signInAs(t, aliceId)),
    bob: t.withIdentity(await signInAs(t, bobId)),
    bobId,
  };
}

describe("shops.create", () => {
  it("creates the shop with its profile and makes the caller owner", async () => {
    const { t, alice } = await signedIn();
    const shopId = await alice.mutation(api.shops.create, SHOP);

    const shops = await alice.query(api.shopMembers.listUserShops, {});
    expect(shops).toHaveLength(1);
    expect(shops[0]).toMatchObject({
      _id: shopId,
      role: "owner",
      metaPageId: "page_acme",
      agentProfile: { storeName: "Acme Outdoors", assistantName: "Sam" },
      settings: { autoReplyEnabled: true },
    });
    // Credentials never go back to the browser.
    expect(shops[0]).not.toHaveProperty("shopifyAccessToken");
    expect(shops[0]).not.toHaveProperty("metaPageAccessToken");

    const stored = await t.run((ctx) => ctx.db.get(shopId));
    expect(stored?.shopifyAccessToken).toBe("storefront_token");
  });

  it("refuses anonymous callers", async () => {
    const t = setupConvex();
    await expect(t.mutation(api.shops.create, SHOP)).rejects.toThrow();
  });

  it("refuses a Page or Instagram account another shop uses", async () => {
    const { alice, bob } = await signedIn();
    await alice.mutation(api.shops.create, SHOP);
    await expect(
      bob.mutation(api.shops.create, { ...SHOP, instagramAccountId: "ig_new" }),
    ).rejects.toThrow(/Facebook Page/);
    await expect(
      bob.mutation(api.shops.create, { ...SHOP, metaPageId: "page_new" }),
    ).rejects.toThrow(/Instagram account/);
  });

  it("only accepts an https Storefront API endpoint", async () => {
    const { alice } = await signedIn();
    for (const shopifyDomain of [
      "acme.myshopify.com",
      "http://acme.myshopify.com/api/2025-01/graphql.json",
      "https://acme.myshopify.com/admin/api/2025-01/graphql.json",
    ]) {
      await expect(
        alice.mutation(api.shops.create, { ...SHOP, shopifyDomain }),
      ).rejects.toThrow(/Storefront API URL/);
    }
  });

  it("requires a store and assistant name", async () => {
    const { alice } = await signedIn();
    await expect(
      alice.mutation(api.shops.create, {
        ...SHOP,
        profile: { storeName: " ", assistantName: "Sam" },
      }),
    ).rejects.toThrow(/Store name/);
  });
});

describe("shop settings", () => {
  async function ownedShop() {
    const env = await signedIn();
    const shopId = await env.alice.mutation(api.shops.create, SHOP);
    await env.t.run((ctx) =>
      ctx.db.insert("shopMembers", {
        userId: env.bobId,
        shopId,
        role: "member",
      }),
    );
    return { ...env, shopId };
  }

  async function storedShop(
    t: ReturnType<typeof setupConvex>,
    shopId: Id<"shops">,
  ) {
    return await t.run((ctx) => ctx.db.get(shopId));
  }

  it("lets only owners change the assistant's profile", async () => {
    const { t, alice, bob, shopId } = await ownedShop();
    const profile = { storeName: "Acme", assistantName: "Riley" };
    await alice.mutation(api.shops.updateAgentProfile, { shopId, profile });
    expect((await storedShop(t, shopId))?.agentProfile).toEqual(profile);
    await expect(
      bob.mutation(api.shops.updateAgentProfile, { shopId, profile }),
    ).rejects.toThrow(/Owner/);
  });

  it("validates business hours on save and clears them with null", async () => {
    const { t, bob, shopId } = await ownedShop();
    const hours = {
      timezone: "America/Port_of_Spain",
      days: { mon: { open: "09:00", close: "17:00" } },
    };
    await bob.mutation(api.shops.updateShopSettings, {
      shopId,
      businessHours: hours,
    });
    expect((await storedShop(t, shopId))?.settings.businessHours).toEqual(
      hours,
    );

    await expect(
      bob.mutation(api.shops.updateShopSettings, {
        shopId,
        businessHours: { ...hours, timezone: "Mars/Base" },
      }),
    ).rejects.toThrow(/time zone/);

    await bob.mutation(api.shops.updateShopSettings, {
      shopId,
      businessHours: null,
    });
    const settings = (await storedShop(t, shopId))?.settings;
    expect(settings?.businessHours).toBeUndefined();
    expect(settings?.autoReplyEnabled).toBe(true);
  });
});
