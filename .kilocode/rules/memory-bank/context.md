# Active Context: MS Teams & Outlook AI Agent

## Current State

**Status**: Building autonomous monitoring features

The application is a Next.js app that integrates with Microsoft Graph API to monitor Outlook emails and Teams messages, with AI-powered auto-reply capabilities.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] Added comprehensive README.md with setup instructions
- [x] Microsoft Graph API integration (emails, teams, calendar)
- [x] AI agent with OpenRouter (email reply, teams reply, summaries)
- [x] Settings page with auto-reply/auto-summary toggles
- [x] Database schema with Drizzle ORM (sessions, settings, agentLogs, notes, graphSubscriptions, messageQueue, approvalResponses)
- [x] **Webhook endpoint for Graph change notifications** (`src/app/api/webhooks/graph/route.ts`)
  - GET handler for subscription validation (returns validationToken plain text)
  - POST handler: parses notifications, queues created items into message_queue
  - Determines email vs Teams by resource path pattern matching
  - Returns 202 Accepted immediately for async processing
- [x] **Notification processor endpoint** (`src/app/api/webhooks/process/route.ts`)
  - Picks up pending items from message_queue
  - Fetches full message content via Graph API (getEmailById, getChatMessages)
  - Generates AI responses using existing agent functions
  - Auto-sends if agentAutoReply enabled, creates approval_responses entry if disabled
  - Logs all actions via logAction()
- [x] **Added getEmailById to graph.ts** for fetching individual email messages
- [x] **Exported logAction from agent.ts** (was previously internal)
- [x] **Added getTokenForUserId to auth-helpers.ts** for background token retrieval by userId

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Current Focus

The template is ready. Next steps depend on user requirements:

1. What type of application to build
2. What features are needed
3. Design/branding preferences

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-03-25 | Added README.md with full project documentation |
| 2026-04-01 | Created webhook endpoint for Graph change notifications and notification processor |
