import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const userId = request.cookies.get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const logs = await db
    .select()
    .from(agentLogs)
    .where(eq(agentLogs.userId, userId))
    .orderBy(desc(agentLogs.createdAt))
    .limit(limit);

  return NextResponse.json({ logs });
}
