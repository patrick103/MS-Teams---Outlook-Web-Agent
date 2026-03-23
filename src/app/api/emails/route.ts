import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEmails, sendEmail, replyToEmail } from "@/lib/graph";

async function getToken(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  if (!sessionId) return null;
  const session = await getSession(sessionId);
  return session?.accessToken ?? null;
}

export async function GET(request: NextRequest) {
  const token = await getToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const top = parseInt(searchParams.get("top") ?? "25");
  const folder = searchParams.get("folder") ?? "inbox";

  try {
    const emails = await getEmails(token, top, folder);
    return NextResponse.json({ emails });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, to, subject, content, messageId } = body;

    if (action === "send") {
      await sendEmail(token, to, subject, content);
      return NextResponse.json({ success: true });
    }

    if (action === "reply") {
      await replyToEmail(token, messageId, content);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process email" },
      { status: 500 }
    );
  }
}
