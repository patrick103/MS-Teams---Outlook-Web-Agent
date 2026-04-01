import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messageQueue, graphSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

interface GraphNotification {
  subscriptionId: string;
  changeType: string;
  resource: string;
  resourceData?: Record<string, unknown>;
  tenantId?: string;
  clientState?: string;
}

interface GraphNotificationPayload {
  value: GraphNotification[];
  validationToken?: string;
}

function extractEmailMessageId(resource: string): string | null {
  const match = resource.match(/^me\/messages\/(.+)$/);
  return match ? match[1] : null;
}

function extractTeamsIds(resource: string): { chatId: string; messageId: string } | null {
  const match = resource.match(/^me\/chats\/([^/]+)\/messages\/(.+)$/);
  if (!match) return null;
  return { chatId: match[1], messageId: match[2] };
}

async function findUserIdBySubscription(subscriptionId: string): Promise<string | null> {
  const result = await db
    .select({ userId: graphSubscriptions.userId })
    .from(graphSubscriptions)
    .where(eq(graphSubscriptions.subscriptionId, subscriptionId))
    .limit(1);

  return result[0]?.userId ?? null;
}

export async function GET(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Missing validationToken" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  let payload: GraphNotificationPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.validationToken) {
    return new NextResponse(payload.validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const notifications = payload.value ?? [];

  for (const notification of notifications) {
    if (notification.changeType !== "created") continue;

    const userId = await findUserIdBySubscription(notification.subscriptionId);
    if (!userId) continue;

    const emailId = extractEmailMessageId(notification.resource);
    if (emailId) {
      await db.insert(messageQueue).values({
        userId,
        source: "email",
        resourceId: emailId,
        fromAddress: "",
        body: "",
        status: "pending",
      });
      continue;
    }

    const teamsIds = extractTeamsIds(notification.resource);
    if (teamsIds) {
      await db.insert(messageQueue).values({
        userId,
        source: "teams",
        resourceId: teamsIds.messageId,
        chatId: teamsIds.chatId,
        fromAddress: "",
        body: "",
        status: "pending",
      });
    }
  }

  return new NextResponse(null, { status: 202 });
}
