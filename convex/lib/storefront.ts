/**
 * Why `url` can't be a shop's Storefront API endpoint, or null when it can.
 * The pipeline POSTs GraphQL (with the shop's token) straight to this URL,
 * so it must be an https Storefront endpoint, e.g.
 * https://acme.myshopify.com/api/2025-01/graphql.json
 */
export function storefrontEndpointError(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Enter the full Storefront API URL, starting with https://";
  }
  if (parsed.protocol !== "https:") {
    return "The Storefront API URL must use https";
  }
  if (
    !/^\/api\/(\d{4}-\d{2}\/|unstable\/)?graphql\.json$/.test(parsed.pathname)
  ) {
    return "The Storefront API URL must end in /api/<version>/graphql.json";
  }
  return null;
}
