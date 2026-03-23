import { z } from "zod";

const envSchema = z.object({
  AZURE_CLIENT_ID: z.string().min(1, "AZURE_CLIENT_ID is required"),
  AZURE_CLIENT_SECRET: z.string().min(1, "AZURE_CLIENT_SECRET is required"),
  AZURE_TENANT_ID: z.string().min(1, "AZURE_TENANT_ID is required"),
  AZURE_REDIRECT_URI: z.string().url().default("http://localhost:3000/api/auth/callback"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  OPENROUTER_API_KEY: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("Missing environment variables:", parsed.error.flatten().fieldErrors);
    return {
      AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID ?? "",
      AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET ?? "",
      AZURE_TENANT_ID: process.env.AZURE_TENANT_ID ?? "",
      AZURE_REDIRECT_URI: process.env.AZURE_REDIRECT_URI ?? "http://localhost:3000/api/auth/callback",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    };
  }
  return parsed.data;
}

export const env = loadEnv();

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
