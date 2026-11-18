import { META_GRAPH_BASE_URL } from "./metaGraph";

/**
 * The customer's display name from the Graph API, or undefined when Meta
 * won't share it (missing permission, deleted account, network error).
 * Never throws: a name is nice to have, not needed to reply.
 */
export async function fetchCustomerName({
  platform,
  userId,
  accessToken,
}: {
  platform: string;
  userId: string;
  accessToken: string;
}): Promise<string | undefined> {
  const isInstagram = platform === "instagram";
  const url = new URL(`${META_GRAPH_BASE_URL}/${encodeURIComponent(userId)}`);
  url.searchParams.set(
    "fields",
    isInstagram ? "name,username" : "first_name,last_name",
  );
  url.searchParams.set("access_token", accessToken);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      // An expired Page token shows up here first (Graph error 190).
      console.warn(
        `No ${platform} profile for ${userId}: HTTP ${response.status}`,
        await response.text().catch(() => ""),
      );
      return undefined;
    }
    const data = await response.json();
    const name = isInstagram
      ? data.name || data.username
      : [data.first_name, data.last_name].filter(Boolean).join(" ");
    return typeof name === "string" && name.trim() ? name.trim() : undefined;
  } catch (error) {
    console.warn(`No ${platform} profile for ${userId}:`, error);
    return undefined;
  }
}
