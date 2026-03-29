import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings, agentLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getVerifiedSession } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const session = await getVerifiedSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, session.userId))
    .limit(1);

  if (result.length === 0) {
    return NextResponse.json({
      openrouterApiKey: "",
      openrouterModel: "anthropic/claude-sonnet-4",
      agentAutoReply: false,
      agentAutoSummary: false,
      agentTone: "professional",
    });
  }

  const s = result[0];
  return NextResponse.json({
    openrouterApiKey: s.openrouterApiKey ? "***" + s.openrouterApiKey.slice(-4) : "",
    openrouterModel: s.openrouterModel,
    agentAutoReply: s.agentAutoReply,
    agentAutoSummary: s.agentAutoSummary,
    agentTone: s.agentTone,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getVerifiedSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Fix 4: Skip API key update if the incoming value is the masked placeholder
    if (body.openrouterApiKey !== undefined) {
      if (!body.openrouterApiKey.startsWith("***")) {
        updateData.openrouterApiKey = body.openrouterApiKey;
      }
      // If it starts with "***", it's the masked value — don't overwrite the real key
    }

    if (body.openrouterModel !== undefined) updateData.openrouterModel = body.openrouterModel;
    if (body.agentAutoReply !== undefined) updateData.agentAutoReply = body.agentAutoReply;
    if (body.agentAutoSummary !== undefined) updateData.agentAutoSummary = body.agentAutoSummary;
    if (body.agentTone !== undefined) updateData.agentTone = body.agentTone;

    await db
      .insert(settings)
      .values({ userId: session.userId, ...updateData })
      .onConflictDoUpdate({
        target: settings.userId,
        set: updateData,
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
