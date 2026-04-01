import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getVerifiedSession } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const session = await getVerifiedSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const logs = await db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.userId, session.userId))
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit);

  return NextResponse.json({ logs });
}
