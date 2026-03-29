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
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

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

// ─── Token encryption (AES-256-GCM) ─────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not configured. Set a 32+ char string in your .env"
    );
  }
  // Derive a fixed-length key from the config value using SHA-256
  return createHash("sha256").update(key).digest();
}

// Lazy import to avoid circular — we just need createHash
import { createHash } from "crypto";

/**
 * Encrypt a plaintext token string.
 * Returns a JSON string containing iv, authTag, and ciphertext (hex-encoded).
 */
function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("hex"),
    tag: authTag.toString("hex"),
    ct: encrypted.toString("hex"),
  });
}

/**
 * Decrypt a token previously produced by encryptToken.
 * If the value is not JSON (legacy plaintext token), return as-is for
 * backward compatibility — the session will expire and re-auth will encrypt.
 */
function decryptToken(payload: string): string {
  try {
    const { iv, tag, ct } = JSON.parse(payload);
    if (!iv || !tag || !ct) return payload; // not our format — legacy

    const key = getEncryptionKey();
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ct, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    // Not JSON or decryption failed — treat as legacy plaintext token
    return payload;
  }
}

// ─── Auth flows ──────────────────────────────────────────────────────────────

/**
 * Per-session MSAL cache adapter.
 * Serializes/deserializes MSAL's internal token cache to/from a DB string,
 * so each user session gets its own refresh token managed by MSAL.
 */
class SessionCachePlugin {
  constructor(private cacheData: string = "{}") {}

  async beforeCacheAccess(context: any): Promise<void> {
    context.tokenCache.deserialize(this.cacheData);
  }

  async afterCacheAccess(context: any): Promise<void> {
    this.cacheData = context.tokenCache.serialize();
  }

  getCacheData(): string {
    return this.cacheData;
  }
}

/**
 * Get an MSAL instance with a per-session cache loaded.
 * Call saveSessionCache() after any token operation to persist changes.
 */
function getMsalInstanceWithCache(cacheData?: string) {
  const plugin = new SessionCachePlugin(cacheData);
  return {
    instance: new ConfidentialClientApplication({
      ...msalConfig,
      cache: { cachePlugin: plugin },
    }),
    getCacheData: () => plugin.getCacheData(),
  };
}

// ─── Auth flows ──────────────────────────────────────────────────────────────

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

  const { instance, getCacheData } = getMsalInstanceWithCache();
  const response = await instance.acquireTokenByCode(tokenRequest);

  const sessionId = uuidv4();
  const expiresAt = response.expiresOn ?? new Date(Date.now() + 3600 * 1000);
  const msalCache = getCacheData();

  await db.insert(sessions).values({
    id: sessionId,
    userId: response.account?.homeAccountId ?? "unknown",
    accessToken: encryptToken(response.accessToken),
    refreshToken: encryptToken(msalCache), // Store serialized MSAL cache (contains refresh token)
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

  // Expired — attempt refresh via MSAL cache before giving up
  if (new Date() > session.expiresAt) {
    if (session.refreshToken) {
      try {
        return await refreshSession(session);
      } catch {
        await db.delete(sessions).where(eq(sessions.id, sessionId));
        return null;
      }
    }
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  // Expiring within 5 minutes — proactively refresh
  const fiveMinutes = 5 * 60 * 1000;
  if (
    session.refreshToken &&
    session.expiresAt.getTime() - Date.now() < fiveMinutes
  ) {
    try {
      return await refreshSession(session);
    } catch {
      // Refresh failed, but token is still valid — return decrypted current session
      return { ...session, accessToken: decryptToken(session.accessToken) };
    }
  }

  // Return with decrypted access token
  return { ...session, accessToken: decryptToken(session.accessToken) };
}

/**
 * Refresh a session using MSAL's internal cache (which contains the refresh token).
 * Restores the MSAL cache from DB, calls acquireTokenSilent, then persists the updated cache.
 */
async function refreshSession(session: {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  createdAt: Date | null;
}) {
  if (!session.refreshToken) {
    throw new Error("No MSAL cache available for refresh");
  }

  // Restore MSAL cache from stored data
  const cacheData = decryptToken(session.refreshToken);
  const { instance, getCacheData } = getMsalInstanceWithCache(cacheData);

  // Get account from cache
  const accounts = await instance.getTokenCache().getAllAccounts();
  if (accounts.length === 0) {
    throw new Error("No accounts in MSAL cache");
  }

  // acquireTokenSilent uses the cached refresh token automatically
  const response = await instance.acquireTokenSilent({
    account: accounts[0],
    scopes: MS_GRAPH_SCOPES,
  });

  const newExpiresAt = response.expiresOn ?? new Date(Date.now() + 3600 * 1000);
  const newCache = getCacheData();

  await db
    .update(sessions)
    .set({
      accessToken: encryptToken(response.accessToken),
      refreshToken: encryptToken(newCache), // Updated cache with new tokens
      expiresAt: newExpiresAt,
    })
    .where(eq(sessions.id, session.id));

  return {
    ...session,
    accessToken: response.accessToken,
    expiresAt: newExpiresAt,
    createdAt: session.createdAt,
  };
}

export async function destroySession(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
