import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCalendarEvents, createCalendarEvent } from "@/lib/graph";

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

  try {
    const events = await getCalendarEvents(token, top);
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
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
    const event = await createCalendarEvent(token, body);
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
