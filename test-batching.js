#!/usr/bin/env node

/**
 * Test script for message batching functionality
 *
 * Usage:
 *   node test-batching.js [options]
 *
 * Options:
 *   --platform=messenger|instagram    Platform to test (default: messenger)
 *   --messages=3                      Number of messages to send (default: 3)
 *   --delay=1000                      Delay between messages in ms (default: 1000)
 *   --wait=5000                       Wait time after last message to check response (default: 5000)
 *   --url=http://localhost:3000       Webhook URL (default: http://localhost:3000)
 *
 * Examples:
 *   node test-batching.js                                    # Basic test with 3 messages
 *   node test-batching.js --messages=5 --delay=500          # 5 messages, 500ms apart
 *   node test-batching.js --platform=instagram              # Test Instagram webhook
 *   node test-batching.js --url=https://ngrok.io/webhooks   # Test deployed version
 */

const args = process.argv.slice(2);

// Parse command line arguments
function parseArgs() {
  const defaults = {
    platform: "messenger",
    messages: 3,
    delay: 1000,
    wait: 5000,
    url: "http://localhost:3000",
  };

  args.forEach((arg) => {
    if (arg.startsWith("--platform=")) {
      defaults.platform = arg.split("=")[1];
    } else if (arg.startsWith("--messages=")) {
      defaults.messages = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--delay=")) {
      defaults.delay = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--wait=")) {
      defaults.wait = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--url=")) {
      defaults.url = arg.split("=")[1];
    }
  });

  return defaults;
}

const config = parseArgs();

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logDivider() {
  console.log(`${colors.dim}${"─".repeat(60)}${colors.reset}`);
}

// Generate test messages
function generateTestMessages(count) {
  const messages = [
    "Hey there!",
    "Do you have any iPhones in stock?",
    "Looking for the iPhone 16 Pro specifically",
    "What colors do you have?",
    "And what are the prices?",
    "Do you offer any warranty?",
    "Can I come by today to check them out?",
    "What are your store hours?",
    "Thanks for the help!",
    "One more thing - do you have AirPods too?",
  ];

  return messages.slice(0, count);
}

// Create webhook payload for Meta
function createWebhookPayload(platform, senderId, messageText, messageIndex) {
  const timestamp = Date.now();
  const messageId = `test_msg_${timestamp}_${messageIndex}`;

  if (platform === "messenger") {
    return {
      object: "page",
      entry: [
        {
          id: "421654138382968",
          time: timestamp,
          messaging: [
            {
              sender: { id: senderId },
              recipient: { id: "421654138382968" },
              timestamp: timestamp,
              message: {
                mid: messageId,
                text: messageText,
              },
            },
          ],
        },
      ],
    };
  } else {
    // Instagram
    return {
      object: "instagram",
      entry: [
        {
          id: "test_instagram_account_id",
          time: timestamp,
          messaging: [
            {
              sender: { id: senderId },
              recipient: { id: "test_instagram_account_id" },
              timestamp: timestamp,
              message: {
                mid: messageId,
                text: messageText,
              },
            },
          ],
        },
      ],
    };
  }
}

// Send webhook request
async function sendWebhook(url, payload, platform) {
  const endpoint =
    platform === "messenger"
      ? `${url}/api/webhooks/messenger`
      : `${url}/api/webhooks/instagram`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return {
      status: response.status,
      statusText: response.statusText,
      body: await response.text(),
    };
  } catch (error) {
    return {
      status: 0,
      statusText: "Error",
      body: error.message,
      error: true,
    };
  }
}

// Delay function
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main test function
async function runTest() {
  const {
    platform,
    messages: messageCount,
    delay: delayMs,
    wait,
    url,
  } = config;

  log("🧪 Message Batching Test", "bright");
  logDivider();
  log(`Platform: ${colors.cyan}${platform}${colors.reset}`);
  log(`Messages: ${colors.cyan}${messageCount}${colors.reset}`);
  log(`Delay: ${colors.cyan}${delayMs}ms${colors.reset}`);
  log(`Wait after last: ${colors.cyan}${wait}ms${colors.reset}`);
  log(`Webhook URL: ${colors.cyan}${url}${colors.reset}`);
  logDivider();

  const senderId = `test_user_${Date.now()}`;
  const testMessages = generateTestMessages(messageCount);

  log(
    `\n📤 Sending ${messageCount} messages from test user: ${colors.yellow}${senderId}${colors.reset}\n`,
  );

  const results = [];
  const startTime = Date.now();

  // Send messages
  for (let i = 0; i < testMessages.length; i++) {
    const messageText = testMessages[i];
    const payload = createWebhookPayload(platform, senderId, messageText, i);

    log(
      `[${i + 1}/${messageCount}] Sending: "${colors.bright}${messageText}${colors.reset}"`,
    );

    const sendStart = Date.now();
    const result = await sendWebhook(url, payload, platform);
    const sendDuration = Date.now() - sendStart;

    results.push({
      message: messageText,
      ...result,
      duration: sendDuration,
    });

    if (result.error) {
      log(`   ❌ Error: ${result.body}`, "red");
    } else if (result.status === 200) {
      log(`   ✅ Queued (${sendDuration}ms)`, "green");
    } else {
      log(`   ⚠️  HTTP ${result.status}: ${result.body}`, "yellow");
    }

    // Wait before next message (except for the last one)
    if (i < testMessages.length - 1) {
      await delay(delayMs);
    }
  }

  const totalSendTime = Date.now() - startTime;

  log(`\n⏱️  All messages sent in ${totalSendTime}ms`);
  log(`⏳ Waiting ${wait}ms for batch processing to complete...\n`);

  await delay(wait);

  // Summary
  logDivider();
  log("📊 Test Summary", "bright");
  logDivider();

  const successCount = results.filter((r) => r.status === 200).length;
  const errorCount = results.filter((r) => r.error).length;

  log(`Total messages sent: ${messageCount}`);
  log(`Successfully queued: ${colors.green}${successCount}${colors.reset}`);
  log(`Errors: ${colors.red}${errorCount}${colors.reset}`);
  log(`Total time: ${totalSendTime}ms`);

  log(
    `\n${colors.dim}Note: Check your Convex dashboard to see the batch processing in action!${colors.reset}`,
  );
  log(`${colors.dim}Look for:${colors.reset}`);
  log(
    `  ${colors.dim}- pending_messages table (should briefly show messages)${colors.reset}`,
  );
  log(
    `  ${colors.dim}- messages table (should show 1 batched user message + 1 assistant response)${colors.reset}`,
  );
  log(
    `  ${colors.dim}- Scheduler logs (should show job scheduling/cancellation)${colors.reset}`,
  );

  logDivider();
  log("✨ Test complete!", "green");
}

// Run the test
runTest().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
