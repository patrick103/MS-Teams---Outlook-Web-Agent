"use server";

import {
  ConfidentialClientApplication,
  AuthorizationCodeRequest,
  CryptoProvider,
} from "@azure/msal-node";
import { env, MS_AUTHORITY, MS_GRAPH_SCOPES } from "@/lib/config";
import { db } from "@/db";
import { sessions, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const msalConfig = {
  auth: {
    clientId: env.AZURE_CLIENT_ID,
    clientSecret: env.AZURE_CLIENT_SECRET,
    authority: MS_AUTHORITY,
  },
};

let msalInstance: ConfidentialClientApplication | null = null;

function getMsalInstance() {
  if (!msalInstance) {
    msalInstance = new ConfidentialClientApplication(msalConfig);
  }
  return msalInstance;
}

export async function getAuthUrl() {
  const cryptoProvider = new CryptoProvider();
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();

  const authUrlParameters = {
    scopes: MS_GRAPH_SCOPES,
    redirectUri: env.AZURE_REDIRECT_URI,
    codeChallenge: challenge,
    codeChallengeMethod: "S256" as const,
  };

  const authUrl = await getMsalInstance().getAuthCodeUrl(authUrlParameters);
  return { authUrl, codeVerifier: verifier };
}

export async function handleAuthCallback(code: string, codeVerifier: string) {
  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes: MS_GRAPH_SCOPES,
    redirectUri: env.AZURE_REDIRECT_URI,
    codeVerifier,
  };

  const response = await getMsalInstance().acquireTokenByCode(tokenRequest);

  const sessionId = uuidv4();
  const expiresAt = response.expiresOn ?? new Date(Date.now() + 3600 * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId: response.account?.homeAccountId ?? "unknown",
    accessToken: response.accessToken,
    refreshToken: null,
    expiresAt,
  });

  await db
    .insert(settings)
    .values({
      userId: response.account?.homeAccountId ?? "unknown",
    })
    .onConflictDoNothing();

  return {
    sessionId,
    userId: response.account?.homeAccountId ?? "unknown",
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getSession(sessionId: string) {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (result.length === 0) return null;

  const session = result[0];
  if (new Date() > session.expiresAt) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return session;
}

export async function destroySession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
