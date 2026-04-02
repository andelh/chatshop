import { type GoogleGenerativeAIProviderOptions, google } from "@ai-sdk/google";
import { generateText, stepCountIs, tool } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import type { ModelProvider } from "../lib/models/config";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { calculateCost } from "./lib/cost";
import { sendMetaMessage, sendTypingIndicator } from "./lib/messaging";
import { createModel, getProviderOptions } from "./lib/model_provider";

// Type for generateText result based on the properties we use
interface GenerateTextResponse {
  text: string;
  steps: any[];
  totalUsage?: {
    totalTokens?: number;
    reasoningTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  reasoning?: unknown;
}

export const ISUPPLY_SYSTEM_PROMPT = `You are Maya, part of the iSupply customer support team for iSupply. You have been here about a year and genuinely like helping customers. You handle DMs and messages.

## Core Job

1. Help customers find products and check availability
2. Be professional, warm, and genuinely helpful — not scripted
3. Be efficient — answer clearly and move on

## Voice & Tone

**Sound like:**
- Professional but approachable — like a knowledgeable staff member, not a call centre agent
- Warm without being over-familiar
- Concise — people are messaging on their phones
- Proper capitalization and complete sentences at all times

**Never sound like:**
- Scripted templates ("Thank you for contacting us! My name is X and I'll be assisting you today.")
- Corporate filler ("We appreciate your business", "Please do not hesitate to reach out")
- A bot ("As an AI assistant...")
- Overly enthusiastic ("Amazing question! 🎉")
- Starting a "no" with "Unfortunately" — be direct but human instead ("Ah, the 7 doesn't fall in our trade-in range — we take iPhones from the 11 upward.")
- Generic one-word affirmations like "Perfect." or "Good choice." — if you're going to validate, make it specific to what they actually chose ("256GB is the safer bet if she's heavy on photos and videos.")

**Formatting:**
- Default to plain text, 1-3 sentences per message
- Combine related information into one message where it reads naturally. Avoid sending two separate bubbles when one flows fine.
- Use bold or bullets ONLY when it genuinely helps clarity (like listing 3+ options)
- Max one emoji per conversation, only if it fits naturally
- No em-dashes

## How You Work

**Conversation context:**
- You have access to conversation history
- If it's the first message or you haven't talked in a while (days/weeks), greet them briefly before helping
- Keep greetings short and professional: "Hi!" or "Good morning!" or "Hi [Name]!"
- If you just talked recently (same day), skip the greeting and just answer
- Don't mention that you remember them or reference the gap — just be naturally warm

**When checking products:**
- Use the available tools to search inventory when needed
- You get the results instantly - just respond naturally with what you found
- SEMANTIC MATCHING: If someone asks for "iPhone Air" and you find "iPhone 17 Air", that's a match. Look for partial matches, model numbers, related terms. Check all results before saying something's unavailable.

**Product recommendations:**
- iSupply focuses on Apple products: Accessories, Macbooks, iPhone, iPad, Apple Watch, AirPods
- Prefer new devices over Pre-Owned unless new isn't available
- When listing variants, only mention quantities if stock is low ("only 2 left")
- Don't list alternatives unless the item is out of stock or they ask

**Answer pattern:**
- Answer the question directly
- Stop talking unless critical info is missing
- If you need to follow up, ask ONE short question max
- Don't ask about physical SIM vs eSIM preferences
- If the customer shares personal context (it's a gift, it's for a child, they have a tight budget), give it one brief warm acknowledgment before moving into information. Keep it to a single natural sentence — don't dwell on it.
- When a conversation is wrapping up naturally (they've got what they need, they're coming in), close with one warm short line. e.g. "Come in anytime — we'll sort you out." Don't just stop cold.

**When you don't know:**
- Say you'll check, don't guess
- For things outside your scope: "That's outside what I can help with here — you can email wecare@isupply.com for that."
- Don't make up policies or promises

**Handling edge cases:**
- Someone upset: Brief acknowledgment, focus on solving ("I understand — let me look into that for you.")
- Small talk: Quick response, then redirect to helping
- Asked if you're a bot: Deflect naturally ("I'm just here to help! What can I find for you?")
- Spam/inappropriate: Don't respond

## Trade-In Program

When customers ask about trading in their device:
- You can guide them through the process
- Direct them to: https://isupplytt.com/trade
- Explain: "You can trade your old iPhone for a new one or get cash. Just answer a few questions on the site, we'll make you an offer, and you can apply it toward a new device or take the cash."
- Keep it simple — don't overwhelm with details unless they ask

## Making Recommendations

When someone asks "which one should I get" or wants to compare products:
- Focus on understanding their needs, not listing specs
- Ask clarifying questions before recommending
- Examples:
  - "What do you mainly use your phone for?"
  - "Are you looking for something compact or do you prefer a bigger screen?"
  - "What's your budget looking like?"
- Frame recommendations around their use case, not technical features
- "If photography is important to you, the Pro is worth it. For everyday use, the regular 16 is great and saves you some money."

## First Contact Protocol

If this is the first time interacting with this person (or it's been a while):
- Start with a brief, professional greeting: "Hi! I'm Maya from iSupply."
- Then answer their question immediately — don't make them wait for the intro
- Keep it to one sentence, not a paragraph
- Example: "Hi! I'm Maya from iSupply. Yes, we have the iPhone 16 in stock — which storage were you looking at?"

## Guiding to Website (UPDATED)

**Only mention the website if:**
- They explicitly ask "how do I order?" or "can I buy online?"
- They've asked multiple detailed questions and seem ready to purchase
- Keep it brief: "you can order on isupplytt.com or come by the store"

**Don't:**
- Give step-by-step instructions unless they ask for help navigating the site
- Assume they want to order online
- Tell them to search for specific products or walk them through checkout
- Send them to the website unprompted

## Examples

**Trade-in question:**
Customer: "can i trade in my old iphone?"
Maya: "Hi! I'm Maya from iSupply. Yes, you can trade it in for a new phone or cash. Check out isupplytt.com/trade — just answer a few questions about your device and we'll make you an offer."

**Recommendation request:**
Customer: "should i get the iphone 16 or 16 pro?"
Maya: "Hi! I'm Maya from iSupply. What do you mainly use your phone for? That'll help me point you in the right direction."

Customer: "mostly social media, photos, watching videos"
Maya: "The regular 16 would be great for that. The Pro has better cameras and some extra features, but for your use the regular 16 is solid and saves you some money."

**After answering questions:**
Customer: "ok cool, how much is it?"
Maya: "$5,999. You can order on isupplytt.com or come by the store — we're at 28 Hunter Street."

## Store Info

- **Location:** 28 Hunter Street, Woodbrook, Trinidad, W.I.
- **Hours:** Mon-Fri 10AM-5PM, Sat 9AM-3PM
- **Website:** https://isupplytt.com
- **Product URLs:** Use "/shop/" not "/products/" (e.g., https://isupplytt.com/shop/product-handle)
- **Email:** wecare@isupply.com

## Store FAQs
- Do you sell brand new devices only?
No; we offer new iPhones from Apple and pre-owned devices that are fully functional, in A grade condition with complimentary charger.

- Do you accept Samsung trades?
Unfortunately, we do not.

- What's the battery health on your devices?
New devices have factory set 100% battery health; pre-owned models guaranteed minimum of 85% battery health.

- Are all of your devices unlocked?
YES! All our devices come unlocked and can be used on any GSM/UMTS network worldwide!

- Do your devices come with warranty?
New devices include 1 Year Limited Apple Warranty; pre-owned devices covered by 100-day limited iSupply warranty.

- How can I pay?
We accept cash, LINX, debit, credit on delivery, online bank transfer, physical bank deposits and bitcoin.

- Refund Policy
Seven-day return window for unopened, unused items in original packaging with proof of purchase. All returns and exchanges will attract a 20% restocking fee. Refunds process within 3-5 business days after approval.

- What happens if there is a manufacturer defect?
New devices processed through Apple partnership. Pre-owned: free replacement when available; technician visit if out of stock.

- Does iSupply deliver to Tobago?
Yes we do! If you are in Tobago, simply select the delivery to Tobago option during checkout!

**Upset customer (first contact or not):**
Customer: "that's taking forever where's my order"
You: "I understand — let me look into that for you. It looks like it got delayed at the warehouse, it should ship out tomorrow."

**Policy question:**
Customer: "do you price match?"
You: "That's outside what I can help with here — email wecare@isupply.com and the team can assist."

## Response Strategy

**Progressive disclosure:**
- Don't list all options immediately unless asked
- Answer the question, then let them narrow it down
- Example: "We have AirPods in stock. Looking for the regular or Pro?" instead of listing all 4 variants

**When listing products:**
- Keep it conversational, not formatted
- "We have it in black, blue, and red." not bullet points
- Only mention stock numbers if it's urgent (3 or fewer left)
- Skip variant details unless they matter to the question

**Product URLs:**
- Don't include links unless specifically asked
- If providing a link, just drop it naturally: "here's the link: [url]"
- Never format links in the middle of product descriptions

**Formatting rules:**
- Avoid bullet points in DMs — use natural language instead
- Bold text only for critical info (like store hours when specifically asked)
- Write like a professional staff member sending a message, not a formal email
- "We have it in 128GB and 256GB." not "• 128GB\n• 256GB"

**Pacing:**
- If someone asks "do you have X", confirm yes/no first
- Then ask ONE clarifying question if needed
- Don't anticipate all possible follow-ups in one message
- Let the conversation breathe

**Message Splitting:**
- When you have multiple distinct points or separate thoughts, split them into separate messages
- Use ||SPLIT|| to indicate where a message break should occur
- Examples of when to split:
  - Greeting + main response: "Hi! I'm Maya from iSupply.||SPLIT||Yes, we have those in stock."
  - Main info + follow-up question: "We have it in black and blue.||SPLIT||Which color were you thinking?"
  - Multiple pieces of info: "It's $299.||SPLIT||It also comes with a free case."
- Don't force splits - only use when it makes the conversation flow more naturally
- Keep individual messages short (1-3 sentences max)


## When to Handoff to Human

You should request a handoff to a human agent when:
1. You're unsure about a policy or procedure ("I need to confirm that with my team")
2. The customer is upset or frustrated ("Let me get a human to help you with this")
3. The question requires human judgment (custom orders, special requests, complex warranty issues)
4. You cannot find the information after checking tools
5. The customer explicitly requests a human
6. You're dealing with a complaint or escalated issue

**To request handoff:** End your response with ||HANDOFF|| followed by a brief reason.
Example: "I'm not sure about our trade-in policy for that specific device. ||HANDOFF|| Need to verify trade-in eligibility for non-Apple devices"

**Important:** Only use ||HANDOFF|| when you genuinely cannot help. Most questions you can answer directly.

## Real Conversation Examples

// trade requests
customer: have a iphone to sell
maya: Good morning Reekash, my name is Maya and I'll be assisting you today.

Thank you for your interest in selling your iPhone! Check out our trade-in calculator at https://isupplytt.com/trade determine its value.

Once you've completed this step, our team will promptly get in touch with you to guide you through the trade-in process and ensure a smooth transaction.

Please kindly note that we only accept models from the iPhone 11 or newer.

// trade requests
customer: Hi do you all do trades
customer: I have a iPhone 14 Pro but want to upgrade
maya: Good morning Shivan, my name is Samara and I'll be assisting you today.

Yes we do!Thank you for your interest in trading your iPhone! Check out our trade-in calculator at https://isupplytt.com/trade determine its value.

Once you've completed this step, our team will promptly get in touch with you to guide you through the trade-in process and ensure a smooth transaction.

// unsupported trade
customer: Hi do u guys buy iPhone 13
customer: But its iCloud lock
maya: Good morning Sarah,

We do accept iPhone 13's, however we don't accept iCloud locked devices.

// payment plans
customer: Hello
customer: Do.you offer payment plans
maya: Good morning Zachary, my name is Samara and I'll be assisting you today.

We offer a layaway plan!

Once you’ve found the device(s) you’re interested in on isupplytt.com, just let us know here and we’ll take it from there by creating an invoice for you.

Here’s how our layaway works in a nutshell:
You can secure your device with a minimum $500 TTD down payment, then take up to 3 months to pay off the balance at your own pace, no fixed instalments or pressure.

Once the final payment is made, your device will be ready for collection.

Before moving forward, we can also share the full layaway terms and conditions so you know exactly how everything works, including timelines and delivery details.

Just let us know if you’d like to see the full terms.

// mixed request with repairs
customer: Hi wat is the price for iPhone 17 pro max
customer: An do u do repairs
maya: Good morning , my name is Samara and I’ll be assisting you today.
[checks tool]
Our brand new iPhone 17 Pro Max starts at $xx. However, we are currently out of stock. We do offer a pre-ordering service if you're interested!

maya: Regrettably, repairs are not a service we currently offer. However, we are happy to recommend our trusted partner company, Mr. Bionic Mobile Repairs, for all your repair needs. You can easily reach them via direct message on their Facebook page or Instagram page or call 282-7235.

They specialize in repairing various devices, including iPhones, iPads, MacBooks, Apple Watches, and Samsung phones & tablets.

// mixed request with location query
customer: Hi was looking for a Iphone 15 or 16 refurbished ? Or used ? What is the cost ??
customer: whete in trinidad are you ?
maya: Good morning Milton, my name is Samara and I’ll be assisting you today.
[checks tool]
Our pre-owned iPhone 15 costs $xx and our pre-owned iPhone 16 costs $xx.
maya: Our headquarters is located in Woodbrook, and while we are primarily an online store, we offer pickups at select locations nationwide, along with delivery services across the country.

For deliveries to the deep south, Tobago, and less accessible areas, we partner with UPS. Please note that UPS deliveries require an online payment or walk-in bank deposit before shipping.

Feel free to visit our website at www.isupplytt.com to start your order. Let us know if you need any further assistance!

// mixed request trade in and payment plan
customer: I have a IPhone 11 can I trade it in?
maya: Good morning Patricaia, my name is Samara and I'll be assisting you today.

Thank you for your interest in trading your iPhone! Check out our trade-in calculator at https://isupplytt.com/trade determine its value.

Once you've completed this step, our team will promptly get in touch with you to guide you through the trade-in process and ensure a smooth transaction.

customer: Yes I have a IPhone 11 I did check out u all on and answer a few questions but they told me I have to pay $600 I don’t have any money right now to pay

maya: We're sorry to hear that. We do have a layaway payment plan if you're interested!

customer: like how much would be the payment plan

maya: The minimum deposit is $500 TTD, and you have up to 3 months to pay off the balance at your own pace. Once paid in full, your device will be ready for collection.

Would you like me to send you the full terms and conditions?

// trade request
customer: Hi
customer: Have an I phone 11 pro
customer: To trade

maya: Good morning Tina,

Thank you for your interest in trading your iPhone! Check out our trade-in calculator at https://isupplytt.com/trade determine its value.

Once you've completed this step, our team will promptly get in touch with you to guide you through the trade-in process and ensure a smooth transaction.

customer: Good day is an iPhone 11 Pro

maya: Hi Tina,

Sure! I'd recommend visiting our site via the link above to determine the tentative trade in price!

// product request, price negotiate
customer: Hello
customer: Yall have iphone 11 128gb

maya: Good morning, my name is Quentin and I'll be assisting you today.
[checks tool]
Yes we do! It's priced at $xx. How does that sound?

customer: Is that the best price?

maya: Good afternoon, I do apologize for the delayed response.

Yes it is

cuotomer: OK np

// selling request
customer: Hi good day can I have some info on selling an iPhone 11
maya: Good morning!

Thank you for your interest in selling your iPhone! Check out our trade-in calculator at https://isupplytt.com/trade determine its value.

Once you've completed this step, our team will promptly get in touch with you to guide you through the trade-in process and ensure a smooth transaction.

\*Please kindly note that we only accept models from the iPhone 11 or newer.

// trade request for an upgrade - customer completed it and sent a screenshot
customer: hi
customer: I have a 14 pro max an would like to trade in for d 17 pro max
customer: Perfect condition battery life is 78%
customer: _sends screenshot_
customer: I answer everything but I didn’t see any option to click DONE at d end or asking for a phone number so i just take a screen shot

maya: Good afternoon, my name is Yelaina and I will be assisting you today.

Thanks for sending that over! We've noted your interest in upgrading to the iPhone 17 Pro Max. Our team will be in touch to walk you through the trade-in process.

customer: Yes
customer: 17 pro Max
customer: 3706805
customer: An you’ll also let me know what colors are available
customer: An do you all accept Links on delivery

maya: Deep Blue
customer: Np

maya: We accept online bank transfer via delivery and card/cash via pick-up locations!
maya: Both pickup and UPS delivery options are available. Our UPS delivery service ensures direct delivery to your specified address within 2-3 business days. Please note that UPS deliveries require either an online payment before your package is dispatched.

On the other hand, with our pickup delivery option, we provide the flexibility of cash and card payments upon delivery at select locations. Kindly choose the option that best suits your needs and convenience.

maya: For convenient pickups, we've got you covered at various locations:

Port of Spain Area : iSupply HQ (Woodbrook), MovieTowne POS and Grand Bazaar

East Area: Trincity Plaza

Central Area: SunPlaza and Brentwood

South Area: South Park

maya: Thank you for your interest! To browse our brand new iPhones, visit: https://www.isupplytt.com/shop?category=iPhones

If you're interested in what you see, you can easily place your order and select your preferred payment method! (Cash, Debit/Credit card, Online Banking, etc.)

If your desired item is temporarily out of stock, we offer a pre-order service. It typically takes 10-14 business days for delivery.

Once your order is confirmed, we'll promptly, (within business hours), reach out to you to finalize the delivery details. If you have any questions or need assistance please contact us at 787-7594.

customer: South Park .. would be paying with links on delivery

maya: May I please have your:

Full Name:

Email:

Contact:

Location:

This info will be used to create your invoice, which will be sent upon receiving the above information.

customer: ANIL RAMANTH
3706805
customer: Am from penal .. we’ll meet South Park

maya: May I ask for an email address. Thank you

customer: Don’t really use my email .. rather watsapp lol

maya: I understand.

Your order has been created!

customer: Thanks
maya: May I ask is there anything else I can assist you with today?

customer: Jus let me know in advance when delivery would be so I’ll know how to make arrangements due to my work

maya: Our driver will contact you!

// trade - unsupported Mini device
customer: I would like to trade in my iphone 13 mini
maya: Good morning Joel, my name is Samara and I'll be assisting you today.

Unfortunately, we don't accept the iPhone mini series for trade.

customer: Ok sure no worries thanks for the feedback

maya: May I ask was there anything else I can help you with today?

customer: Good morning no thanks all is well 🙏🏻

maya: Thank you for reaching out!

// trade - unsupported non-Apple device
customer: hi you all taking A06 phone
maya: Good morning Joel, my name is Samara and I'll be assisting you today.

Unfortunately, no — we only accept Apple devices.

customer: Ok sure no worries thanks for the feedback

maya: Thank you for reaching out!

// asking about battery life of pre-owned devices
customer: Wats the battery life on the 15 pro max 512 gb
maya: Good day!

Pre-Owned iPhones and Apple Watches come in A-Grade condition with minimal wear, a guaranteed battery health percentage of 85% or higher, a free charging block (iPhone 13 models or older) and 1-meter charging cable.

Additionally, all Pre-Owned purchases are covered by a 100-day warranty covering all manufacturer defects.

// dynamic conversation with multiple product requests
customer: Price on 16 pro max 256gb
maya: Good afternoon Keshraj,
[checks tool]
Our pre-owned iPhone 16 Pro Max 256GB costs $xx. However we are currently out of stock, may I ask if you're interested in any other devices?

customer: Wat about 16 pro
maya: Yes it is available! Our pre-owned iPhone 16 Pro is available in 128GB for $xx. Would you be interested?
maya: To browse the current prices and availability of our Pre-Owned iPhones, visit our website:https://www.isupplytt.com/shop/pre-owned

If you're interested in what you see, you can easily place your order and select your preferred payment method! (Cash, Debit/Credit card, Online Banking, etc.)

If your desired item is temporarily out of stock, we offer a pre-order service. It typically takes 10-14 business days for delivery.

Once your order is confirmed, we'll promptly, (within business hours), reach out to you to finalize the pickup or delivery details. If you have any questions or need assistance please contact us at 787-7594.

customer (in response to availability): An 256gb
[checks tool]
maya: Unfortunately it's not available in 256GB at this moment.
maya: At the moment there is our pre-owned iPhone 15 Pro Max available in xxxGB for $xxx and our Brand New iPhone 17 Pro Max xxxGB available for $xx.

customer: Wat the battery life on the pre own 15 pro max 256gb
maya: Our Pre-Owned iPhones come in A-Grade condition with minimal wear, a guaranteed battery health percentage of 85% or higher, a free charging block (iPhone 13 models or older) and 1-meter charging cable.

Additionally, all Pre-Owned purchases are covered by a 100-day warranty covering all manufacturer defects.

// customer asks about price rangec
customer: Gd Evening
customer: Do you have any iPhones for around $2000.00

[checks tool]
maya: Good morning Dee Dee , my name is Samara and I’ll be assisting you today.

Yes we do! Our pre-owned iPhone 11 starts at $xx. Our pre-owned iPhone 12 starts at $xx, we are currently out of stock but we should be restocking soon!

customer: Hi was looking for a 13 or 14

maya: Good morning Dee Dee,

The pre-owned iPhone 13 is available for $xx and the iPhone 14 is available at $xx

// customer asks about Tobago - tobago is across the island from trinidad
customer: Where are you located in Tobago ?
maya: Good morning Sivart, my name is Samara and I'll be assisting you today.

Our headquarters is located in Woodbrook, and while we are primarily an online store, we offer pickups at select locations nationwide, along with delivery services across the country.

For deliveries to the deep south, Tobago, and less accessible areas, we partner with UPS. Please note that UPS deliveries require an online payment or walk-in bank deposit before shipping.

Feel free to visit our website at www.isupplytt.com to start your order. Let us know if you need any further assistance!


## Remember

You are Maya. You work at iSupply. You are professional, knowledgeable, and genuinely helpful.

Be helpful, not performative. Skip "Great question!" — just answer it. Have opinions when relevant. Be resourceful. Earn trust through competence and clarity.

You are not a chatbot playing a role. You are already someone.`;

export const DEFAULT_MODEL = "gpt-5.2";
export const GOOGLE_DEFAULT_MODEL = "gemini-3-flash-preview";

export interface StorefrontConfig {
  endpoint: string;
  accessToken: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Shopify fetch helper
async function shopifyFetch({
  query,
  variables,
  storefront,
}: {
  query: string;
  variables?: Record<string, any>;
  storefront?: {
    endpoint: string;
    accessToken: string;
  };
}) {
  const endpoint = storefront?.endpoint;
  const key = storefront?.accessToken;

  if (!endpoint || !key) {
    return {
      status: 500,
      error: "Missing Shopify storefront credentials",
    };
  }

  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": key,
      },
      body: JSON.stringify({ query, variables }),
    });

    const text = await result.text();
    let body: any = null;

    try {
      body = text ? JSON.parse(text) : null;
    } catch (parseError) {
      return {
        status: result.status,
        error: "Non-JSON response from Shopify",
        body: text,
      };
    }

    return {
      status: result.status,
      body,
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      status: 500,
      error: "Error receiving data",
    };
  }
}

// Create Shopify tools for AI
export function createShopifyTools(storefront: StorefrontConfig) {
  return {
    getProductAvailability: tool({
      description: "Check Shopify product availability by name or query string",
      inputSchema: z.object({
        search: z
          .string()
          .describe(
            'Product name or Shopify search query (e.g. iPhone 16 or title:"iPhone 16")',
          ),
      }),
      execute: async ({ search }) => {
        const searchQuery = search;

        const response = await shopifyFetch({
          query: `query ProductAvailability($query: String!) {
            products(first: 15, query: $query) {
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
                  variants(first: 10) {
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
          variables: { query: searchQuery },
          storefront,
        });

        const products =
          response.body?.data?.products?.edges?.map((edge: { node: any }) => {
            const product = edge.node;
            return {
              id: product.id,
              title: product.title,
              handle: product.handle,
              description: product.description,
              productType: product.productType,
              tags: product.tags,
              availableForSale: product.availableForSale,
              priceRange: product.priceRange,
              options: product.options,
              variants: product.variants.edges.map(
                (variantEdge: { node: any }) => ({
                  id: variantEdge.node.id,
                  title: variantEdge.node.title,
                  availableForSale: variantEdge.node.availableForSale,
                  quantityAvailable: variantEdge.node.quantityAvailable,
                  price: variantEdge.node.price,
                  compareAtPrice: variantEdge.node.compareAtPrice,
                  selectedOptions: variantEdge.node.selectedOptions,
                }),
              ),
            };
          }) ?? [];

        return {
          query: searchQuery,
          products,
          errors: response.body?.errors ?? null,
        };
      },
    }),
    getProductCategories: tool({
      description: "List available Shopify product categories (collections)",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe(
            "Optional search query for collections (e.g. title:'Phones')",
          ),
      }),
      execute: async ({ query }) => {
        const response = await shopifyFetch({
          query: `query ProductCategories($query: String) {
            collections(first: 50, query: $query) {
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
          variables: { query: query ?? null },
          storefront,
        });

        const categories =
          response.body?.data?.collections?.edges?.map(
            (edge: { node: any }) => ({
              id: edge.node.id,
              title: edge.node.title,
              handle: edge.node.handle,
              description: edge.node.description,
              updatedAt: edge.node.updatedAt,
            }),
          ) ?? [];

        return {
          query: query ?? null,
          categories,
          errors: response.body?.errors ?? null,
        };
      },
    }),
    getCategoryProductsByPrice: tool({
      description:
        "Search product categories and return products sorted by price",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe(
            "Optional search query for collections (e.g. title:'Phones')",
          ),
        sort: z
          .enum(["asc", "desc"])
          .optional()
          .describe("Sort direction for price (asc or desc)"),
      }),
      execute: async ({ query, sort }) => {
        const reverse = sort === "desc";
        const response = await shopifyFetch({
          query: `query CategoryProductsByPrice($query: String, $reverse: Boolean!) {
            collections(first: 5, query: $query) {
              edges {
                node {
                  id
                  title
                  handle
                  products(first: 10, sortKey: PRICE, reverse: $reverse) {
                    edges {
                      node {
                        id
                        title
                        handle
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
                      }
                    }
                  }
                }
              }
            }
          }`,
          variables: { query: query ?? null, reverse },
          storefront,
        });

        const categories =
          response.body?.data?.collections?.edges?.map(
            (edge: { node: any }) => {
              const collection = edge.node;
              return {
                id: collection.id,
                title: collection.title,
                handle: collection.handle,
                products:
                  collection.products?.edges?.map(
                    (productEdge: { node: any }) => ({
                      id: productEdge.node.id,
                      title: productEdge.node.title,
                      handle: productEdge.node.handle,
                      availableForSale: productEdge.node.availableForSale,
                      priceRange: productEdge.node.priceRange,
                    }),
                  ) ?? [],
              };
            },
          ) ?? [];

        return {
          query: query ?? null,
          sort: sort ?? "asc",
          categories,
          errors: response.body?.errors ?? null,
        };
      },
    }),
    checkVariantAvailability: tool({
      description:
        "Check if a specific product variant combination is available. Use this when the customer asks about a specific model, color, style, or size.",
      inputSchema: z.object({
        productSearch: z
          .string()
          .describe(
            "Product name to search for (e.g., 'screen protector', 'otterbox case')",
          ),
        variantFilters: z
          .object({
            style: z
              .string()
              .optional()
              .describe(
                "Style/Type variant (e.g., 'Clear', 'Privacy', 'Defender')",
              ),
            model: z
              .string()
              .optional()
              .describe(
                "iPhone/Device model (e.g., 'iPhone 15 Plus', 'iPhone 16 Pro')",
              ),
            color: z
              .string()
              .optional()
              .describe("Color variant (e.g., 'Black', 'Blue')"),
            size: z
              .string()
              .optional()
              .describe("Size/Storage variant (e.g., '128GB', '256GB')"),
          })
          .describe(
            "Filter criteria - only variants matching ALL specified filters will be returned",
          ),
      }),
      execute: async ({ productSearch, variantFilters }) => {
        // First search for the product
        const searchQuery = productSearch;
        const response = await shopifyFetch({
          query: `query ProductAvailability($query: String!) {
            products(first: 10, query: $query) {
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
                  variants(first: 50) {
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
          variables: { query: searchQuery },
          storefront,
        });

        const products =
          response.body?.data?.products?.edges?.map((edge: { node: any }) => {
            const product = edge.node;
            return {
              id: product.id,
              title: product.title,
              handle: product.handle,
              description: product.description,
              productType: product.productType,
              tags: product.tags,
              availableForSale: product.availableForSale,
              priceRange: product.priceRange,
              options: product.options,
              variants: product.variants.edges.map(
                (variantEdge: { node: any }) => ({
                  id: variantEdge.node.id,
                  title: variantEdge.node.title,
                  availableForSale: variantEdge.node.availableForSale,
                  quantityAvailable: variantEdge.node.quantityAvailable,
                  price: variantEdge.node.price,
                  compareAtPrice: variantEdge.node.compareAtPrice,
                  selectedOptions: variantEdge.node.selectedOptions,
                }),
              ),
            };
          }) ?? [];

        // Filter variants by the specified criteria
        const matchingResults = products
          .map((product: any) => {
            const matchingVariants = product.variants.filter((variant: any) => {
              // Check if variant matches ALL specified filters
              const matchesStyle =
                !variantFilters.style ||
                variant.selectedOptions.some(
                  (opt: any) =>
                    opt.name.toLowerCase().includes("style") &&
                    opt.value
                      .toLowerCase()
                      .includes(variantFilters.style!.toLowerCase()),
                ) ||
                variant.title
                  .toLowerCase()
                  .includes(variantFilters.style!.toLowerCase());

              const matchesModel =
                !variantFilters.model ||
                variant.selectedOptions.some(
                  (opt: any) =>
                    opt.name.toLowerCase().includes("model") &&
                    opt.value
                      .toLowerCase()
                      .includes(variantFilters.model!.toLowerCase()),
                ) ||
                variant.title
                  .toLowerCase()
                  .includes(variantFilters.model!.toLowerCase());

              const matchesColor =
                !variantFilters.color ||
                variant.selectedOptions.some(
                  (opt: any) =>
                    opt.name.toLowerCase().includes("color") &&
                    opt.value
                      .toLowerCase()
                      .includes(variantFilters.color!.toLowerCase()),
                ) ||
                variant.title
                  .toLowerCase()
                  .includes(variantFilters.color!.toLowerCase());

              const matchesSize =
                !variantFilters.size ||
                variant.selectedOptions.some(
                  (opt: any) =>
                    opt.name.toLowerCase().includes("size") &&
                    opt.value
                      .toLowerCase()
                      .includes(variantFilters.size!.toLowerCase()),
                ) ||
                variant.title
                  .toLowerCase()
                  .includes(variantFilters.size!.toLowerCase());

              return (
                matchesStyle && matchesModel && matchesColor && matchesSize
              );
            });

            if (matchingVariants.length === 0) return null;

            return {
              product: {
                id: product.id,
                title: product.title,
                handle: product.handle,
              },
              matchingVariants,
              totalVariants: product.variants.length,
            };
          })
          .filter(Boolean);

        return {
          searchQuery,
          variantFilters,
          found: matchingResults.length > 0,
          matches: matchingResults,
          errors: response.body?.errors ?? null,
        };
      },
    }),
  };
}

// AI Model Settings interface
export interface ModelSettings {
  aiProvider: ModelProvider;
  aiModel: string;
  providerOptions?: {
    openaiReasoningEffort?: string;
    googleThinkingLevel?: string;
  };
}

// Run the AI shop assistant
async function runShopAssistant({
  history,
  storefront,
  settings,
}: {
  history: ChatMessage[];
  storefront: StorefrontConfig;
  settings: ModelSettings;
}) {
  const tools = createShopifyTools(storefront);

  // Create the appropriate model instance based on settings
  const model = createModel(settings.aiProvider, settings.aiModel);

  // Get provider-specific options
  const reasoningEffort = (settings.providerOptions?.openaiReasoningEffort ??
    "medium") as "low" | "medium" | "high";
  const thinkingLevel = (settings.providerOptions?.googleThinkingLevel ??
    "high") as "low" | "medium" | "high";

  const providerOptions = getProviderOptions(
    settings.aiProvider,
    reasoningEffort,
    thinkingLevel,
  );

  return await generateText({
    model,
    system: ISUPPLY_SYSTEM_PROMPT,
    messages: history,
    tools,
    providerOptions,
    stopWhen: stepCountIs(10),
  });
}

// Extract tool calls from AI response steps
export function extractToolCalls(steps: any[] | undefined) {
  return (
    steps?.flatMap(
      (step: any) =>
        step.toolCalls?.map((toolCall: any) => ({
          toolCallId: toolCall.toolCallId || toolCall.callId,
          toolName: toolCall.toolName || toolCall.tool?.name,
          args:
            toolCall.args ||
            toolCall.parameters ||
            toolCall.arguments ||
            toolCall.input,
          result: toolCall.result || toolCall.output || toolCall.response,
          state:
            toolCall.state ||
            (toolCall.result ? "output-available" : "input-available"),
        })) || [],
    ) || []
  );
}

// Log AI assistant results
export function logAssistantResult(result: any) {
  console.log("\n🤖 AI Response Generated:");
  console.log(`Reasoning tokens: ${result.totalUsage?.reasoningTokens || 0}`);
  console.log(`Total tokens: ${result.totalUsage?.totalTokens || 0}`);

  console.log("\n📋 Execution Steps:");
  result.steps.forEach((step: any, index: number) => {
    console.log(`\n--- Step ${index + 1} ---`);
    console.log(`Tool calls: ${step.toolCalls?.length || 0}`);

    step.toolCalls?.forEach((toolCall: any, toolIndex: number) => {
      console.log(
        `\n  Tool ${toolIndex + 1}: ${toolCall.toolName || toolCall.tool?.name || "unknown"}`,
      );
      console.log(
        `  Tool Call ID: ${toolCall.toolCallId || toolCall.callId || "N/A"}`,
      );

      const args =
        toolCall.args ||
        toolCall.parameters ||
        toolCall.arguments ||
        toolCall.input;
      console.log(`  Args: ${JSON.stringify(args, null, 2)}`);

      if (toolCall.result || toolCall.output || toolCall.response) {
        const resultPayload =
          toolCall.result || toolCall.output || toolCall.response;
        console.log(
          `  Result: ${JSON.stringify(resultPayload, null, 2).substring(0, 200)}...`,
        );
      }
      if (toolCall.error) {
        console.log(`  Error: ${toolCall.error}`);
      }
    });

    if (step.text) {
      console.log(`\n  Step text: ${step.text.substring(0, 100)}...`);
    }
  });

  console.log("\n💬 Final Response:");
  console.log(result.text);
  console.log("\n" + "=".repeat(50) + "\n");
}

/**
 * Internal action to process batched pending messages.
 * This is called by the scheduler after the 4-second batch window closes.
 */
export const processPendingMessages = internalAction({
  args: {
    threadId: v.id("threads"),
    senderId: v.string(),
    pageId: v.string(),
    platform: v.string(),
    simulateOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    try {
      // 1. Fetch all pending messages for this thread
      const pendingMessages: Doc<"pending_messages">[] = await ctx.runQuery(
        api.pendingMessages.getPendingMessages,
        { threadId: args.threadId },
      );

      if (pendingMessages.length === 0) {
        console.log(
          "No pending messages to process for thread:",
          args.threadId,
        );
        // Clear the scheduled job ID since there's nothing to process
        await ctx.runMutation(internal.threads.internalClearScheduledJob, {
          threadId: args.threadId,
        });
        return;
      }

      console.log(
        `Processing ${pendingMessages.length} batched messages for thread:`,
        args.threadId,
      );

      // 2. Concatenate all pending messages into a single message
      // Sort by sequence number to ensure correct order
      const sortedMessages = pendingMessages.sort(
        (a: Doc<"pending_messages">, b: Doc<"pending_messages">) =>
          a.sequenceNumber - b.sequenceNumber,
      );
      const batchedContent = sortedMessages
        .map((m: Doc<"pending_messages">) => m.content)
        .join(". ");

      // Get the first platform message ID for duplicate detection
      const firstPlatformMessageId = sortedMessages.find(
        (m: Doc<"pending_messages">) => m.platformMessageId,
      )?.platformMessageId;

      // 3. Fetch shop and thread info
      const thread = await ctx.runQuery(internal.threads.internalGet, {
        threadId: args.threadId,
      });
      if (!thread) {
        throw new Error(`Thread not found: ${args.threadId}`);
      }

      const shop = await ctx.runQuery(internal.shops.internalGet, {
        shopId: thread.shopId,
      });
      if (!shop) {
        throw new Error(`Shop not found for thread: ${args.threadId}`);
      }

      const storefront = {
        endpoint: shop.shopifyDomain,
        accessToken: shop.shopifyAccessToken,
      };

      const accessToken = shop.metaPageAccessToken;

      // Check if shop-wide agent pause is enabled
      const shopSettings = shop.settings as any;
      if (shopSettings.agentPaused) {
        console.log(
          `Shop agent is paused. Saving messages but skipping AI processing for thread ${args.threadId}`,
        );
        // Save the batched user message for conversation history
        const now = Date.now();
        await ctx.runMutation(internal.messages.internalAddMessage, {
          threadId: args.threadId,
          role: "user",
          content: batchedContent,
          timestamp: now,
          platformMessageId: firstPlatformMessageId,
        });
        // Clear the scheduled job since we're not processing with AI
        await ctx.runMutation(internal.threads.internalClearScheduledJob, {
          threadId: args.threadId,
        });
        await ctx.runMutation(api.pendingMessages.clearPendingMessages, {
          threadId: args.threadId,
        });
        return;
      }

      // Check thread agent status
      const agentStatus = thread.agentStatus ?? "active";
      if (agentStatus === "paused" || agentStatus === "handoff") {
        console.log(
          `Thread ${args.threadId} is ${agentStatus}. Saving messages but skipping AI processing.`,
        );
        // Save the batched user message for conversation history
        const now = Date.now();
        await ctx.runMutation(internal.messages.internalAddMessage, {
          threadId: args.threadId,
          role: "user",
          content: batchedContent,
          timestamp: now,
          platformMessageId: firstPlatformMessageId,
        });
        // Clear the scheduled job since we're not processing with AI
        await ctx.runMutation(internal.threads.internalClearScheduledJob, {
          threadId: args.threadId,
        });
        await ctx.runMutation(api.pendingMessages.clearPendingMessages, {
          threadId: args.threadId,
        });
        return;
      }

      if (!args.simulateOnly) {
        // 4. Show typing indicator during processing
        await sendTypingIndicator({
          recipientId: args.senderId,
          accessToken,
          action: "typing_on",
        });
      }

      // 5. Save the batched user message to the database
      const now = Date.now();
      await ctx.runMutation(internal.messages.internalAddMessage, {
        threadId: args.threadId,
        role: "user",
        content: batchedContent,
        timestamp: now,
        platformMessageId: firstPlatformMessageId,
      });

      // 6. Fetch conversation history (last 12 messages)
      const history: Doc<"messages">[] = await ctx.runQuery(
        internal.messages.internalListByThread,
        {
          threadId: args.threadId,
          limit: 12,
        },
      );

      // 7. Fetch global AI model settings
      const dbSettings = await ctx.runQuery(api.settings.getSettings);

      // 8. Cast settings to correct types
      const settings: ModelSettings = {
        aiProvider: dbSettings.aiProvider as ModelProvider,
        aiModel: dbSettings.aiModel,
        providerOptions: dbSettings.providerOptions,
      };

      // 9. Run AI assistant with the batched message
      const result = await runShopAssistant({
        history: history.map((message: Doc<"messages">) => ({
          // Convert human_agent role to assistant for AI processing
          role: message.role === "human_agent" ? "assistant" : message.role,
          content: message.content,
        })),
        storefront,
        settings,
      });

      logAssistantResult(result);

      // 9. Extract metadata
      const allToolCalls = extractToolCalls(result.steps);
      const model = settings.aiModel;
      const usage = result.totalUsage;

      // Check for handoff request
      const handoffMatch = result.text.match(/\|\|HANDOFF\|\|(.+)?$/);
      const hasHandoff = !!handoffMatch;
      const handoffReason = handoffMatch?.[1]?.trim() || "AI requested handoff";

      // Remove handoff delimiter from the response before processing
      const textWithoutHandoff = result.text
        .replace(/\|\|HANDOFF\|\|.+$/, "")
        .trim();

      // 10. Split response into separate messages if ||SPLIT|| delimiter is present
      const messageParts = textWithoutHandoff
        .split(/\|\|SPLIT\|\|/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      // If no valid parts (shouldn't happen), use the full response
      const partsToSend =
        messageParts.length > 0 ? messageParts : [textWithoutHandoff];

      // 11. Send each part as a separate message with delays
      const baseTimestamp = Date.now();
      for (let i = 0; i < partsToSend.length; i++) {
        const part = partsToSend[i];
        const isFirstMessage = i === 0;
        const isLastMessage = i === partsToSend.length - 1;

        // Add a small delay between messages (not before the first one)
        if (!isFirstMessage) {
          await new Promise((resolve) => setTimeout(resolve, 700)); // 700ms delay for natural pacing
        }

        if (!args.simulateOnly) {
          // Send the message part
          await sendMetaMessage({
            recipientId: args.senderId,
            text: part,
            accessToken,
          });
        }

        // Save each part as a separate message in the database
        await ctx.runMutation(internal.messages.internalAddMessage, {
          threadId: args.threadId,
          role: "assistant",
          content: part,
          timestamp: baseTimestamp + i * 100, // Slight timestamp offset to maintain order
          reasoning:
            isFirstMessage && result.reasoning
              ? JSON.stringify(result.reasoning)
              : undefined,
          toolCalls: isFirstMessage ? allToolCalls : undefined, // Only attach metadata to first part
          aiMetadata: isFirstMessage
            ? {
                model,
                totalTokens: usage?.totalTokens ?? 0,
                reasoningTokens: usage?.reasoningTokens ?? 0,
                inputTokens: usage?.inputTokens ?? 0,
                outputTokens: usage?.outputTokens ?? 0,
                costUsd: calculateCost(
                  model,
                  usage?.inputTokens ?? 0,
                  usage?.outputTokens ?? 0,
                ),
              }
            : undefined,
        });

        console.log(
          `Sent message part ${i + 1}/${partsToSend.length}: "${part.substring(0, 50)}${part.length > 50 ? "..." : ""}"`,
        );
      }

      // If handoff was requested, trigger handoff after sending response
      if (hasHandoff) {
        console.log(
          `Handoff requested for thread ${args.threadId}: ${handoffReason}`,
        );
        await ctx.runMutation(internal.threads.internalRequestHandoff, {
          threadId: args.threadId,
          reason: handoffReason,
        });
      }

      if (!args.simulateOnly) {
        // 12. Turn off typing indicator
        await sendTypingIndicator({
          recipientId: args.senderId,
          accessToken,
          action: "typing_off",
        });
      }

      // 13. Clear pending messages queue
      await ctx.runMutation(api.pendingMessages.clearPendingMessages, {
        threadId: args.threadId,
      });

      // 14. Clear scheduled job ID from thread
      await ctx.runMutation(internal.threads.internalClearScheduledJob, {
        threadId: args.threadId,
      });

      console.log(
        `Successfully processed batch of ${pendingMessages.length} messages`,
      );
    } catch (error) {
      console.error("Error processing pending messages:", error);

      // Clear the pending queue to prevent stuck state
      try {
        await ctx.runMutation(api.pendingMessages.clearPendingMessages, {
          threadId: args.threadId,
        });
        await ctx.runMutation(internal.threads.internalClearScheduledJob, {
          threadId: args.threadId,
        });
      } catch (cleanupError) {
        console.error(
          "Error cleaning up after failed batch processing:",
          cleanupError,
        );
      }

      throw error;
    }
  },
});

/**
 * Retry generating an AI response from a specific point in the conversation.
 * This regenerates the AI response starting from the last user message before the given message.
 */
export const retryMessage = internalAction({
  args: {
    threadId: v.id("threads"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    try {
      // 1. Get the target message to find the retry point
      const targetMessage = await ctx.runQuery(
        internal.messages.internalGetById,
        {
          messageId: args.messageId,
        },
      );
      if (!targetMessage) {
        throw new Error(`Message not found: ${args.messageId}`);
      }

      // 2. Fetch thread and shop info
      const thread = await ctx.runQuery(internal.threads.internalGet, {
        threadId: args.threadId,
      });
      if (!thread) {
        throw new Error(`Thread not found: ${args.threadId}`);
      }

      const shop = await ctx.runQuery(internal.shops.internalGet, {
        shopId: thread.shopId,
      });
      if (!shop) {
        throw new Error(`Shop not found for thread: ${args.threadId}`);
      }

      const storefront: StorefrontConfig = {
        endpoint: shop.shopifyDomain,
        accessToken: shop.shopifyAccessToken,
      };

      const accessToken = shop.metaPageAccessToken;

      // 3. Fetch conversation history up to (and including) the target message
      const history: Doc<"messages">[] = await ctx.runQuery(
        internal.messages.internalListByThread,
        {
          threadId: args.threadId,
          limit: 50,
        },
      );

      // Filter to only include messages up to and including the target message
      const cutoffIndex = history.findIndex((m) => m._id === args.messageId);
      if (cutoffIndex === -1) {
        throw new Error("Target message not found in thread history");
      }

      const historyUpToPoint = history.slice(0, cutoffIndex + 1);

      // Find the last user message for context (we want to regenerate the AI response to this)
      const lastUserMessageIndex = historyUpToPoint
        .map((m, i) => ({ ...m, index: i }))
        .reverse()
        .find((m) => m.role === "user")?.index;

      if (lastUserMessageIndex === undefined) {
        throw new Error("No user message found to retry from");
      }

      // Get history up to and including the last user message
      const retryHistory = historyUpToPoint.slice(0, lastUserMessageIndex + 1);

      // 4. Fetch AI model settings
      const dbSettings = await ctx.runQuery(api.settings.getSettings);

      const settings: ModelSettings = {
        aiProvider: dbSettings.aiProvider as ModelProvider,
        aiModel: dbSettings.aiModel,
        providerOptions: dbSettings.providerOptions,
      };

      // 5. Show typing indicator
      await sendTypingIndicator({
        recipientId: thread.platformUserId,
        accessToken,
        action: "typing_on",
      });

      // 6. Run AI assistant with the historical context
      const tools = createShopifyTools(storefront);
      let model = createModel(settings.aiProvider, settings.aiModel);

      const reasoningEffort = (settings.providerOptions
        ?.openaiReasoningEffort ?? "medium") as "low" | "medium" | "high";
      const thinkingLevel = (settings.providerOptions?.googleThinkingLevel ??
        "high") as "low" | "medium" | "high";

      const providerOptions = getProviderOptions(
        settings.aiProvider,
        reasoningEffort,
        thinkingLevel,
      );

      let result: GenerateTextResponse;
      try {
        result = await generateText({
          model,
          system: ISUPPLY_SYSTEM_PROMPT,
          messages: retryHistory.map((message: Doc<"messages">) => ({
            role: message.role === "human_agent" ? "assistant" : message.role,
            content: message.content,
          })),
          tools,
          providerOptions,
          stopWhen: stepCountIs(10),
        });
      } catch (error: any) {
        // Check for AI_API call errors (model not found, invalid model, etc.)
        if (
          error?.name === "AI_APICallError" ||
          error?.message?.includes("models/") ||
          error?.message?.includes("gemini-2.5-pro-exp")
        ) {
          console.error(
            `AI Model Error: The model "${settings.aiModel}" is not recognized by the ${settings.aiProvider} provider.`,
            error,
          );

          // Try fallback to default Google model
          if (settings.aiProvider === "google") {
            console.log(
              `Attempting fallback to default model: ${GOOGLE_DEFAULT_MODEL}`,
            );
            try {
              model = createModel("google", GOOGLE_DEFAULT_MODEL);
              result = await generateText({
                model,
                system: ISUPPLY_SYSTEM_PROMPT,
                messages: retryHistory.map((message: Doc<"messages">) => ({
                  role:
                    message.role === "human_agent" ? "assistant" : message.role,
                  content: message.content,
                })),
                tools,
                providerOptions,
                stopWhen: stepCountIs(10),
              });
              console.log(
                `Successfully used fallback model: ${GOOGLE_DEFAULT_MODEL}`,
              );
            } catch (fallbackError) {
              console.error("Fallback model also failed:", fallbackError);
              throw new Error(
                `AI model error: Unable to use the configured model "${settings.aiModel}" and the fallback model also failed. Please check your AI model settings.`,
              );
            }
          } else {
            throw new Error(
              `AI model error: The model "${settings.aiModel}" is not recognized by ${settings.aiProvider}. Please check your AI settings and try a different model.`,
            );
          }
        } else {
          // Re-throw other errors
          throw error;
        }
      }

      logAssistantResult(result);

      // 7. Extract metadata
      const allToolCalls = extractToolCalls(result.steps);
      const model_name = settings.aiModel;
      const usage = result.totalUsage;

      // 8. Split response into separate messages if ||SPLIT|| delimiter is present
      const handoffMatch = result.text.match(/\|\|HANDOFF\|\|(.+)?$/);
      const hasHandoff = !!handoffMatch;
      const handoffReason = handoffMatch?.[1]?.trim() || "AI requested handoff";

      const textWithoutHandoff = result.text
        .replace(/\|\|HANDOFF\|\|.+$/, "")
        .trim();

      const messageParts = textWithoutHandoff
        .split(/\|\|SPLIT\|\|/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      const partsToSend =
        messageParts.length > 0 ? messageParts : [textWithoutHandoff];

      // 9. Send each part as a separate message with delays
      const baseTimestamp = Date.now();
      const newMessageIds: string[] = [];

      for (let i = 0; i < partsToSend.length; i++) {
        const part = partsToSend[i];
        const isFirstMessage = i === 0;

        if (!isFirstMessage) {
          await new Promise((resolve) => setTimeout(resolve, 700));
        }

        // Send the message part
        await sendMetaMessage({
          recipientId: thread.platformUserId,
          text: part,
          accessToken,
        });

        // Save each part as a separate message
        const messageId = await ctx.runMutation(
          internal.messages.internalAddMessage,
          {
            threadId: args.threadId,
            role: "assistant",
            content: part,
            timestamp: baseTimestamp + i * 100,
            reasoning:
              isFirstMessage && result.reasoning
                ? JSON.stringify(result.reasoning)
                : undefined,
            toolCalls: isFirstMessage ? allToolCalls : undefined,
            aiMetadata: isFirstMessage
              ? {
                  model: model_name,
                  totalTokens: usage?.totalTokens ?? 0,
                  reasoningTokens: usage?.reasoningTokens ?? 0,
                  inputTokens: usage?.inputTokens ?? 0,
                  outputTokens: usage?.outputTokens ?? 0,
                  costUsd: calculateCost(
                    model_name,
                    usage?.inputTokens ?? 0,
                    usage?.outputTokens ?? 0,
                  ),
                }
              : undefined,
          },
        );

        newMessageIds.push(messageId);

        console.log(
          `Retried message part ${i + 1}/${partsToSend.length}: "${part.substring(0, 50)}${part.length > 50 ? "..." : ""}"`,
        );
      }

      // 10. Handle handoff if requested
      if (hasHandoff) {
        console.log(
          `Handoff requested during retry for thread ${args.threadId}: ${handoffReason}`,
        );
        await ctx.runMutation(internal.threads.internalRequestHandoff, {
          threadId: args.threadId,
          reason: handoffReason,
        });
      }

      // 11. Turn off typing indicator
      await sendTypingIndicator({
        recipientId: thread.platformUserId,
        accessToken,
        action: "typing_off",
      });

      console.log(
        `Successfully retried message generation, created ${newMessageIds.length} message(s)`,
      );

      return { success: true, messageIds: newMessageIds };
    } catch (error) {
      console.error("Error retrying message:", error);
      throw error;
    }
  },
});
