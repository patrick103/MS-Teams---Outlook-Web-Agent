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
 * Gets a valid access token for a given userId by finding their most recent session.
 * Handles token refresh if the session is expired or near-expiry.
 * Returns null if no valid session exists.
 */
export async function getTokenForUserId(userId: string): Promise<string | null> {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(1);

  if (result.length === 0) return null;

  const session = await getSession(result[0].id);
  if (!session) return null;

  return (session as VerifiedSession).accessToken ?? null;
}
