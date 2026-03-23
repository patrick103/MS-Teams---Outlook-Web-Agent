import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTeamsChats, getChatMessages, sendTeamsMessage, getTeams, getTeamChannels, getChannelMessages } from "@/lib/graph";

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

  try {
    const body = await request.json();
    const { chatId, message } = body;

    if (!chatId || !message) {
      return NextResponse.json({ error: "chatId and message required" }, { status: 400 });
    }

    await sendTeamsMessage(token, chatId, message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
