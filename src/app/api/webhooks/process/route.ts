import { NextResponse } from "next/server";
import { db } from "@/db";
import { messageQueue, approvalResponses, settings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getTokenForUserId } from "@/lib/auth-helpers";
import { getEmailById, getChatMessages, replyToEmail, sendTeamsMessage } from "@/lib/graph";
import { generateEmailReply, generateTeamsReply, logAction } from "@/lib/agent";

export async function POST() {
  const pendingItems = await db
    .select()
    .from(messageQueue)
    .where(eq(messageQueue.status, "pending"))
    .limit(20);

  if (pendingItems.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      await db
        .update(messageQueue)
        .set({ status: "processing" })
        .where(eq(messageQueue.id, item.id));

      const token = await getTokenForUserId(item.userId);
      if (!token) {
        await db
          .update(messageQueue)
          .set({ status: "failed" })
          .where(eq(messageQueue.id, item.id));
        failed++;
        continue;
      }

      let subject = "";
      let body = "";
      let fromAddress = "";
      let chatId = item.chatId;

      if (item.source === "email") {
        const email = await getEmailById(token, item.resourceId);
        subject = email.subject ?? "";
        body = email.body?.content ?? email.bodyPreview ?? "";
        fromAddress = email.from?.emailAddress?.address ?? "";
      } else {
        if (!chatId) {
          await db
            .update(messageQueue)
            .set({ status: "failed" })
            .where(eq(messageQueue.id, item.id));
          failed++;
          continue;
        }

        const messages = await getChatMessages(token, chatId);
        const message = messages.find(
          (m: { id: string }) => m.id === item.resourceId
        );
        if (message) {
          subject = `Teams message in chat ${chatId}`;
          body =
            message.body?.content?.replace(/<[^>]*>/g, "") ??
            message.body?.content ??
            "";
          fromAddress = message.from?.user?.displayName ?? "Unknown";
        }
      }

      await db
        .update(messageQueue)
        .set({ subject, body, fromAddress, chatId })
        .where(eq(messageQueue.id, item.id));

      let aiResponse: string;
      if (item.source === "email") {
        aiResponse = await generateEmailReply(item.userId, subject, body);
      } else {
        aiResponse = await generateTeamsReply(item.userId, body);
      }

      await db
        .update(messageQueue)
        .set({ aiResponse })
        .where(eq(messageQueue.id, item.id));

      const userSettings = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, item.userId))
        .limit(1);

      const autoReply = userSettings[0]?.agentAutoReply ?? false;

      if (autoReply) {
        if (item.source === "email") {
          await replyToEmail(token, item.resourceId, aiResponse);
        } else if (chatId) {
          await sendTeamsMessage(token, chatId, aiResponse);
        }

        await db
          .update(messageQueue)
          .set({ status: "completed", processedAt: new Date() })
          .where(eq(messageQueue.id, item.id));

        await logAction(
          item.userId,
          "auto_reply",
          item.source,
          `Message from ${fromAddress}: ${subject || body.slice(0, 100)}`,
          aiResponse
        );
      } else {
        await db.insert(approvalResponses).values({
          userId: item.userId,
          queueId: item.id,
          draftResponse: aiResponse,
          source: item.source,
          recipientInfo: fromAddress,
          status: "pending",
        });

        await db
          .update(messageQueue)
          .set({ status: "awaiting_approval", processedAt: new Date() })
          .where(eq(messageQueue.id, item.id));

        await logAction(
          item.userId,
          "pending_approval",
          item.source,
          `Message from ${fromAddress}: ${subject || body.slice(0, 100)}`,
          aiResponse
        );
      }

      processed++;
    } catch (error) {
      console.error(`Failed to process queue item ${item.id}:`, error);
      await db
        .update(messageQueue)
        .set({ status: "failed" })
        .where(eq(messageQueue.id, item.id));
      failed++;
    }
  }

  return NextResponse.json({ processed, failed, total: pendingItems.length });
}
