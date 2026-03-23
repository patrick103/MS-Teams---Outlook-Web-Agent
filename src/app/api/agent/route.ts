import { NextRequest, NextResponse } from "next/server";
import {
  chat,
  summarizeEmails,
  summarizeTeamsMessages,
  generateEmailReply,
  generateTeamsReply,
  extractNotes,
  suggestCalendarAction,
} from "@/lib/agent";

export async function POST(request: NextRequest) {
  const userId = request.cookies.get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, message, context, emails, teamsMessages, emailSubject, emailBody, instructions, calendarEvents, content, source } = body;

    switch (action) {
      case "chat": {
        const reply = await chat(userId, message, context);
        return NextResponse.json({ reply });
      }

      case "summarize_emails": {
        const summary = await summarizeEmails(userId, emails);
        return NextResponse.json({ summary });
      }

      case "summarize_teams": {
        const summary = await summarizeTeamsMessages(userId, teamsMessages);
        return NextResponse.json({ summary });
      }

      case "reply_email": {
        const reply = await generateEmailReply(userId, emailSubject, emailBody, instructions);
        return NextResponse.json({ reply });
      }

      case "reply_teams": {
        const reply = await generateTeamsReply(userId, context, instructions);
        return NextResponse.json({ reply });
      }

      case "extract_notes": {
        const notes = await extractNotes(userId, content, source);
        return NextResponse.json({ notes });
      }

      case "calendar_suggest": {
        const suggestion = await suggestCalendarAction(userId, calendarEvents, context);
        return NextResponse.json({ suggestion });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
