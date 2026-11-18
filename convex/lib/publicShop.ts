import type { Doc } from "../_generated/dataModel";

/**
 * A shop as it may be sent to the browser: credentials removed.
 * Pipeline code that needs the tokens must read the shop through an internal
 * query instead.
 */
export type PublicShop = Omit<
  Doc<"shops">,
  "shopifyAccessToken" | "metaPageAccessToken"
>;

export function toPublicShop(shop: Doc<"shops">): PublicShop {
  const {
    shopifyAccessToken: _shopifyAccessToken,
    metaPageAccessToken: _metaPageAccessToken,
    ...rest
  } = shop;
  return rest;
}
