import { env } from "@/lib/config";
import { db } from "@/db";
import { notes, settings, agentLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[]
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "MS Teams & Outlook AI Agent",
    },
    body: JSON.stringify({ model, messages, max_tokens: 2048 }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content ?? "";
}

async function getUserConfig(userId: string) {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);

  if (result.length === 0) {
    throw new Error("User settings not found. Please configure your OpenRouter API key in Settings.");
  }

  const config = result[0];
  const apiKey = config.openrouterApiKey || env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("No OpenRouter API key configured. Please add one in Settings.");
  }

  return { apiKey, model: config.openrouterModel ?? "anthropic/claude-sonnet-4" };
}

async function logAction(
  userId: string,
  action: string,
  source: string,
  input: string,
  output: string
) {
  await db.insert(agentLogs).values({ userId, action, source, input, output });
}

// --- AGENT FUNCTIONS ---

export async function summarizeEmails(userId: string, emails: unknown[]) {
  const config = await getUserConfig(userId);

  const emailText = (emails as Array<{ subject: string; from: { emailAddress: { address: string } }; bodyPreview: string; receivedDateTime: string }>)
    .map(
      (e) =>
        `From: ${e.from?.emailAddress?.address}\nSubject: ${e.subject}\nPreview: ${e.bodyPreview}\nDate: ${e.receivedDateTime}`
    )
    .join("\n---\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "You are an executive assistant. Summarize these emails concisely, highlighting action items, urgent items, and key information. Use bullet points.",
    },
    { role: "user", content: `Summarize these emails:\n\n${emailText}` },
  ];

  const summary = await callOpenRouter(config.apiKey, config.model, messages);
  await logAction(userId, "summarize", "email", emailText.slice(0, 500), summary);
  return summary;
}

export async function summarizeTeamsMessages(userId: string, messages: unknown[]) {
  const config = await getUserConfig(userId);

  const msgText = (messages as Array<{ from: { user?: { displayName?: string } }; body: { content?: string }; createdDateTime: string }>)
    .map(
      (m) =>
        `${m.from?.user?.displayName ?? "Unknown"}: ${m.body?.content?.replace(/<[^>]*>/g, "") ?? ""} (${m.createdDateTime})`
    )
    .join("\n");

  const chatMessages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "You are an executive assistant. Summarize these Teams messages, highlighting key decisions, action items, and important discussions.",
    },
    { role: "user", content: `Summarize these messages:\n\n${msgText}` },
  ];

  const summary = await callOpenRouter(config.apiKey, config.model, chatMessages);
  await logAction(userId, "summarize", "teams", msgText.slice(0, 500), summary);
  return summary;
}

export async function generateEmailReply(
  userId: string,
  emailSubject: string,
  emailBody: string,
  instructions?: string
) {
  const config = await getUserConfig(userId);

  const settingsResult = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);
  const tone = settingsResult[0]?.agentTone ?? "professional";

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are an executive assistant writing email replies. Write in a ${tone} tone. Be concise and clear. Only write the email body, no subject line.`,
    },
    {
      role: "user",
      content: `Write a reply to this email:\n\nSubject: ${emailSubject}\nBody: ${emailBody}${instructions ? `\n\nAdditional instructions: ${instructions}` : ""}`,
    },
  ];

  const reply = await callOpenRouter(config.apiKey, config.model, messages);
  await logAction(userId, "reply", "email", emailSubject, reply);
  return reply;
}

export async function generateTeamsReply(
  userId: string,
  chatContext: string,
  instructions?: string
) {
  const config = await getUserConfig(userId);

  const settingsResult = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);
  const tone = settingsResult[0]?.agentTone ?? "professional";

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are an executive assistant replying to Teams messages. Write in a ${tone} tone. Be concise. Only provide the message text.`,
    },
    {
      role: "user",
      content: `Write a reply based on this context:\n\n${chatContext}${instructions ? `\n\nInstructions: ${instructions}` : ""}`,
    },
  ];

  const reply = await callOpenRouter(config.apiKey, config.model, messages);
  await logAction(userId, "reply", "teams", chatContext.slice(0, 300), reply);
  return reply;
}

export async function extractNotes(userId: string, content: string, source: string) {
  const config = await getUserConfig(userId);

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "You are an executive assistant. Extract key notes, action items, and important information from the provided content. Format as structured notes with clear sections.",
    },
    {
      role: "user",
      content: `Extract notes from this ${source} content:\n\n${content}`,
    },
  ];

  const notesResult = await callOpenRouter(config.apiKey, config.model, messages);
  await logAction(userId, "extract_notes", source, content.slice(0, 500), notesResult);

  await db.insert(notes).values({
    userId,
    title: "Extracted Notes",
    content: notesResult,
    source,
  });

  return notesResult;
}

export async function chat(userId: string, message: string, context?: string) {
  const config = await getUserConfig(userId);

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content: `You are an AI executive assistant that helps manage Microsoft Teams, Outlook emails, and calendar. You can:
- Summarize emails and messages
- Draft replies
- Extract action items and notes
- Help manage calendar events
- Provide insights on communication patterns

Be helpful, concise, and ${context ? "use the provided context to inform your responses." : "ask for context when needed."}`,
    },
  ];

  if (context) {
    messages.push({ role: "user", content: `Context:\n${context}` });
  }

  messages.push({ role: "user", content: message });

  const reply = await callOpenRouter(config.apiKey, config.model, messages);
  await logAction(userId, "chat", "agent", message, reply);
  return reply;
}

export async function suggestCalendarAction(
  userId: string,
  calendarEvents: unknown[],
  emailContext?: string
) {
  const config = await getUserConfig(userId);

  const eventsText = (calendarEvents as Array<{ subject: string; start: { dateTime: string }; end: { dateTime: string }; location?: { displayName?: string } }>)
    .map(
      (e) =>
        `- ${e.subject} | ${e.start?.dateTime} to ${e.end?.dateTime} | ${e.location?.displayName ?? "No location"}`
    )
    .join("\n");

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "You are an executive assistant analyzing calendar and email context. Suggest scheduling actions, identify conflicts, and recommend meeting preparation steps.",
    },
    {
      role: "user",
      content: `Upcoming events:\n${eventsText}${emailContext ? `\n\nRecent email context:\n${emailContext}` : ""}\n\nProvide scheduling insights and suggestions.`,
    },
  ];

  const suggestion = await callOpenRouter(config.apiKey, config.model, messages);
  await logAction(userId, "calendar_suggest", "calendar", eventsText.slice(0, 300), suggestion);
  return suggestion;
}
