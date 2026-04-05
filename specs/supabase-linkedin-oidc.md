# Supabase LinkedIn OIDC

## Overview

LinkedIn OpenID Connect (OIDC) provider via Supabase Auth enables "Sign In with LinkedIn" for your application. On first login, Supabase receives an ID token from LinkedIn containing profile claims (name, email, avatar, locale) and stores them in `user_metadata` and `identity_data`. This replaces the deprecated legacy LinkedIn OAuth provider.

## Installation

No additional packages beyond the Supabase client:

```bash
npm install @supabase/supabase-js
```

## Configuration

### 1. LinkedIn Developer Dashboard

1. Go to [LinkedIn Developer Dashboard](https://www.linkedin.com/developers/apps) and click **Create App**
2. Provide your LinkedIn Page and App Logo, then save
3. Navigate to the **Products** tab and request access to **"Sign In with LinkedIn using OpenID Connect"**
4. Go to the **Auth** tab:
   - Note the **Client ID** and **Client Secret**
   - Add the callback URL to **Authorized Redirect URLs**

### 2. Callback URL

| Environment | URL |
|---|---|
| Production | `https://<project-ref>.supabase.co/auth/v1/callback` |
| Local dev | `http://localhost:54321/auth/v1/callback` |

### 3. Supabase Dashboard

1. Go to **Authentication > Sign In / Providers**
2. Expand **LinkedIn (OIDC)**
3. Toggle **Enable**, paste Client ID and Client Secret
4. Save

### 4. Supabase CLI (`config.toml`)

```toml
[auth.external.linkedin_oidc]
enabled = true
client_id = "env(LINKEDIN_CLIENT_ID)"
secret = "env(LINKEDIN_CLIENT_SECRET)"
```

### 5. Management API (alternative)

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_linkedin_oidc_enabled": true,
    "external_linkedin_oidc_client_id": "your-linkedin-client-id",
    "external_linkedin_oidc_secret": "your-linkedin-client-secret"
  }'
```

### Environment Variables

| Variable | Description |
|---|---|
| `LINKEDIN_CLIENT_ID` | OAuth app Client ID from LinkedIn Developer Dashboard |
| `LINKEDIN_CLIENT_SECRET` | OAuth app Client Secret from LinkedIn Developer Dashboard |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase publishable anon key |

## Key Patterns

### Basic Sign-In (Implicit Flow)

```typescript
async function signInWithLinkedIn() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
  })
}
```

### Sign-In with Redirect (PKCE Flow - for SSR)

```typescript
async function signInWithLinkedIn() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
    options: {
      redirectTo: 'https://your-app.com/auth/callback',
    },
  })
}
```

Callback route handler:

```typescript
// /auth/callback route
const code = url.searchParams.get('code')
if (code) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
}
```

### Accessing Profile Data After Login

```typescript
// Get the current user
const { data: { user } } = await supabase.auth.getUser()

// Profile fields from LinkedIn are in user_metadata
const { full_name, avatar_url, email } = user.user_metadata

// Or access identity-specific data
const linkedinIdentity = user.identities?.find(
  (id) => id.provider === 'linkedin_oidc'
)
const identityData = linkedinIdentity?.identity_data
// identityData contains: sub, name, given_name, family_name, picture, email, email_verified, locale
```

### Sign Out

```typescript
async function signOut() {
  const { error } = await supabase.auth.signOut()
}
```

### Listen for Auth State Changes

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    const user = session.user
    console.log('LinkedIn user:', user.user_metadata)
  }
})
```

## LinkedIn OIDC Claims Reference

LinkedIn returns these claims via the ID token and userinfo endpoint. Supabase stores them in `identity_data` and maps some to `user_metadata`.

### Scopes

| Scope | Description |
|---|---|
| `openid` | Required. Enables OIDC and returns an ID token. |
| `profile` | Returns name, given_name, family_name, picture, locale |
| `email` | Returns email, email_verified |

Supabase requests all three scopes automatically.

### Claims Available

| Claim | Description | Mapped to `user_metadata` as |
|---|---|---|
| `sub` | LinkedIn user identifier (pairwise) | `sub` |
| `name` | Full name | `full_name` or `name` |
| `given_name` | First name | `given_name` |
| `family_name` | Last name | `family_name` |
| `picture` | Profile photo URL | `avatar_url` or `picture` |
| `email` | Email address (optional) | `email` |
| `email_verified` | Whether email is verified (optional) | `email_verified` |
| `locale` | User's locale (e.g. `en-US`) | `locale` |

### Sample `user_metadata` After LinkedIn Login

```json
{
  "iss": "https://www.linkedin.com",
  "sub": "782bbtaQ",
  "name": "John Doe",
  "given_name": "John",
  "family_name": "Doe",
  "picture": "https://media.licdn-ei.com/dms/image/.../profile-displayphoto-shrink_100_100/0/",
  "locale": "en-US",
  "email": "doe@email.com",
  "email_verified": true
}
```

### LinkedIn Userinfo Endpoint (direct)

```http
GET https://api.linkedin.com/v2/userinfo
Authorization: Bearer <access_token>
```

Supabase calls this automatically during the OAuth flow.

## What LinkedIn OIDC Does NOT Provide

LinkedIn's OIDC "Sign In" product only provides basic profile data. The following are **not available** through the standard OIDC claims:

- Job title / headline
- Company name / employer
- Industry
- Connections count
- Work history / positions

These require separate LinkedIn API products (e.g., "Share on LinkedIn", marketing APIs) with additional permissions and review processes. For a summit networking app, these fields must be collected during onboarding rather than pulled from LinkedIn.

## Supabase User Object Structure

```typescript
interface User {
  id: string                    // Supabase user UUID
  email: string                 // From LinkedIn (if email scope granted)
  app_metadata: {
    provider: 'linkedin_oidc'   // First provider used to sign up
    providers: string[]         // All linked providers
  }
  user_metadata: {              // LinkedIn profile data (user-editable, not for RLS)
    full_name: string
    avatar_url: string
    email: string
    email_verified: boolean
    // ... other LinkedIn claims
  }
  identities: [{
    provider: 'linkedin_oidc'
    provider_id: string         // LinkedIn sub identifier
    identity_data: { ... }      // Raw LinkedIn claims
    last_sign_in_at: string
  }]
}
```

## API Reference

| Method | Description | Example |
|---|---|---|
| `signInWithOAuth({ provider: 'linkedin_oidc' })` | Initiates LinkedIn OIDC login flow | See sign-in patterns above |
| `signInWithOAuth({ provider: 'linkedin_oidc', options: { redirectTo } })` | Login with custom redirect (PKCE) | See PKCE pattern above |
| `exchangeCodeForSession(code)` | Exchanges auth code for session (server-side) | `await supabase.auth.exchangeCodeForSession(code)` |
| `getUser()` | Returns current user with metadata | `const { data: { user } } = await supabase.auth.getUser()` |
| `signOut()` | Signs the user out | `await supabase.auth.signOut()` |
| `onAuthStateChange(callback)` | Listens for auth events | See listener pattern above |

## Gotchas

- **Provider name is `linkedin_oidc`**, not `linkedin`. The legacy `linkedin` provider is deprecated (removed Jan 4, 2024). Always use `linkedin_oidc`.
- **`email` and `email_verified` are optional** in LinkedIn's response. Your app must handle cases where these are absent.
- **`user_metadata` is user-editable.** Never use it in RLS policies or authorization logic. Use `app_metadata` or server-side checks instead.
- **Profile photo URL may expire.** LinkedIn CDN URLs for profile pictures can change. Consider downloading/caching the avatar or refreshing on each login.
- **No job title or company data.** LinkedIn OIDC only provides basic identity claims. Collect professional info during onboarding.
- **Callback URL mismatch** is the #1 cause of OAuth failures. Ensure the redirect URL in LinkedIn Developer Dashboard exactly matches `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Identity linking:** Supabase auto-links identities with the same email. If a user signed up with email/password and later signs in with LinkedIn using the same email, both identities are linked to one account.
- **Local development** requires adding `http://localhost:54321/auth/v1/callback` as a redirect URL in the LinkedIn app settings.

## LinkedIn OIDC Discovery Document

```
https://www.linkedin.com/oauth/.well-known/openid-configuration
```

Key endpoints:
- Authorization: `https://www.linkedin.com/oauth/v2/authorization`
- Token: `https://www.linkedin.com/oauth/v2/accessToken`
- Userinfo: `https://api.linkedin.com/v2/userinfo`
- JWKS: `https://www.linkedin.com/oauth/openid/jwks`

## References

- [Supabase LinkedIn Auth Docs](https://supabase.com/docs/guides/auth/social-login/auth-linkedin)
- [Supabase Social Login Overview](https://supabase.com/docs/guides/auth/social-login)
- [Supabase User Identities](https://supabase.com/docs/guides/auth/identities)
- [LinkedIn Sign In with OpenID Connect (Microsoft Learn)](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)
- [LinkedIn Developer Apps Dashboard](https://www.linkedin.com/developers/apps)
- [LinkedIn OIDC Discovery Document](https://www.linkedin.com/oauth/.well-known/openid-configuration)
