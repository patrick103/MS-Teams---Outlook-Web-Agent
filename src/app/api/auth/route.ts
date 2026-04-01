import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl, handleAuthCallback, destroySession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const codeVerifier = request.cookies.get("pkce_verifier")?.value;
    if (!codeVerifier) {
      return NextResponse.redirect(
        new URL("/?error=missing_verifier", request.url)
      );
    }

    try {
      const session = await handleAuthCallback(code, codeVerifier);
      const response = NextResponse.redirect(
        new URL("/dashboard", request.url)
      );
      response.cookies.set("session_id", session.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      });
      response.cookies.delete("pkce_verifier");
      return response;
    } catch (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(
        new URL("/?error=auth_failed", request.url)
      );
    }
  }

  try {
    const { authUrl, codeVerifier } = await getAuthUrl();
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("pkce_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Auth URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate auth URL" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  if (sessionId) {
    await destroySession(sessionId);
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete("session_id");
  return response;
}
