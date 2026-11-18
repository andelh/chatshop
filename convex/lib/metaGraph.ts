/**
 * Meta Graph API version used for every Messenger / Instagram call.
 *
 * Meta supports each version for about two years and then silently upgrades
 * calls to the oldest live version. v18.0 expired on 2026-01-26. Check
 * https://developers.facebook.com/docs/graph-api/changelog/versions/ when
 * bumping this.
 */
export const META_GRAPH_API_VERSION = "v26.0";

export const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
