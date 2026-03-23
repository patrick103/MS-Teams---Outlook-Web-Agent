import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  if (!sessionId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    expiresAt: session.expiresAt,
  });
}
