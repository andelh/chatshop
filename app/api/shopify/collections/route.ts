import { NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify";

export async function GET() {
  const response = await shopifyFetch({
    query: `query CollectionsDebug {
      collections(first: 50) {
        edges {
          node {
            id
            title
            handle
            description
            updatedAt
          }
        }
      }
    }`,
  });

  if (response.status >= 400) {
    return NextResponse.json(
      { error: "Failed to fetch collections", details: response.body ?? null },
      { status: response.status },
    );
  }

  return NextResponse.json(response.body, { status: response.status });
}
