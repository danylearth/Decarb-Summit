# React Router v7

## Overview

React Router v7 is a multi-strategy router for React bridging React 18 to 19, usable as a framework or a library. For Decarb Connect, we use it as a library with `BrowserRouter` / `createBrowserRouter` for client-side routing with protected routes and layout-based auth guards.

## Installation

```bash
npm install react-router
```

> **Note:** In v7 the package is just `react-router` — there is no separate `react-router-dom` package. All DOM-specific APIs (`BrowserRouter`, `Link`, `Outlet`, etc.) are exported from `react-router`.

## Configuration

### No environment variables required

React Router is a client-side library with no API keys or server config.

### Initialization (Data Router — recommended)

```typescript
import { createBrowserRouter, RouterProvider } from "react-router";

const router = createBrowserRouter(routes);

function App() {
  return <RouterProvider router={router} />;
}
```

### Initialization (Classic BrowserRouter — current Decarb Connect approach)

```tsx
import { BrowserRouter, Routes, Route } from "react-router";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## Key Patterns

### 1. Protected Routes via Layout Route Component

The simplest pattern for client-side auth guards — a wrapper component that checks auth state and either renders children or redirects. **This is the pattern best suited for Decarb Connect's current architecture** (Firebase auth via React context, no server loaders).

```tsx
import { Navigate, Outlet } from "react-router";
import { useUser } from "@/context/UserContext";

function ProtectedLayout() {
  const { user, loading } = useUser();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

// Usage in route config:
<Route element={<ProtectedLayout />}>
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/profile" element={<Profile />} />
  <Route path="/chat/:userId" element={<Chat />} />
</Route>
```

### 2. Admin Route Guard (role-based)

Extends the protected route pattern with role checking:

```tsx
function AdminLayout() {
  const { user, loading } = useUser();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  return <Outlet />;
}

// Usage:
<Route element={<AdminLayout />}>
  <Route path="/admin" element={<AdminDashboard />} />
  <Route path="/admin/users" element={<UserManagement />} />
</Route>
```

### 3. Layout Routes with Shared UI

Layout routes render shared chrome (sidebar, nav) around nested child routes via `<Outlet />`:

```tsx
import { Outlet } from "react-router";

function AppLayout() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1">
        <Outlet />
      </main>
      <BottomNav /> {/* mobile */}
    </div>
  );
}

// Nest routes under the layout:
<Route element={<AppLayout />}>
  <Route index element={<Feed />} />
  <Route path="matches" element={<Matches />} />
  <Route path="resources" element={<Resources />} />
</Route>
```

### 4. Passing Context Through Outlets

Parent layouts can pass data to child routes without prop drilling:

```tsx
function ParentLayout() {
  const [user, setUser] = useState(null);
  return (
    <div>
      <Header user={user} />
      <Outlet context={{ user, setUser }} />
    </div>
  );
}

// In child route:
import { useOutletContext } from "react-router";

function ChildRoute() {
  const { user } = useOutletContext<{ user: User }>();
  return <div>Welcome, {user?.name}</div>;
}
```

### 5. Middleware-Based Auth (Data Router / Framework mode)

If migrating to `createBrowserRouter` or React Router framework mode, route-level middleware provides a more structured approach:

```typescript
import { redirect, createContext } from "react-router";

const userContext = createContext<User>();

async function authMiddleware({ context }) {
  const user = await getUser();
  if (!user) {
    throw redirect("/login");
  }
  context.set(userContext, user);
}

// Apply to route config:
createBrowserRouter([
  {
    path: "/",
    middleware: [loggingMiddleware],
    Component: Root,
    children: [
      {
        path: "profile",
        middleware: [authMiddleware],
        loader: profileLoader,
        Component: Profile,
      },
      {
        path: "login",
        Component: Login,
      },
    ],
  },
]);
```

### 6. Loader-Based Route Protection (Data Router)

Loaders can check auth and redirect before the component renders:

```typescript
function protectedLoader({ request }) {
  const user = getUser();
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/login?redirectTo=${url.pathname}`);
  }
  return { user };
}

// In route config:
{
  path: "/dashboard",
  loader: protectedLoader,
  Component: Dashboard,
}
```

### 7. Programmatic Navigation

```tsx
import { useNavigate } from "react-router";

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return <button onClick={handleLogout}>Logout</button>;
}

// Navigate back:
navigate(-1);

// Navigate with replace (no back button):
navigate("/login", { replace: true });
```

### 8. Declarative Redirect

```tsx
import { Navigate } from "react-router";

// Renders nothing, navigates as side effect:
<Navigate to="/login" replace />
```

## API Reference

| API | Description | Example |
|-----|-------------|---------|
| `<Outlet />` | Renders matched child route in parent layout | `<Outlet />` |
| `<Outlet context={val} />` | Pass context to child routes | `<Outlet context={{ user }} />` |
| `useOutletContext<T>()` | Access parent outlet context in child | `const { user } = useOutletContext()` |
| `<Navigate to={path} />` | Declarative redirect component | `<Navigate to="/login" replace />` |
| `useNavigate()` | Programmatic navigation hook | `navigate("/path")` |
| `redirect(url)` | Throw in loader/middleware to redirect | `throw redirect("/login")` |
| `createBrowserRouter(routes)` | Create data router with route objects | See pattern 5 above |
| `middleware` | Route-level middleware array (data router) | `middleware: [authMiddleware]` |
| `loader` | Data loading function per route | `loader: ({ request }) => ...` |

## Gotchas

- **`react-router-dom` is gone in v7.** Import everything from `react-router`. If you see old imports from `react-router-dom`, update them.
- **Layout routes have no `path`.** A route with only `element` (no `path`) wraps its children — this is how you create auth guards and shared layouts.
- **`<Navigate>` must be inside a Router.** It's a component that triggers navigation as a side effect. Don't render it outside of `<BrowserRouter>` or `<RouterProvider>`.
- **`replace` prop matters.** Use `<Navigate to="/login" replace />` to avoid the protected page appearing in browser history (user can't "back" into it).
- **Middleware requires data router.** The `middleware` property on routes only works with `createBrowserRouter` / `RouterProvider`, not with `<BrowserRouter>` + `<Routes>`.
- **Middleware runs server-side in framework mode.** If using React Router as a framework (with SSR), middleware runs on the server. In SPA/library mode with `createBrowserRouter`, it runs client-side.
- **Outlet context is not type-safe by default.** Use the generic `useOutletContext<T>()` to get type safety.
- **Loading states for auth checks.** When auth state is async (e.g., Firebase `onAuthStateChanged`), your guard component must handle the loading state or users will see a flash of the login page.

## Decarb Connect Recommendations

Given the current architecture (Vite SPA + Firebase auth via React context + `BrowserRouter`):

1. **Use Pattern 1 (ProtectedLayout)** for auth guards — it works with the existing `BrowserRouter` setup and `useUser()` context hook.
2. **Use Pattern 2 (AdminLayout)** for any admin routes — nest admin routes under a role-checking layout.
3. **Use Pattern 3 (AppLayout)** for the shared sidebar/nav chrome — this is already how `AppLayout` works in the codebase.
4. **No need to migrate to `createBrowserRouter`** unless you want middleware or loader-based protection. The layout route pattern is sufficient for client-side auth.

## References

- [React Router v7 Docs](https://reactrouter.com/)
- [Route Module (middleware, loaders)](https://github.com/remix-run/react-router/blob/main/docs/start/framework/route-module.md)
- [Middleware How-To](https://github.com/remix-run/react-router/blob/main/docs/how-to/middleware.md)
- [createBrowserRouter API](https://github.com/remix-run/react-router/blob/main/docs/api/data-routers/createBrowserRouter.md)
- [Navigate Component](https://github.com/remix-run/react-router/blob/main/docs/api/components/Navigate.md)
- [useNavigate Hook](https://github.com/remix-run/react-router/blob/main/docs/api/hooks/useNavigate.md)
- [Auth Example (RouterProvider)](https://github.com/remix-run/react-router/blob/main/examples/auth-router-provider/README.md)
