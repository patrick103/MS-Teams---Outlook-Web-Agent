import { eq, and, gt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createGraphClient } from "./graph";
import { db } from "../db";
import { graphSubscriptions } from "../db/schema";
import { env } from "./config";

function getWebhookUrl() {
  return `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/graph`;
}

// Mail subscriptions max out at ~60 minutes
const MAIL_EXPIRATION_MINUTES = 60;
// Teams subscriptions can last longer, but we keep it conservative
const TEAMS_EXPIRATION_MINUTES = 60;

function computeExpiration(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function createMailSubscription(
  accessToken: string,
  webhookUrl?: string
) {
  const client = createGraphClient(accessToken);
  const url = webhookUrl ?? getWebhookUrl();
  const expiration = computeExpiration(MAIL_EXPIRATION_MINUTES);

  const subscription = await client.api("/subscriptions").post({
    changeType: "created,updated",
    notificationUrl: url,
    resource: "/me/messages",
    expirationDateTime: expiration.toISOString(),
    includeResourceData: false,
  });

  return subscription;
}

export async function createTeamsSubscription(
  accessToken: string,
  webhookUrl?: string,
  chatId?: string
) {
  const client = createGraphClient(accessToken);
  const url = webhookUrl ?? getWebhookUrl();
  const expiration = computeExpiration(TEAMS_EXPIRATION_MINUTES);

  const resource = chatId
    ? `/chats/${chatId}/messages`
    : "/me/chats/getAllMessages";

  const subscription = await client.api("/subscriptions").post({
    changeType: "created,updated",
    notificationUrl: url,
    resource,
    expirationDateTime: expiration.toISOString(),
    includeResourceData: false,
  });

  return subscription;
}

export async function renewSubscription(
  accessToken: string,
  subscriptionId: string,
  newExpiration: Date
) {
  const client = createGraphClient(accessToken);

  const updated = await client.api(`/subscriptions/${subscriptionId}`).patch({
    expirationDateTime: newExpiration.toISOString(),
  });

  return updated;
}

export async function deleteSubscription(
  accessToken: string,
  subscriptionId: string
) {
  const client = createGraphClient(accessToken);
  await client.api(`/subscriptions/${subscriptionId}`).delete();
}

export async function initializeSubscriptions(
  userId: string,
  accessToken: string
) {
  const now = new Date();
  const webhookUrl = getWebhookUrl();

  const existing = await db
    .select()
    .from(graphSubscriptions)
    .where(
      and(
        eq(graphSubscriptions.userId, userId),
        gt(graphSubscriptions.expirationDateTime, now)
      )
    );

  const hasMail = existing.some((s) => s.resource === "/me/messages");
  const hasTeams = existing.some((s) =>
    s.resource.startsWith("/me/chats") || s.resource.startsWith("/chats/")
  );

  const results: { resource: string; subscriptionId: string }[] = [];

  if (!hasMail) {
    const sub = await createMailSubscription(accessToken, webhookUrl);
    const record = {
      id: uuidv4(),
      userId,
      resource: "/me/messages",
      subscriptionId: sub.id,
      expirationDateTime: new Date(sub.expirationDateTime),
      changeType: "created,updated",
    };
    await db.insert(graphSubscriptions).values(record);
    results.push({ resource: record.resource, subscriptionId: record.subscriptionId });
  }

  if (!hasTeams) {
    const sub = await createTeamsSubscription(accessToken, webhookUrl);
    const resource = sub.resource ?? "/me/chats/getAllMessages";
    const record = {
      id: uuidv4(),
      userId,
      resource,
      subscriptionId: sub.id,
      expirationDateTime: new Date(sub.expirationDateTime),
      changeType: "created,updated",
    };
    await db.insert(graphSubscriptions).values(record);
    results.push({ resource: record.resource, subscriptionId: record.subscriptionId });
  }

  return { created: results, existing: existing.map((s) => ({ resource: s.resource, subscriptionId: s.subscriptionId })) };
}

export async function renewAllSubscriptions(
  userId: string,
  accessToken: string
) {
  const now = new Date();

  const active = await db
    .select()
    .from(graphSubscriptions)
    .where(
      and(
        eq(graphSubscriptions.userId, userId),
        gt(graphSubscriptions.expirationDateTime, now)
      )
    );

  const results: { subscriptionId: string; resource: string; newExpiration: string }[] = [];
  const errors: { subscriptionId: string; error: string }[] = [];

  for (const sub of active) {
    try {
      const isMail = sub.resource === "/me/messages";
      const minutes = isMail ? MAIL_EXPIRATION_MINUTES : TEAMS_EXPIRATION_MINUTES;
      const newExpiration = computeExpiration(minutes);

      await renewSubscription(accessToken, sub.subscriptionId, newExpiration);

      await db
        .update(graphSubscriptions)
        .set({ expirationDateTime: newExpiration, updatedAt: new Date() })
        .where(eq(graphSubscriptions.subscriptionId, sub.subscriptionId));

      results.push({
        subscriptionId: sub.subscriptionId,
        resource: sub.resource,
        newExpiration: newExpiration.toISOString(),
      });
    } catch (err) {
      errors.push({
        subscriptionId: sub.subscriptionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { renewed: results, errors };
}
