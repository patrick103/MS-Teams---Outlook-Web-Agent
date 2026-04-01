import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messageQueue, approvalResponses, settings, agentLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getEmails, getChatMessages, replyToEmail, sendTeamsMessage } from "@/lib/graph";
import { generateEmailReply, generateTeamsReply } from "@/lib/agent";
import { env } from "@/lib/config";
import { getSessionByUserId } from "@/lib/auth-helpers";

/**
 * POST handler — Processes pending items from message_queue.
 * Protected by CRON_SECRET header.
 *
 * For each pending item:
 * 1. Fetch the full message content via Graph API
 * 2. Generate an AI response
 * 3. If user has agentAutoReply: send immediately, mark completed
 * 4. Otherwise: create approval_responses entry, mark awaiting_approval
 */
export async function POST(request: NextRequest) {
  // Auth check
  const cronSecret = request.headers.get("x-cron-secret");
  if (!env.CRON_SECRET || cronSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pendingItems = await db
      .select()
      .from(messageQueue)
      .where(eq(messageQueue.status, "pending"))
      .limit(50);

    if (pendingItems.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let processedCount = 0;

    for (const item of pendingItems) {
      try {
        // Mark as processing
        await db
          .update(messageQueue)
          .set({ status: "processing" })
          .where(eq(messageQueue.id, item.id));

        // Get user session (server-side, no cookie)
        const session = await getSessionByUserId(item.userId);
        if (!session) {
          await db
            .update(messageQueue)
            .set({ status: "failed" })
            .where(eq(messageQueue.id, item.id));
          await db.insert(agentLogs).values({
            userId: item.userId,
            action: "process_failed",
            source: item.source,
            input: `queue:${item.id} - no valid session`,
            output: "Session expired or not found",
          });
          continue;
        }

        // Get user settings
        const userSettings = await db
          .select()
          .from(settings)
          .where(eq(settings.userId, item.userId))
          .limit(1);

        const autoReply = userSettings[0]?.agentAutoReply ?? false;

        let subject = "";
        let fromAddress = "";
        let body = "";
        let aiResponse = "";

        if (item.source === "email") {
          // Fetch the specific email via Graph API
          const emails = await getEmails(session.accessToken, 50);
          const email = emails.find(
            (e: { id?: string }) => e.id === item.resourceId
          );

          if (!email) {
            await db
              .update(messageQueue)
              .set({ status: "failed" })
              .where(eq(messageQueue.id, item.id));
            continue;
          }

          subject = email.subject ?? "";
          fromAddress = email.from?.emailAddress?.address ?? "";
          body = email.bodyPreview ?? email.body?.content ?? "";

          // Update the queue item with fetched details
          await db
            .update(messageQueue)
            .set({ subject, fromAddress, body })
            .where(eq(messageQueue.id, item.id));

          // Generate AI response
          aiResponse = await generateEmailReply(
            item.userId,
            subject,
            body
          );

          if (autoReply) {
            await replyToEmail(
              session.accessToken,
              item.resourceId,
              aiResponse
            );
            await db
              .update(messageQueue)
              .set({
                status: "completed",
                aiResponse,
                processedAt: new Date(),
              })
              .where(eq(messageQueue.id, item.id));
            await db.insert(agentLogs).values({
              userId: item.userId,
              action: "auto_reply_sent",
              source: "email",
              input: `Subject: ${subject} | From: ${fromAddress}`,
              output: aiResponse,
            });
          } else {
            await db.insert(approvalResponses).values({
              userId: item.userId,
              queueId: item.id,
              draftResponse: aiResponse,
              source: "email",
              recipientInfo: fromAddress,
              status: "pending",
            });
            await db
              .update(messageQueue)
              .set({
                status: "awaiting_approval",
                aiResponse,
                processedAt: new Date(),
              })
              .where(eq(messageQueue.id, item.id));
            await db.insert(agentLogs).values({
              userId: item.userId,
              action: "reply_pending_approval",
              source: "email",
              input: `Subject: ${subject} | From: ${fromAddress}`,
              output: aiResponse,
            });
          }
        } else if (item.source === "teams") {
          const chatId = item.chatId;
          if (!chatId) {
            await db
              .update(messageQueue)
              .set({ status: "failed" })
              .where(eq(messageQueue.id, item.id));
            continue;
          }

          // Fetch recent messages from the chat
          const messages = await getChatMessages(
            session.accessToken,
            chatId,
            10
          );

          // Find the specific message
          const msg = messages.find(
            (m: { id?: string }) => m.id === item.resourceId
          );

          const msgText = msg?.body?.content?.replace(/<[^>]*>/g, "") ?? "";
          const senderName =
            msg?.from?.user?.displayName ?? "Unknown";
          fromAddress = senderName;
          body = msgText;

          // Build context from recent messages
          const chatContext = messages
            .slice(0, 5)
            .map(
              (m: {
                from?: { user?: { displayName?: string } };
                body?: { content?: string };
              }) =>
                `${m.from?.user?.displayName ?? "Unknown"}: ${m.body?.content?.replace(/<[^>]*>/g, "") ?? ""}`
            )
            .reverse()
            .join("\n");

          // Update queue item
          await db
            .update(messageQueue)
            .set({ fromAddress, body })
            .where(eq(messageQueue.id, item.id));

          // Generate AI response
          aiResponse = await generateTeamsReply(
            item.userId,
            chatContext
          );

          if (autoReply) {
            await sendTeamsMessage(
              session.accessToken,
              chatId,
              aiResponse
            );
            await db
              .update(messageQueue)
              .set({
                status: "completed",
                aiResponse,
                processedAt: new Date(),
              })
              .where(eq(messageQueue.id, item.id));
            await db.insert(agentLogs).values({
              userId: item.userId,
              action: "auto_reply_sent",
              source: "teams",
              input: `Chat: ${chatId} | Last from: ${senderName}`,
              output: aiResponse,
            });
          } else {
            await db.insert(approvalResponses).values({
              userId: item.userId,
              queueId: item.id,
              draftResponse: aiResponse,
              source: "teams",
              recipientInfo: `Chat: ${chatId}`,
              status: "pending",
            });
            await db
              .update(messageQueue)
              .set({
                status: "awaiting_approval",
                aiResponse,
                processedAt: new Date(),
              })
              .where(eq(messageQueue.id, item.id));
            await db.insert(agentLogs).values({
              userId: item.userId,
              action: "reply_pending_approval",
              source: "teams",
              input: `Chat: ${chatId} | Last from: ${senderName}`,
              output: aiResponse,
            });
          }
        }

        processedCount++;
      } catch (itemError) {
        console.error(`Error processing queue item ${item.id}:`, itemError);
        await db
          .update(messageQueue)
          .set({ status: "failed" })
          .where(eq(messageQueue.id, item.id));
        await db.insert(agentLogs).values({
          userId: item.userId,
          action: "process_error",
          source: item.source,
          input: `queue:${item.id}`,
          output:
            itemError instanceof Error
              ? itemError.message
              : "Unknown error",
        });
      }
    }

    return NextResponse.json({ processed: processedCount });
  } catch (error) {
    console.error("Process endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
