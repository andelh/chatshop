import { NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify";

export async function GET() {
  const response = await shopifyFetch({
    query: `query ProductsDebug {
      products(sortKey: TITLE, first: 50) {
        edges {
          node {
            id
            title
            handle
            description
            availableForSale
          }
        }
      }
    }`,
  });

  if (response.status >= 400) {
    return NextResponse.json(
      { error: "Failed to fetch products", details: response.body ?? null },
      { status: response.status },
    );
  }

  return NextResponse.json(response.body, { status: response.status });
}
