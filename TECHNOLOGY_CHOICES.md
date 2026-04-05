# Technology Choices

> These choices were made during API Discovery and inform the implementation plan.

## Selected Technologies

### Database + Backend: Supabase (Cloud)
- **Why**: User-requested migration from Firebase. Relational data model, built-in RLS, real-time subscriptions, and integrated auth/storage in one platform.
- **SDK**: `@supabase/supabase-js`
- **API Keys**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Key Features**: PostgreSQL, Row-Level Security, Realtime subscriptions, Edge Functions, Storage
- **Docs**: https://supabase.com/docs

### Authentication: Supabase Auth
- **Why**: Bundled with Supabase. Supports all social providers, magic link, and LinkedIn OIDC natively.
- **SDK**: Included in `@supabase/supabase-js`
- **API Keys**: Configured via Supabase dashboard (Google, LinkedIn, GitHub OAuth credentials)
- **Key Features**: Google OAuth, LinkedIn OIDC (profile data import), magic link (passwordless), GitHub, multi-provider linking
- **Docs**: https://supabase.com/docs/guides/auth

### Storage: Supabase Storage
- **Why**: Bundled with Supabase. Replaces Firebase Storage for avatars and file uploads.
- **SDK**: Included in `@supabase/supabase-js`
- **Key Features**: Public/private buckets, image transformations, RLS policies on storage
- **Docs**: https://supabase.com/docs/guides/storage

### ~~AI/LLM: Anthropic Claude~~ — REMOVED
- **Reason**: Dropped from scope. No AI content moderation or MCP server. Admin moderation is manual via dashboard UI.

### ~~MCP Server~~ — REMOVED
- **Reason**: Dropped along with Anthropic. Admin operations handled entirely through the shadcn/ui dashboard.

### Admin UI Components: shadcn/ui
- **Why**: Copy-paste Radix + Tailwind components. Fits existing Tailwind v4 setup. Provides tables, forms, dialogs needed for the admin dashboard.
- **SDK**: `shadcn` (CLI), components copied into project
- **Key Features**: Data tables, forms, dialogs, dropdowns, command palette, all accessible and themeable
- **Docs**: https://ui.shadcn.com

### LinkedIn API: LinkedIn OIDC via Supabase Auth
- **Why**: Supabase has native LinkedIn OIDC provider support. Pulls profile data (name, role, company, avatar) on first login.
- **SDK**: Handled by Supabase Auth — no separate SDK needed
- **API Keys**: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` (configured in Supabase dashboard)
- **Key Features**: OpenID Connect profile claims, automatic profile data on sign-in
- **Docs**: https://supabase.com/docs/guides/auth/social-login/auth-linkedin

## Carried Over

### Existing Gemini API Key
- `GEMINI_API_KEY` in `.env.local` — retained for any existing AI features. Not used for new moderation/admin features.

## Environment Variables Summary

| Variable | Service | Status |
|----------|---------|--------|
| `VITE_SUPABASE_URL` | Supabase | ✅ Configured |
| `VITE_SUPABASE_ANON_KEY` | Supabase | ✅ Configured |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (admin ops) | ✅ Configured |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth | ⏳ Pending (Release 2) |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth | ⏳ Pending (Release 2) |
| `GEMINI_API_KEY` | Google Gemini | Existing |

> **Note**: Supabase env vars use `NEXT_PUBLIC_` prefix convention but this is a Vite project — they'll be exposed via `import.meta.env.VITE_SUPABASE_URL` etc. The actual prefix will be `VITE_` in implementation.
