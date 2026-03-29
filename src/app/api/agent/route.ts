import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getVerifiedSession } from "@/lib/auth-helpers";
import {
  chat,
  summarizeEmails,
  summarizeTeamsMessages,
  generateEmailReply,
  generateTeamsReply,
  extractNotes,
  suggestCalendarAction,
} from "@/lib/agent";

const agentActionSchema = z.object({
  action: z.enum([
    "chat",
    "summarize_emails",
    "summarize_teams",
    "reply_email",
    "reply_teams",
    "extract_notes",
    "calendar_suggest",
  ]),
  message: z.string().optional(),
  context: z.string().optional(),
  emails: z.array(z.unknown()).optional(),
  teamsMessages: z.array(z.unknown()).optional(),
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
  instructions: z.string().optional(),
  calendarEvents: z.array(z.unknown()).optional(),
  content: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getVerifiedSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  let body: z.infer<typeof agentActionSchema>;
  try {
    const raw = await request.json();
    const parsed = agentActionSchema.safeParse(raw);
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
    switch (body.action) {
      case "chat": {
        if (!body.message) {
          return NextResponse.json({ error: "message is required for chat" }, { status: 400 });
        }
        const reply = await chat(userId, body.message, body.context);
        return NextResponse.json({ reply });
      }

      case "summarize_emails": {
        if (!body.emails?.length) {
          return NextResponse.json({ error: "emails array is required" }, { status: 400 });
        }
        const summary = await summarizeEmails(userId, body.emails);
        return NextResponse.json({ summary });
      }

      case "summarize_teams": {
        if (!body.teamsMessages?.length) {
          return NextResponse.json({ error: "teamsMessages array is required" }, { status: 400 });
        }
        const summary = await summarizeTeamsMessages(userId, body.teamsMessages);
        return NextResponse.json({ summary });
      }

      case "reply_email": {
        if (!body.emailSubject || !body.emailBody) {
          return NextResponse.json({ error: "emailSubject and emailBody are required" }, { status: 400 });
        }
        const reply = await generateEmailReply(userId, body.emailSubject, body.emailBody, body.instructions);
        return NextResponse.json({ reply });
      }

      case "reply_teams": {
        if (!body.context) {
          return NextResponse.json({ error: "context is required for reply_teams" }, { status: 400 });
        }
        const reply = await generateTeamsReply(userId, body.context, body.instructions);
        return NextResponse.json({ reply });
      }

      case "extract_notes": {
        if (!body.content) {
          return NextResponse.json({ error: "content is required" }, { status: 400 });
        }
        const notes = await extractNotes(userId, body.content, body.source ?? "unknown");
        return NextResponse.json({ notes });
      }

      case "calendar_suggest": {
        if (!body.calendarEvents?.length) {
          return NextResponse.json({ error: "calendarEvents array is required" }, { status: 400 });
        }
        const suggestion = await suggestCalendarAction(userId, body.calendarEvents, body.context);
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
