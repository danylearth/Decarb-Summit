# Supabase Auth

## Overview

Supabase Auth provides authentication and user management for SPAs. It supports social OAuth providers (Google, GitHub, etc.), passwordless magic links via email OTP, and real-time session management through auth state listeners. Uses JWT tokens with automatic refresh and supports PKCE flow for enhanced security.

## Installation

```bash
npm install @supabase/supabase-js
```

## Configuration

### Environment Variables

- `VITE_SUPABASE_URL`: Your Supabase project URL (e.g., `https://your-project-id.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase publishable anon key (safe for client-side use)

### Dashboard Setup

Before using social providers, you must:
1. Enable the provider under **Auth > Providers** in the Supabase Dashboard
2. Add OAuth client ID and secret for each provider (obtained from Google Cloud Console, GitHub Developer Settings, etc.)
3. Set the redirect URL in the provider's OAuth app settings to `https://your-project-id.supabase.co/auth/v1/callback`

### Initialization

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce', // Recommended for SPAs — more secure than implicit flow
  },
})
```

## Key Patterns

### Social Login (Google)

```typescript
async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  })
}
```

Redirects user to Google's consent screen. On success, returns to your app with access and refresh tokens. Supports both implicit flow and PKCE flow with automatic session cookie management.

### Social Login (GitHub)

```typescript
async function signInWithGithub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
  })
}
```

### Magic Link (Passwordless Email)

```typescript
async function signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })

  if (error) {
    console.error('Error sending magic link:', error.message)
  } else {
    // User should check their email for the login link
  }
}
```

### Auth State Listener (React Context)

This is the core pattern for managing auth state in a React SPA — directly analogous to the existing `UserContext.tsx` pattern used with Firebase's `onAuthStateChanged`.

```typescript
import { useState, useEffect, createContext, useContext, PropsWithChildren } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthContextType = {
  user: User | null
  session: Session | null
  initialized: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  initialized: false,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    // Listen for auth state changes
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session ? session.user : null)
      setInitialized(true)
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, initialized, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### Getting Current Session / User

```typescript
// Get session (reads from local storage, no network call)
const { data: { session } } = await supabase.auth.getSession()

// Get user (validates with server — use for security-sensitive operations)
const { data: { user } } = await supabase.auth.getUser()
```

### Sign Out

```typescript
await supabase.auth.signOut()
```

## API Reference

| Method | Description | Returns |
|--------|-------------|---------|
| `signInWithOAuth({ provider })` | Redirect to OAuth provider consent screen | `{ data, error }` |
| `signInWithOtp({ email })` | Send magic link email | `{ data, error }` |
| `getSession()` | Get current session from local storage | `{ data: { session } }` |
| `getUser()` | Validate user with server (network call) | `{ data: { user } }` |
| `setSession({ access_token, refresh_token })` | Manually set session from tokens | `{ data, error }` |
| `signOut()` | Sign out and clear session | `{ error }` |
| `onAuthStateChange(callback)` | Subscribe to auth events | `{ data: { subscription } }` |

### Auth Events (from `onAuthStateChange`)

| Event | When |
|-------|------|
| `SIGNED_IN` | User signs in |
| `SIGNED_OUT` | User signs out |
| `TOKEN_REFRESHED` | Access token refreshed |
| `USER_UPDATED` | User profile updated |
| `PASSWORD_RECOVERY` | Password recovery link clicked |

## Gotchas

- **`getSession()` vs `getUser()`**: `getSession()` reads from local storage and does NOT validate with the server. For security-sensitive operations, always use `getUser()` which makes a network call to verify the token is still valid.
- **Unsubscribe from `onAuthStateChange`**: Always clean up the subscription in `useEffect` cleanup to prevent memory leaks: `data.subscription.unsubscribe()`.
- **PKCE flow recommended for SPAs**: Set `flowType: 'pkce'` when creating the client. The default implicit flow exposes tokens in URL fragments.
- **OAuth redirect URL must be configured**: Both in Supabase Dashboard (Auth > URL Configuration) AND in the OAuth provider's developer console. Mismatches cause silent failures.
- **Magic link emails may be rate limited**: Supabase limits OTP emails to prevent abuse. Default is ~4 emails per hour per email address.
- **Session refresh across tabs**: `getSession()` was made async in v2 to resolve race conditions when refreshing tokens across multiple tabs.
- **Social provider must be enabled in Dashboard**: Calling `signInWithOAuth` for a provider that isn't enabled in the Supabase Dashboard will fail silently or return an error.
- **`emailRedirectTo` for magic links**: Always set `options.emailRedirectTo` to your app's URL so the magic link redirects back to your app (not the Supabase default).

## Rate Limits

- Magic link / OTP emails: ~4 per hour per email address (configurable in Dashboard under Auth > Rate Limits)
- Auth API endpoints: Subject to your Supabase plan's API rate limits
- OAuth: No Supabase-side rate limit, but individual providers may have their own limits

## Migration Notes (from Firebase Auth)

| Firebase | Supabase |
|----------|----------|
| `onAuthStateChanged(auth, callback)` | `supabase.auth.onAuthStateChange(callback)` |
| `signInWithPopup(auth, provider)` | `supabase.auth.signInWithOAuth({ provider })` |
| `signOut(auth)` | `supabase.auth.signOut()` |
| `auth.currentUser` | `supabase.auth.getUser()` (async) |
| Firebase config JSON | Two env vars: URL + anon key |

## References

- [Supabase Auth Overview](https://supabase.com/docs/guides/auth)
- [Social Login (Google)](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Social Login (GitHub)](https://supabase.com/docs/guides/auth/social-login/auth-github)
- [Magic Links / OTP](https://supabase.com/docs/guides/auth/passwordless-login/auth-magic-link)
- [Auth Helpers for React](https://supabase.com/docs/guides/auth/quickstarts/react)
- [PKCE Flow](https://supabase.com/blog/supabase-auth-sso-pkce)
- [supabase-js v2 Migration](https://supabase.com/docs/reference/javascript/upgrade-guide)
