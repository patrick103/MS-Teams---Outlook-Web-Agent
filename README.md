# MS Teams & Outlook AI Agent

AI-powered assistant for Microsoft Teams and Outlook that monitors, responds, summarizes, and manages your communications on your behalf.

## Features

- **Email Management** - Read, send, and organize Outlook emails
- **Teams Chat** - Monitor and respond to Microsoft Teams messages
- **Calendar Integration** - View and manage calendar events
- **AI Agent** - Automated communication assistance via OpenRouter
- **Microsoft Graph API** - Full integration with Microsoft 365 services

## Tech Stack

| Technology       | Version | Purpose                        |
| ---------------- | ------- | ------------------------------ |
| Next.js          | 16.x    | React framework (App Router)   |
| React            | 19.x    | UI library                     |
| TypeScript       | 5.9.x   | Type-safe development          |
| Tailwind CSS     | 4.x     | Utility-first styling          |
| Drizzle ORM      | Latest  | Database ORM (SQLite)          |
| Azure MSAL       | Latest  | Microsoft authentication       |
| Microsoft Graph  | Latest  | Microsoft 365 API access       |
| Bun              | Latest  | Package manager & runtime      |
| Zod              | Latest  | Environment validation         |

## Prerequisites

- [Bun](https://bun.sh/) installed (`curl -fsSL https://bun.sh/install | bash`)
- Node.js 20+
- An Azure AD app registration (see [Azure Setup](#azure-ad-setup))

## Getting Started

### 1. Clone and Install

```bash
git clone <repository-url>
cd nextjs-template
bun install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id
AZURE_REDIRECT_URI=http://localhost:3000/api/auth/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: For AI agent functionality
OPENROUTER_API_KEY=your_openrouter_api_key

# Optional: For token encryption (min 32 chars)
TOKEN_ENCRYPTION_KEY=your_32_char_encryption_key_here
```

### 3. Set Up Database

```bash
bun run db:generate
bun run db:migrate
```

### 4. Run Development Server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Microsoft.

## Azure AD Setup

1. Go to [Azure Portal](https://portal.azure.com/) > Azure Active Directory > App registrations
2. Create a new registration
3. Set the redirect URI to `http://localhost:3000/api/auth/callback`
4. Under **API permissions**, add these Microsoft Graph permissions:
   - `User.Read`
   - `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`
   - `Calendars.ReadWrite`
   - `Chat.Read`, `Chat.ReadWrite`
   - `Team.ReadBasic.All`, `ChannelMessage.Read.All`
   - `offline_access`
5. Create a client secret and copy the value
6. Copy the Application (client) ID and Directory (tenant) ID

## Project Structure

```
/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── agent/        # AI agent endpoints
│   │   │   ├── auth/         # Microsoft OAuth flow
│   │   │   ├── calendar/     # Calendar API
│   │   │   ├── emails/       # Email API
│   │   │   ├── logs/         # Activity logs
│   │   │   ├── settings/     # User settings
│   │   │   └── teams/        # Teams API
│   │   ├── dashboard/        # Dashboard pages
│   │   │   ├── agent/        # AI agent UI
│   │   │   ├── calendar/     # Calendar view
│   │   │   ├── emails/       # Email management
│   │   │   ├── settings/     # Settings page
│   │   │   └── teams/        # Teams view
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Login page
│   │   └── globals.css       # Global styles
│   ├── components/
│   │   └── Sidebar.tsx       # Dashboard sidebar
│   ├── db/
│   │   ├── index.ts          # Database connection
│   │   ├── migrate.ts        # Migration runner
│   │   └── schema.ts         # Drizzle schema
│   └── lib/
│       ├── agent.ts          # AI agent logic
│       ├── auth.ts           # Auth utilities
│       ├── config.ts         # Environment config
│       └── graph.ts          # Microsoft Graph client
├── drizzle.config.ts         # Drizzle Kit config
├── next.config.ts            # Next.js config
├── tsconfig.json             # TypeScript config
├── postcss.config.mjs        # PostCSS (Tailwind) config
├── eslint.config.mjs         # ESLint config
└── package.json
```

## Available Scripts

| Command              | Description                     |
| -------------------- | ------------------------------- |
| `bun dev`            | Start development server        |
| `bun build`          | Create production build         |
| `bun start`          | Start production server         |
| `bun lint`           | Run ESLint                      |
| `bun typecheck`      | Run TypeScript type checking    |
| `bun run db:generate`| Generate Drizzle migrations     |
| `bun run db:migrate` | Run database migrations         |

## API Routes

| Endpoint                  | Method | Description                    |
| ------------------------- | ------ | ------------------------------ |
| `/api/auth`               | GET    | Initiate Microsoft OAuth       |
| `/api/auth/callback`      | GET    | OAuth callback handler         |
| `/api/emails`             | GET    | Fetch user emails              |
| `/api/teams`              | GET    | Fetch Teams chats/channels     |
| `/api/calendar`           | GET    | Fetch calendar events          |
| `/api/agent`              | POST   | Run AI agent tasks             |
| `/api/settings`           | GET/PUT| User settings                  |
| `/api/logs`               | GET    | Activity logs                  |

## Deployment

### Build for Production

```bash
bun build
bun start
```

### Environment Variables for Production

Set all required environment variables in your hosting platform. Ensure `AZURE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` match your production domain.

## License

Private
