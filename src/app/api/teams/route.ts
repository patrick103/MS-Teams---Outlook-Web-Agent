import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getToken } from "@/lib/auth-helpers";
import { getTeamsChats, getChatMessages, sendTeamsMessage, getTeams, getTeamChannels, getChannelMessages } from "@/lib/graph";

const sendMessageSchema = z.object({
  chatId: z.string().min(1, "chatId is required"),
  message: z.string().min(1, "message is required"),
});

export async function GET(request: NextRequest) {
  const token = await getToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "chats";
  const chatId = searchParams.get("chatId");
  const teamId = searchParams.get("teamId");
  const channelId = searchParams.get("channelId");

  try {
    if (type === "chats") {
      const chats = await getTeamsChats(token);
      return NextResponse.json({ chats });
    }

    if (type === "messages" && chatId) {
      const messages = await getChatMessages(token, chatId);
      return NextResponse.json({ messages });
    }

    if (type === "teams") {
      const teams = await getTeams(token);
      return NextResponse.json({ teams });
    }

    if (type === "channels" && teamId) {
      const channels = await getTeamChannels(token, teamId);
      return NextResponse.json({ channels });
    }

    if (type === "channelMessages" && teamId && channelId) {
      const messages = await getChannelMessages(token, teamId, channelId);
      return NextResponse.json({ messages });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Failed to fetch Teams data:", error);
    return NextResponse.json(
      { error: "Failed to fetch Teams data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof sendMessageSchema>;
  try {
    const raw = await request.json();
    const parsed = sendMessageSchema.safeParse(raw);
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
    await sendTeamsMessage(token, body.chatId, body.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
