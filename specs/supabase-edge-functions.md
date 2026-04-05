# Supabase Edge Functions

## Overview

Supabase Edge Functions are server-side TypeScript functions that run on Deno. They execute on Supabase's global edge network and are ideal for webhooks, background tasks, admin API endpoints, and any logic that shouldn't run on the client. For Decarb Connect, they will serve as admin API endpoints consumed by both the dashboard and MCP server.

## Installation

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Initialize Supabase in the project (creates supabase/ directory)
supabase init

# Create a new edge function
supabase functions new <function-name>
```

This creates a file at `supabase/functions/<function-name>/index.ts` with starter code.

## Configuration

### Environment Variables

Edge Functions have these **automatically injected** environment variables (no setup needed):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your project's API URL |
| `SUPABASE_ANON_KEY` | Public anon key (respects RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS — admin access) |
| `SB_PUBLISHABLE_KEY` | Publishable key for JWT validation |

Custom secrets are set via CLI:

```bash
# Set individual secrets
supabase secrets set MY_API_KEY=sk-xxx

# Set from .env file
supabase secrets set --env-file supabase/functions/.env
```

Access in code:

```typescript
const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
```

### Function Configuration (config.toml)

```toml
[functions.my_function]
enabled = true           # Controls deploy/serve (default: true)
verify_jwt = true        # Require valid JWT in Authorization header (default: true)
import_map = "supabase/functions/my_function/deno.json"  # Custom import map
entrypoint = "path/to/custom/function.ts"                # Custom entrypoint
static_files = ["./functions/my_function/*.html"]         # Bundled static files
```

## Key Patterns

### Basic Edge Function

```typescript
// supabase/functions/hello-world/index.ts
Deno.serve(async (req) => {
  const { name } = await req.json()

  const data = {
    message: `Hello ${name}!`,
    timestamp: new Date().toISOString(),
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
```

### Admin Endpoint with Service Role Key (Bypasses RLS)

Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations that need full database access:

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Service role client — bypasses Row Level Security
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data, error } = await supabase.from('users').select('*')

  return new Response(JSON.stringify({ data, error }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### JWT Authentication (Validate Caller Identity)

Validate the user's JWT token to identify the caller and enforce authorization:

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SB_PUBLISHABLE_KEY')!
)

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')!
  const token = authHeader.replace('Bearer ', '')

  const { data, error } = await supabase.auth.getClaims(token)
  const userEmail = data?.claims?.email

  if (!userEmail || error) {
    return Response.json({ msg: 'Invalid JWT' }, { status: 401 })
  }

  return Response.json({ message: `hello ${userEmail}` })
})
```

### CORS Handling (Browser Invocation)

Required when calling edge functions from a browser. Use the SDK's built-in CORS headers (v2.95.0+):

```typescript
import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name } = await req.json()
    const data = { message: `Hello ${name}!` }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
```

### Admin API Pattern (Dashboard + MCP Server)

Combined pattern for an admin endpoint that validates a service-level auth token and uses the service role for database access:

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Validate admin token (shared secret between dashboard/MCP and edge function)
  const authHeader = req.headers.get('Authorization')
  const adminToken = Deno.env.get('ADMIN_API_TOKEN')

  if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
    return Response.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: corsHeaders,
    })
  }

  // Use service role for full database access
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Route based on path or method
  const url = new URL(req.url)
  const path = url.pathname.split('/').pop()

  switch (path) {
    case 'users':
      const { data } = await supabase.from('users').select('*')
      return Response.json({ data }, { headers: corsHeaders })
    case 'stats':
      const { count } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
      return Response.json({ total_connections: count }, { headers: corsHeaders })
    default:
      return Response.json({ error: 'Not found' }, {
        status: 404,
        headers: corsHeaders,
      })
  }
})
```

## Local Development

```bash
# Start local Supabase services (DB, Auth, etc.)
supabase start

# Serve functions locally with hot reloading
supabase functions serve

# Test with curl
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/hello-world' \
  --header 'Authorization: Bearer <ANON_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{"name":"Functions"}'
```

## Deployment

```bash
# Deploy a single function
supabase functions deploy hello-world

# Deploy all functions
supabase functions deploy

# Deploy without JWT verification (public endpoint)
supabase functions deploy my-function --no-verify-jwt

# Set secrets for production
supabase secrets set --env-file supabase/functions/.env
```

## API Reference

| Method / Command | Description | Example |
|------------------|-------------|---------|
| `supabase functions new <name>` | Scaffold a new edge function | `supabase functions new admin-api` |
| `supabase functions serve` | Serve all functions locally with hot reload | `supabase functions serve` |
| `supabase functions deploy <name>` | Deploy a single function | `supabase functions deploy admin-api` |
| `supabase functions deploy` | Deploy all functions | `supabase functions deploy` |
| `supabase secrets set KEY=VAL` | Set encrypted production secrets | `supabase secrets set ADMIN_API_TOKEN=xxx` |
| `supabase secrets set --env-file .env` | Set secrets from file | `supabase secrets set --env-file .env` |
| `Deno.env.get('KEY')` | Read env var / secret in function | `Deno.env.get('SUPABASE_URL')` |
| `Deno.serve(handler)` | Register the request handler | See examples above |

## Gotchas

- **JWT verification is ON by default.** Every request must include a valid JWT in the `Authorization: Bearer <token>` header unless you set `verify_jwt = false` in config or deploy with `--no-verify-jwt`. For MCP/server-to-server calls, you may want to disable JWT verification and use a custom shared secret instead.
- **Service role key bypasses RLS entirely.** Never expose it to the client. Only use in edge functions for admin operations.
- **CORS must be handled manually.** Browser calls will fail without the `OPTIONS` preflight handler. Use `@supabase/supabase-js/cors` (v2.95.0+) for consistent headers.
- **Deno runtime, not Node.js.** Use `npm:` prefix for npm packages (`npm:@supabase/supabase-js@2`), `jsr:` for JSR packages, or URL imports from `esm.sh`. No `node_modules`.
- **Environment variables are auto-injected.** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are available automatically — don't set them manually as secrets.
- **Cold starts exist** but are mitigated by the edge network. Keep function bundles small for faster cold starts.
- **One function = one file entry point.** Each function lives in `supabase/functions/<name>/index.ts`. You can import shared code from a `_shared/` directory.
- **Secrets are encrypted at rest.** Set them via `supabase secrets set`, not in committed files.
- **Request body can only be read once.** If you need to read `req.json()` or `req.text()` multiple times, clone the request first: `const clone = req.clone()`.

## Shared Code Between Functions

Place shared utilities in `supabase/functions/_shared/`:

```
supabase/functions/
├── _shared/
│   ├── cors.ts
│   └── supabaseAdmin.ts
├── admin-users/
│   └── index.ts
└── admin-stats/
    └── index.ts
```

```typescript
// supabase/functions/_shared/supabaseAdmin.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
```

```typescript
// supabase/functions/admin-users/index.ts
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const { data } = await supabaseAdmin.from('users').select('*')
  return Response.json({ data }, { headers: corsHeaders })
})
```

## References

- [Edge Functions Quickstart](https://supabase.com/docs/guides/functions/quickstart)
- [Edge Functions Auth](https://supabase.com/docs/guides/functions/auth)
- [Edge Functions CORS](https://supabase.com/docs/guides/functions/cors)
- [Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
- [CLI Config Reference](https://supabase.com/docs/guides/local-development/cli/config)
