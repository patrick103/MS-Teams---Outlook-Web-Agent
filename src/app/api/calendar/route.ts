import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getToken } from "@/lib/auth-helpers";
import { getCalendarEvents, createCalendarEvent } from "@/lib/graph";

const createEventSchema = z.object({
  subject: z.string().min(1, "subject is required"),
  start: z.string().min(1, "start date/time is required"),
  end: z.string().min(1, "end date/time is required"),
  body: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
});

export async function GET(request: NextRequest) {
  const token = await getToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const top = Math.min(Math.max(parseInt(searchParams.get("top") ?? "25", 10) || 25, 1), 100);

  try {
    const events = await getCalendarEvents(token, top);
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Failed to fetch calendar events:", error);
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

  let body: z.infer<typeof createEventSchema>;
  try {
    const raw = await request.json();
    const parsed = createEventSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const event = await createCalendarEvent(token, body);
    return NextResponse.json({ event });
  } catch (error) {
    console.error("Failed to create event:", error);
    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}
