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
  subscriptionExpirationDateTime?: string;
}

interface GraphNotificationPayload {
  value: GraphNotification[];
  validationTokens?: string[];
}

/**
 * Determines the message source (email or teams) from a Graph resource path.
 * Email: "me/messages/{messageId}"
 * Teams: "me/chats/{chatId}/messages/{messageId}"
 */
function parseResourcePath(resource: string): {
  source: "email" | "teams";
  resourceId: string;
  chatId: string | null;
} {
  if (resource.includes("/chats/")) {
    const parts = resource.split("/");
    const messagesIdx = parts.indexOf("messages");
    const chatsIdx = parts.indexOf("chats");
    return {
      source: "teams",
      resourceId: messagesIdx >= 0 ? parts[messagesIdx + 1] : resource,
      chatId: chatsIdx >= 0 ? parts[chatsIdx + 1] : null,
    };
  }

  const msgMatch = resource.match(/messages\/([^/]+)/);
  return {
    source: "email",
    resourceId: msgMatch ? msgMatch[1] : resource,
    chatId: null,
  };
}

/**
 * GET handler — Microsoft Graph sends a validationToken query param during
 * subscription creation. Return it as plain text with 200 status.
 */
export async function GET(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json(
    { error: "Missing validationToken" },
    { status: 400 }
  );
}

/**
 * POST handler — Receives change notifications from Microsoft Graph.
 * Queues each 'created' notification into message_queue and returns 202 Accepted.
 */
export async function POST(request: NextRequest) {
  try {
    const body: GraphNotificationPayload = await request.json();

    // Handle validation token in POST body (Graph may send it here too)
    if (body.validationTokens?.length) {
      return new NextResponse(body.validationTokens[0], {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (!body.value?.length) {
      return NextResponse.json(
        { error: "No notifications" },
        { status: 400 }
      );
    }

    for (const notification of body.value) {
      if (notification.changeType !== "created") continue;

      // Look up the subscription to find the userId
      const sub = await db
        .select()
        .from(graphSubscriptions)
        .where(eq(graphSubscriptions.subscriptionId, notification.subscriptionId))
        .limit(1);

      if (sub.length === 0) {
        console.error(
          "No subscription found for:",
          notification.subscriptionId
        );
        continue;
      }

      const { source, resourceId, chatId } = parseResourcePath(
        notification.resource
      );

      await db.insert(messageQueue).values({
        userId: sub[0].userId,
        source,
        resourceId,
        chatId,
        fromAddress: "",
        body: "",
        status: "pending",
      });
    }

    return new NextResponse(null, { status: 202 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
