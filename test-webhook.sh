#!/bin/bash

# Test Messenger Webhook locally
# This sends a test message to your local Next.js dev server

# Set your local server URL (change if running on different port)
WEBHOOK_URL="http://localhost:3000/api/webhooks/messenger"

# Test message payload mimicking Meta Messenger format
# You can modify the message.text field to test different queries
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [
      {
        "id": "123456789",
        "time": 1234567890,
        "messaging": [
          {
            "sender": {
              "id": "test_user_123"
            },
            "recipient": {
              "id": "123456789"
            },
            "timestamp": 1234567890000,
            "message": {
              "mid": "test_message_id_123",
              "text": "Do you have iPhone 17 Air?"
            }
          }
        ]
      }
    ]
  }'

echo -e "\n\n✅ Request sent! Check your terminal running 'pnpm dev' to see the logs."
echo "💡 Look for:"
echo "   - '📨 Webhook received:' (incoming request)"
echo "   - '📩 Message from test_user_123:' (message details)"
echo "   - Tool execution logs"
echo "   - Response generation"
