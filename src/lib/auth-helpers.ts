import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

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
