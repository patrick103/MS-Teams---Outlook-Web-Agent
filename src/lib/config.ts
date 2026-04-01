import { z } from "zod";

const envSchema = z.object({
  AZURE_CLIENT_ID: z.string().min(1, "AZURE_CLIENT_ID is required"),
  AZURE_CLIENT_SECRET: z.string().min(1, "AZURE_CLIENT_SECRET is required"),
  AZURE_TENANT_ID: z.string().min(1, "AZURE_TENANT_ID is required"),
  AZURE_REDIRECT_URI: z.string().url().default("http://localhost:3000/api/auth/callback"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  OPENROUTER_API_KEY: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  CRON_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`);
}

export const env = parsed.data;

export const MS_GRAPH_SCOPES = [
  "User.Read",
  "Mail.Read",
  "Mail.Send",
  "Mail.ReadWrite",
  "Calendars.ReadWrite",
  "Chat.Read",
  "Chat.ReadWrite",
  "Team.ReadBasic.All",
  "ChannelMessage.Read.All",
  "offline_access",
];

export const MS_AUTHORITY = `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}`;
