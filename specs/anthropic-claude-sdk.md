# Anthropic Claude SDK

## Overview

The `@anthropic-ai/sdk` package provides TypeScript/JavaScript access to the Anthropic REST API for interacting with Claude models. For Decarb Connect, we'll use it for content moderation (community feed posts/comments) and admin intelligence features (summarization, flagging).

## Installation

```bash
npm install @anthropic-ai/sdk
```

For Zod-based tool definitions (recommended):

```bash
npm install @anthropic-ai/sdk zod
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key (auto-read by SDK) |

Add to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

> **Important:** This SDK is server-side only. Since Decarb Connect is Firebase-only (no server), Claude API calls must run in a Vercel Serverless Function (`/api/*` route) or Firebase Cloud Function — never in client-side code.

### Initialization

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // default — can be omitted if env var is set
});
```

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `process.env.ANTHROPIC_API_KEY` | Your API key |
| `baseURL` | `string` | `https://api.anthropic.com` | API base URL |
| `timeout` | `number` | `600000` (10 min) | Request timeout in ms |
| `maxRetries` | `number` | `2` | Automatic retry attempts |
| `defaultHeaders` | `object` | `undefined` | Custom headers for every request |

## Key Patterns

### 1. Basic Message Creation

```typescript
const message = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude' }],
});

console.log(message.content); // [{ type: 'text', text: '...' }]
```

### 2. Content Moderation

Use a system prompt to create a moderation classifier for community feed posts:

```typescript
async function moderateContent(text: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 256,
    system: `You are a content moderator for a professional industrial decarbonization summit networking app. 
Evaluate the following post for: spam, harassment, off-topic content, or inappropriate material.
Respond with JSON only: { "allowed": boolean, "reason": string | null }`,
    messages: [{ role: 'user', content: text }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(responseText);
}
```

### 3. Tool Use (Function Calling)

Define tools with JSON Schema, then handle the tool-use loop:

```typescript
const tools: Anthropic.Tool[] = [
  {
    name: 'get_user_profile',
    description: 'Look up an attendee profile by ID',
    input_schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The user ID to look up' },
      },
      required: ['userId'],
    },
  },
];

const message = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  tools,
  messages: [{ role: 'user', content: 'Tell me about user abc123' }],
});

// Check if Claude wants to use a tool
if (message.stop_reason === 'tool_use') {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );

  if (toolUse) {
    // Execute the tool with your own logic
    const result = await executeToolCall(toolUse.name, toolUse.input);

    // Send result back to Claude
    const finalResponse = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      tools,
      messages: [
        { role: 'user', content: 'Tell me about user abc123' },
        { role: 'assistant', content: message.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            },
          ],
        },
      ],
    });
  }
}
```

### 4. Tool Use with Zod (Simplified)

The SDK provides a `betaZodTool` helper that auto-manages the tool-call loop:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const client = new Anthropic();

const moderationTool = betaZodTool({
  name: 'flag_content',
  description: 'Flag a post for admin review',
  inputSchema: z.object({
    postId: z.string().describe('The post ID to flag'),
    reason: z.enum(['spam', 'harassment', 'off-topic', 'inappropriate']),
    severity: z.enum(['low', 'medium', 'high']),
  }),
  run: async ({ postId, reason, severity }) => {
    // Your flagging logic here
    await flagPostForReview(postId, reason, severity);
    return `Post ${postId} flagged as ${reason} (${severity})`;
  },
});

const finalMessage = await client.beta.messages.toolRunner({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  tools: [moderationTool],
  messages: [{ role: 'user', content: 'Review recent posts for policy violations' }],
  max_iterations: 10,
});
```

### 5. Streaming Responses

For real-time UI updates (e.g., admin chat interface):

```typescript
const stream = client.messages.stream({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Summarize today\'s summit activity' }],
});

// Event-driven handling
stream.on('text', (textDelta, textSnapshot) => {
  // Send delta to client via SSE or WebSocket
  console.log(textDelta);
});

stream.on('error', (error) => {
  console.error('Stream error:', error);
});

// Or use async iterator
for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    process.stdout.write(event.delta.text);
  }
}

// Get final result
const finalMessage = await stream.finalMessage();
const finalText = await stream.finalText();
```

#### MessageStream API

| Method / Property | Returns | Description |
|-------------------|---------|-------------|
| `.on('text', cb)` | void | Fires on each text delta with `(textDelta, textSnapshot)` |
| `.on('message', cb)` | void | Fires when message is complete |
| `.on('error', cb)` | void | Fires on stream error |
| `.on('connect', cb)` | void | Fires when connection established |
| `.abort()` | void | Aborts the stream and network request |
| `await .done()` | void | Resolves when stream completes |
| `await .finalMessage()` | `Message` | Resolves with the complete message |
| `await .finalText()` | `string` | Resolves with the final text content |
| `.currentMessage` | `Message \| undefined` | Current accumulated message state |
| `.controller` | `AbortController` | Underlying abort controller |

## API Reference

### `client.messages.create(params)`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | `string` | Yes | Model ID (e.g., `'claude-sonnet-4-5-20250929'`) |
| `max_tokens` | `number` | Yes | Max tokens to generate |
| `messages` | `Message[]` | Yes | Conversation messages array |
| `system` | `string` | No | System prompt |
| `tools` | `Tool[]` | No | Available tools for function calling |
| `temperature` | `number` | No | Sampling temperature (0-1) |
| `top_p` | `number` | No | Nucleus sampling parameter |
| `stop_sequences` | `string[]` | No | Custom stop sequences |
| `stream` | `boolean` | No | Enable streaming (use `.stream()` helper instead) |

### Response Shape

```typescript
interface Message {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];  // TextBlock | ToolUseBlock
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

## Gotchas

1. **Server-side only** — The SDK exposes your API key. Never import it in client-side React code. Use a Vercel Serverless Function or Firebase Cloud Function as a proxy.

2. **`max_tokens` is required** — Unlike some other AI SDKs, you must always specify `max_tokens`. There is no default.

3. **Tool use requires a loop** — When `stop_reason === 'tool_use'`, Claude is not done. You must execute the tool and send results back in a follow-up message. The `toolRunner` helper automates this.

4. **Content blocks are arrays** — `message.content` is always an array of blocks (text, tool_use), not a plain string. Always check `block.type`.

5. **Retries are automatic** — The SDK retries failed requests twice by default. Set `maxRetries: 0` to disable.

6. **10-minute default timeout** — The default timeout is 600,000ms. For short moderation calls, set a lower timeout to fail fast:
   ```typescript
   const client = new Anthropic({ timeout: 30_000 }); // 30s
   ```

7. **`ANTHROPIC_API_KEY` env var is auto-read** — If the env var is set, you can omit `apiKey` from the constructor entirely.

8. **Model IDs include dates** — Always use the full model ID with date suffix (e.g., `claude-sonnet-4-5-20250929`), not shorthand.

## Rate Limits

Rate limits depend on your Anthropic plan tier. Key limits:

| Tier | Requests/min | Input tokens/min | Output tokens/min |
|------|-------------|-------------------|-------------------|
| Tier 1 (free) | 50 | 40,000 | 8,000 |
| Tier 2 | 1,000 | 80,000 | 16,000 |
| Tier 3 | 2,000 | 160,000 | 32,000 |
| Tier 4 | 4,000 | 400,000 | 80,000 |

The SDK automatically retries on `429` rate-limit errors (up to `maxRetries`). For production moderation workloads, consider batching with `client.messages.batches.create()` for async processing at higher throughput.

## Recommended Models for Our Use Cases

| Use Case | Recommended Model | Reason |
|----------|-------------------|--------|
| Content moderation | `claude-haiku-4-5-20251001` | Fast, cheap, sufficient for classification |
| Post summarization | `claude-sonnet-4-5-20250929` | Good balance of quality and cost |
| Admin intelligence / complex analysis | `claude-sonnet-4-5-20250929` | High quality reasoning |

## References

- [Official TypeScript SDK README](https://github.com/anthropics/anthropic-sdk-typescript)
- [API Reference](https://docs.anthropic.com/en/api)
- [Tool Use Guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Content Moderation Guide](https://docs.anthropic.com/en/docs/about-claude/use-case-guides/content-moderation)
- [Streaming Guide](https://docs.anthropic.com/en/api/streaming)
