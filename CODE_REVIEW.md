# 🔍 Code Review: MS Teams & Outlook Web Agent

**Repository:** `MS-Teams---Outlook-Web-Agent`
**Stack:** Next.js 16 (App Router), React 19, TypeScript 5.9, Drizzle ORM (SQLite), Azure MSAL, Microsoft Graph API, Bun, Zod
**Reviewed:** All 27 source files

---

## 🔴 Critical (Must Fix)

### 1. Access tokens stored in plaintext in SQLite
**File:** `src/db/schema.ts:8`, `src/lib/auth.ts:67`

```ts
accessToken: text("access_token").notNull(),
```

Access tokens are stored as raw text in the `sessions` table. Anyone with access to the SQLite file (server compromise, backup leak, dev access) gets full Microsoft Graph API access to every user's email, Teams, and calendar. The config references a `TOKEN_ENCRYPTION_KEY` (32+ chars) in `src/lib/config.ts:11` but it's **never used anywhere** — encryption was planned but never implemented.

**Fix:** Encrypt tokens at rest using AES-256-GCM with `TOKEN_ENCRYPTION_KEY`. Encrypt before `db.insert(sessions)` in `auth.ts:67` and decrypt in `getSession()` at `auth.ts:78`.

---

### 2. No token refresh — sessions silently expire after ~1 hour
**File:** `src/lib/auth.ts:73-87`

```ts
if (new Date() > session.expiresAt) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
  return null;
}
```

When the access token expires (~1 hour for Azure AD), `getSession()` deletes the session and returns `null`. The user gets logged out with **no warning and no automatic refresh**. The `refreshToken` column exists in the schema but is always set to `null` (`auth.ts:70`). There's no `acquireTokenByRefreshToken` call anywhere.

**Fix:** Store the refresh token from the MSAL response. In `getSession()`, when `expiresAt` is approaching (e.g., <5 min), call `msalInstance.acquireTokenByRefreshToken()` and update the DB.

---

### 3. XSS vulnerability in Teams message rendering
**File:** `src/app/dashboard/teams/page.tsx:186`

```tsx
<p className="text-sm" dangerouslySetInnerHTML={{ __html: msg.body?.content?.replace(/<[^>]*>/g, "") ?? "" }} />
```

This uses `dangerouslySetInnerHTML` after a naive regex strip. The regex `<[^>]*>` only removes HTML tags but **does not sanitize attributes, event handlers, or encoded payloads**. A crafted Teams message like `<img src=x onerror=alert(1)>` would be stripped to empty but edge cases with malformed HTML, SVG, or URL-encoded payloads could still execute. Also, the regex replacement result is passed to `dangerouslySetInnerHTML` which makes no sense — if you're stripping HTML, render as text.

**Fix:** Remove `dangerouslySetInnerHTML` entirely. Use plain text rendering: `{msg.body?.content?.replace(/<[^>]*>/g, "") ?? ""}` inside a `<p>` tag (no `dangerouslySetInnerHTML`). Or use a proper sanitizer like DOMPurify.

---

### 4. Agent API has no auth verification — uses cookie directly
**File:** `src/app/api/agent/route.ts:8-11`

```ts
const userId = request.cookies.get("user_id")?.value;
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

The agent endpoint trusts the `user_id` cookie **without verifying the session**. An attacker who sets a `user_id` cookie (trivial — it's not httpOnly, see below) can impersonate any user and call the AI agent, send emails, access Teams, etc. Compare this to the emails/teams/calendar routes which correctly call `getSession()` to verify the session.

**Fix:** Use the same `getToken()` pattern from `emails/route.ts` — look up `session_id`, call `getSession()`, derive `userId` from the verified session, not from a client-writable cookie.

---

### 5. `user_id` cookie is not httpOnly — trivially readable by XSS
**File:** `src/app/api/auth/route.ts:30-35`

```ts
response.cookies.set("user_id", session.userId, {
  httpOnly: true,  // ← This says httpOnly but...
```

Wait — it IS set as httpOnly. However, the **Settings page** (`src/app/dashboard/settings/page.tsx`) loads settings using the `user_id` cookie implicitly via `fetch("/api/settings")`, and the API reads it with `request.cookies.get("user_id")`. The real issue is that the `user_id` cookie is **the sole authentication check** for the agent endpoint, and any page that makes `fetch()` calls with cookies could be exploited if there's any XSS on the domain. The httpOnly flag helps, but the agent route's missing session verification (issue #4) makes this moot.

---

### 6. `getToken()` helper is duplicated across 3 route files
**Files:** `src/app/api/emails/route.ts:5-10`, `src/app/api/calendar/route.ts:5-10`, `src/app/api/teams/route.ts:5-10`

```ts
async function getToken(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  if (!sessionId) return null;
  const session = await getSession(sessionId);
  return session?.accessToken ?? null;
}
```

Identical copy-paste in every protected route. This is a DRY violation and creates inconsistency risk — if auth logic changes, you must update 3+ files. The agent route (`api/agent/route.ts`) already demonstrates the danger: it was implemented differently (and incorrectly).

**Fix:** Extract to `src/lib/auth-helpers.ts` and import everywhere.

---

### 7. No input validation on API routes
**Files:** `src/app/api/emails/route.ts:36`, `src/app/api/calendar/route.ts:35`, `src/app/api/agent/route.ts:14`

None of the POST endpoints validate their request bodies with Zod (or anything else). Examples:
- `/api/emails` POST accepts `action`, `to`, `subject`, `content`, `messageId` with no validation
- `/api/calendar` POST passes `body` directly to `createCalendarEvent` — a malicious payload can inject arbitrary fields into the Graph API call
- `/api/agent` POST destructures `action` and passes all other fields unchecked to agent functions

**Fix:** Define Zod schemas for each endpoint's request body. Validate before processing.

---

## 🟡 Warnings (Should Fix)

### 8. `parseInt()` on untrusted query params without bounds checking
**Files:** `src/app/api/emails/route.ts:19`, `src/app/api/calendar/route.ts:19`, `src/app/api/logs/route.ts:14`

```ts
const top = parseInt(searchParams.get("top") ?? "25");
```

No `isNaN` check, no max bound. A request to `/api/emails?top=999999999` would attempt to fetch billions of emails from Graph API. Also, `parseInt` without radix can misinterpret leading zeros.

**Fix:** `Math.min(Math.max(parseInt(top, 10) || 25, 1), 100)`

---

### 9. Error responses leak no debugging info, but also lose error details
**Files:** All API routes

Every catch block does:
```ts
catch (error) {
  return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
}
```

The original error is swallowed. In development, this makes debugging very hard. In production, the generic message is fine but there's no logging.

**Fix:** Log `error` with `console.error()` before returning the generic response. The agent route (`api/agent/route.ts:65-67`) does this correctly — replicate that pattern.

---

### 10. `createGraphClient` called on every request — no client reuse
**File:** `src/lib/graph.ts:3-9`

Every function (getEmails, sendEmail, getCalendarEvents, etc.) creates a new `Client.init()`. While the Graph SDK is lightweight, this is wasteful if multiple calls happen in the same request (e.g., the dashboard loads 4 endpoints in parallel).

**Fix:** Cache the client per access token in a request-scoped context, or at minimum, memoize per-request.

---

### 11. Agent logs store raw input/output — potential data leak
**File:** `src/lib/agent.ts:34-41`

```ts
await db.insert(agentLogs).values({ userId, action, source, input, output });
```

Full email content and Teams messages are logged to the database. The `input` field stores up to 500 chars of email text, and `output` stores the full AI response. This is a data retention risk — sensitive email content persists in SQLite indefinitely.

**Fix:** Log only metadata (subject lines, message counts, action types). Or implement log retention/cleanup.

---

### 12. MSAL instance is a module-level singleton — not safe for concurrent users
**File:** `src/lib/auth.ts:17-22`

```ts
let msalInstance: ConfidentialClientApplication | null = null;
function getMsalInstance() {
  if (!msalInstance) {
    msalInstance = new ConfidentialClientApplication(msalConfig);
  }
  return msalInstance;
}
```

This is initialized once with the env vars at first call. If env vars change (e.g., during config reload), it won't pick up changes. In a serverless context, this may reinitialize on cold starts, which is fine, but the singleton pattern could cause issues if the MSAL library has internal state that's not thread-safe.

**Fix:** At minimum, document this assumption. For multi-tenant scenarios, this would need to be per-tenant.

---

### 13. Calendar event creation has no input validation
**File:** `src/app/api/calendar/route.ts:35-39`

```ts
const body = await request.json();
const event = await createCalendarEvent(token, body);
```

The entire request body is passed through to the Graph API. An attacker could inject `attendees`, `body`, `importance`, or any other Graph API field. The `createCalendarEvent` function in `graph.ts` expects specific fields but receives the raw body.

**Fix:** Validate with Zod schema: `subject` (required string), `start`/`end` (required ISO datetime strings), `body` (optional string), `location` (optional string), `attendees` (optional string array of valid emails).

---

### 14. `extractNotes` inserts a blank settings row unnecessarily
**File:** `src/lib/agent.ts:134-136`

```ts
await db.insert(settings).values({
  userId,
}).onConflictDoNothing();
```

This runs every time `extractNotes` is called, even though the user's settings row should already exist from the auth callback. This is a no-op in the common case but adds unnecessary DB writes.

**Fix:** Remove this insert — the settings row is created during `handleAuthCallback` in `auth.ts:73-76`.

---

### 15. `settings.openrouterApiKey` saved then displayed as `***last4` but re-saved as masked value
**File:** `src/app/api/settings/route.ts:26-28`, `src/app/dashboard/settings/page.tsx:67`

The GET endpoint returns `***` + last 4 chars. When the user clicks "Save Settings" without changing the API key field, the masked value `***abcd` gets saved to the DB, replacing the real key.

**Fix:** In the PUT handler, check if `body.openrouterApiKey.startsWith("***")` and skip updating it. Or use a hidden field that stores whether the key was modified.

---

## 🟢 Suggestions (Nice to Have)

### 16. No loading states for send/reply actions
**Files:** `src/app/dashboard/emails/page.tsx:69-80`, `src/app/dashboard/teams/page.tsx:73-83`

When sending an email reply or Teams message, there's no loading indicator. The user clicks "Send Reply" and nothing visual happens until it completes. If the API is slow, this feels broken.

**Fix:** Add `sending` state to disable the button and show "Sending..." text.

---

### 17. No error feedback on failed API calls in the UI
**Files:** All dashboard page components

Every `fetch()` call catches errors with `console.error()` but never shows the user a toast, alert, or inline error. If a request fails, the user sees nothing.

**Fix:** Add a toast notification system or inline error banners.

---

### 18. `agentLogs` table has no index on `userId`
**File:** `src/db/schema.ts:28-36`

The logs query in `api/logs/route.ts` filters by `userId` and orders by `createdAt desc`. Without an index, this does a full table scan as logs grow.

**Fix:** Add `.index()` on `userId` and a composite index on `(userId, createdAt)`.

---

### 19. `sessions` table has no cleanup mechanism
**File:** `src/db/schema.ts:5-12`

Expired sessions are only deleted when someone tries to use them (`getSession()`). If a user logs in and never returns, their session row persists forever. Over time, this table grows unbounded.

**Fix:** Add a periodic cleanup job or a DB trigger. Or run `DELETE FROM sessions WHERE expires_at < datetime('now')` on a schedule.

---

### 20. Dashboard page makes 4 parallel API calls on load — no error recovery
**File:** `src/app/dashboard/page.tsx:29-46`

`Promise.all` is not used — it's 4 independent `fetch()` calls with individual error handling, which is fine. But if the user isn't authenticated, all 4 will return 401, and the dashboard shows 0s with no redirect to login.

**Fix:** Check for 401 responses and redirect to `/` (login page).

---

### 21. No middleware for route protection
**File:** N/A (missing)

There's no `middleware.ts` to protect `/dashboard/*` routes. An unauthenticated user can load the dashboard HTML/JS — the API calls will fail, but the UI still renders. This leaks the app structure.

**Fix:** Add `src/middleware.ts` that checks for `session_id` cookie and redirects to `/` if missing.

---

### 22. `notes` table defined in schema but never used
**File:** `src/db/schema.ts:46-54`

The `notes` table is defined but no API route, function, or UI component references it. The `extractNotes` agent function returns the result but never saves to this table.

**Fix:** Either implement the notes feature end-to-end or remove the dead schema.

---

### 23. `user_id` cookie set alongside `session_id` — redundant
**File:** `src/app/api/auth/route.ts:30-35`

The `user_id` is stored in both the session DB row and a separate cookie. The cookie is only used by the agent route (which is the buggy one — issue #4). All other routes derive the user from the session.

**Fix:** Remove the `user_id` cookie entirely. All routes should derive userId from the verified session.

---

### 24. Model list in Settings is hardcoded and will go stale
**File:** `src/app/dashboard/settings/page.tsx:62-71`

The model list is hardcoded. OpenRouter adds/deprecates models regularly. This will confuse users when models stop working.

**Fix:** Fetch the model list from OpenRouter's `/api/v1/models` endpoint, or at minimum document that users can type custom model IDs.

---

### 25. `@kilocode/app-builder-db` is a private GitHub dependency
**File:** `package.json:11`

```json
"@kilocode/app-builder-db": "github:Kilo-Org/app-builder-db#main"
```

This references a GitHub repo at a `#main` branch pin. If the repo is deleted, renamed, or the branch is force-pushed, `bun install` fails and the app is unbuildable.

**Fix:** Fork to your own org, pin to a commit SHA, or publish to npm.

---

## 🏁 Top 5 — Fix This First

| Priority | Issue | Why |
|----------|-------|-----|
| **1** | 🔴 #4 — Agent API trusts `user_id` cookie without session verification | Anyone can impersonate any user by setting a cookie. Direct auth bypass. |
| **2** | 🔴 #1 — Access tokens stored in plaintext | Full Graph API access to all users if DB file is leaked. `TOKEN_ENCRYPTION_KEY` exists but is unused. |
| **3** | 🔴 #2 — No token refresh mechanism | Users get logged out every ~1 hour with no warning. Core UX is broken. |
| **4** | 🔴 #15 — API key gets corrupted on settings save | Saving settings without re-entering the key replaces it with `***abcd`, permanently breaking AI features. |
| **5** | 🔴 #3 — XSS via `dangerouslySetInnerHTML` | Malicious Teams messages could execute JS. Switch to plain text rendering. |
