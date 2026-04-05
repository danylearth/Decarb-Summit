# MCP TypeScript SDK

## Overview

The `@modelcontextprotocol/sdk` (v2) provides a high-level API for building MCP servers in TypeScript. Servers expose **tools**, **resources**, and **prompts** that LLM clients can discover and invoke. The SDK handles all protocol-level communication — you register capabilities and write handlers.

## Installation

```bash
npm install @modelcontextprotocol/server zod
```

For Node.js HTTP transport:
```bash
npm install @modelcontextprotocol/node
```

For Express integration:
```bash
npm install @modelcontextprotocol/express
```

> **Important:** The SDK uses **Zod v4**. Import as `import * as z from 'zod/v4'`.

## Configuration

### Environment Variables

No environment variables are required by the SDK itself. Your server's tools may need their own env vars (API keys, database URLs, etc.) — those are your responsibility.

### Initialization

```typescript
import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const server = new McpServer(
  {
    name: 'my-server',
    version: '1.0.0'
  },
  {
    capabilities: { logging: {} }
  }
);

// Connect via stdio (most common for local/CLI integrations)
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Key Patterns

### Registering a Tool (v2 API — `registerTool`)

This is the **current v2 API**. Tools are registered with a name, a config object containing schemas, and a handler function.

```typescript
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { CallToolResult } from '@modelcontextprotocol/server';

const server = new McpServer({ name: 'my-server', version: '1.0.0' });

server.registerTool(
  'calculate-bmi',
  {
    title: 'BMI Calculator',
    description: 'Calculate Body Mass Index',
    inputSchema: z.object({
      weightKg: z.number().describe('Weight in kilograms'),
      heightM: z.number().describe('Height in meters')
    }),
    outputSchema: z.object({ bmi: z.number() })
  },
  async ({ weightKg, heightM }): Promise<CallToolResult> => {
    const bmi = weightKg / (heightM * heightM);
    return {
      content: [{ type: 'text', text: `BMI: ${bmi.toFixed(2)}` }],
      structuredContent: { bmi }
    };
  }
);
```

### Tool with Context (Logging & Server Requests)

The second argument to the handler is a `ctx` object with access to `ctx.mcpReq` for logging and server-initiated requests.

```typescript
server.registerTool(
  'fetch-data',
  {
    description: 'Fetch data from an API',
    inputSchema: z.object({ url: z.string() })
  },
  async ({ url }, ctx): Promise<CallToolResult> => {
    await ctx.mcpReq.log('info', `Fetching ${url}`);
    const res = await fetch(url);
    const text = await res.text();
    await ctx.mcpReq.log('debug', `Response status: ${res.status}`);
    return { content: [{ type: 'text', text }] };
  }
);
```

### Shorthand Tool Registration (v1-style, still works)

For simple tools, the shorthand `.tool()` method accepts a raw Zod shape (not wrapped in `z.object()`):

```typescript
server.tool(
  'greet',
  { name: z.string() },
  async ({ name }) => {
    return { content: [{ type: 'text', text: `Hello, ${name}!` }] };
  }
);
```

### Stdio Transport (Local / CLI)

The simplest transport — communicates over stdin/stdout. Used when the MCP client spawns your server as a child process.

```typescript
import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server';

const server = new McpServer({ name: 'my-server', version: '1.0.0' });
// ... register tools ...

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Streamable HTTP Transport (Remote / Web)

For remote servers accessible over HTTP. Replaces the legacy SSE transport in v2. Supports session management and SSE streaming.

```typescript
import { randomUUID } from 'node:crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer, isInitializeRequest } from '@modelcontextprotocol/server';

const app = createMcpExpressApp();
const transports: Record<string, NodeStreamableHTTPServerTransport> = {};

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res, req.body);
    return;
  }

  if (!sessionId && isInitializeRequest(req.body)) {
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports[id] = transport;
      }
    });

    transport.onclose = () => {
      if (transport.sessionId) delete transports[transport.sessionId];
    };

    const server = new McpServer({ name: 'my-server', version: '1.0.0' });
    // ... register tools on server ...
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Invalid session' },
    id: null
  });
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res);
  } else {
    res.status(400).send('Invalid session');
  }
});

app.listen(3000, '127.0.0.1');
```

## API Reference

| Method | Description | Example |
|--------|-------------|---------|
| `new McpServer(info, opts?)` | Create server instance | `new McpServer({ name: 'x', version: '1.0.0' })` |
| `server.registerTool(id, config, handler)` | Register a tool (v2 API) | See examples above |
| `server.tool(name, schema, handler)` | Register a tool (v1 shorthand) | `server.tool('greet', { name: z.string() }, handler)` |
| `server.connect(transport)` | Connect server to a transport | `await server.connect(new StdioServerTransport())` |
| `new StdioServerTransport()` | Stdio transport (local) | Used with `server.connect()` |
| `new NodeStreamableHTTPServerTransport(opts)` | HTTP transport (remote) | See HTTP example above |
| `isInitializeRequest(body)` | Check if request is an init handshake | Guard for new session creation |
| `ctx.mcpReq.log(level, msg)` | Log from within a tool handler | `await ctx.mcpReq.log('info', 'message')` |

### `registerTool` Config Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | No | Human-readable tool title |
| `description` | `string` | Yes | What the tool does (shown to LLMs) |
| `inputSchema` | `z.ZodObject` | Yes | Zod v4 schema for input parameters |
| `outputSchema` | `z.ZodObject` | No | Zod v4 schema for structured output |

### Tool Handler Return Type (`CallToolResult`)

```typescript
{
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>;
  structuredContent?: Record<string, unknown>; // Must match outputSchema if provided
}
```

## Gotchas

- **Zod v4 required.** Import as `import * as z from 'zod/v4'` — not the default `zod` import. The SDK uses Standard Schema, which requires Zod v4.
- **v1 → v2 migration.** The `.tool()` shorthand accepted raw Zod shapes (`{ name: z.string() }`). The v2 `.registerTool()` requires schemas wrapped in `z.object()` and passed as `inputSchema`/`outputSchema` in a config object.
- **SSE server transport removed in v2.** Server-side SSE is gone. Use `NodeStreamableHTTPServerTransport` (Streamable HTTP) instead. Client-side SSE transport still exists for connecting to legacy servers.
- **Stdio servers must not write to stdout.** Any `console.log()` in a stdio server will corrupt the protocol stream. Use `console.error()` for debug output, or use the `ctx.mcpReq.log()` API inside tool handlers.
- **`structuredContent` must match `outputSchema`.** If you define an `outputSchema`, the `structuredContent` in your return value is validated against it. Mismatches will cause errors.
- **One server per transport.** Each `McpServer.connect()` call binds to one transport instance. For HTTP with multiple sessions, create a new server+transport pair per session (see HTTP example).

## References

- [TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk)
- [Server Documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)
- [Migration Guide (v1 → v2)](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration.md)
- [MCP Specification](https://spec.modelcontextprotocol.io)
