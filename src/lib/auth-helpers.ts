import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * The session type as returned by getSession (with decrypted accessToken).
 */
export type VerifiedSession = {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  createdAt: Date | null;
};

/**
 * Extracts the session from the request cookie and verifies it.
 * Returns the verified session or null if unauthorized.
 */
export async function getVerifiedSession(
  request: NextRequest
): Promise<VerifiedSession | null> {
  const sessionId = request.cookies.get("session_id")?.value;
  if (!sessionId) return null;
  return await getSession(sessionId) as VerifiedSession | null;
}

/**
 * Convenience: extracts and returns just the access token from a verified session.
 * Returns null if the session is invalid or expired.
 */
export async function getToken(request: NextRequest): Promise<string | null> {
  const session = await getVerifiedSession(request);
  return session?.accessToken ?? null;
}

/**
 * Get a verified session by userId (server-side, no cookie required).
 * Useful for background processing where there's no HTTP request context.
 * Returns the most recent non-expired session for the user.
 */
export async function getSessionByUserId(
  userId: string
): Promise<VerifiedSession | null> {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(1);

  if (result.length === 0) return null;

  const session = result[0];

  // Expired — try to refresh
  if (new Date() > session.expiresAt) {
    if (session.refreshToken) {
      try {
        return (await getSession(session.id)) as VerifiedSession | null;
      } catch {
        return null;
      }
    }
    return null;
  }

  // Expiring within 5 minutes — proactively refresh
  const fiveMinutes = 5 * 60 * 1000;
  if (
    session.refreshToken &&
    session.expiresAt.getTime() - Date.now() < fiveMinutes
  ) {
    try {
      return (await getSession(session.id)) as VerifiedSession | null;
    } catch {
      // Refresh failed but token still valid — return current
    }
  }

  // getSession handles decryption and refresh
  return (await getSession(session.id)) as VerifiedSession | null;
}
