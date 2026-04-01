import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getToken } from "@/lib/auth-helpers";
import { getEmails, sendEmail, replyToEmail } from "@/lib/graph";

const sendEmailSchema = z.object({
  to: z.array(z.string().email("Invalid email address")).min(1, "At least one recipient is required"),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
});

const replyEmailSchema = z.object({
  messageId: z.string().min(1, "messageId is required"),
  content: z.string().min(1, "Content is required"),
});

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
    console.error("Failed to fetch emails:", error);
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
    const { action } = body;

    if (action === "send") {
      const parsed = sendEmailSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      await sendEmail(token, parsed.data.to, parsed.data.subject, parsed.data.content);
      return NextResponse.json({ success: true });
    }

    if (action === "reply") {
      const parsed = replyEmailSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      await replyToEmail(token, parsed.data.messageId, parsed.data.content);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to process email:", error);
    return NextResponse.json(
      { error: "Failed to process email" },
      { status: 500 }
    );
  }
}
