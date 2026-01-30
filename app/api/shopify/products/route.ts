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
            productType
            tags
            availableForSale
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
              maxVariantPrice {
                amount
                currencyCode
              }
            }
            options {
              id
              name
              values
            }
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  quantityAvailable
                  price {
                    amount
                    currencyCode
                  }
                  compareAtPrice {
                    amount
                    currencyCode
                  }
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
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
