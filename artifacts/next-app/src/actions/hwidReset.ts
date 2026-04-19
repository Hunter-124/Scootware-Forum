"use server";

import { revalidatePath } from "next/cache";
import { db, hwidResetRequestsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("Unauthorized");
  return user;
}

export async function approveHwidResetAction(requestId: number): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();

    const [request] = await db
      .select()
      .from(hwidResetRequestsTable)
      .where(eq(hwidResetRequestsTable.id, requestId))
      .limit(1);

    if (!request) return { error: "Request not found" };
    if (request.status !== "pending") return { error: `Request is already ${request.status}` };

    await db
      .update(usersTable)
      .set({ hwid: request.newHwid })
      .where(eq(usersTable.id, request.userId));

    await db
      .update(hwidResetRequestsTable)
      .set({ status: "approved", resolvedAt: new Date(), resolvedBy: admin.id })
      .where(eq(hwidResetRequestsTable.id, requestId));

    revalidatePath("/admin");
    return {};
  } catch (err: any) {
    return { error: err?.message || "Failed to approve request" };
  }
}

export async function denyHwidResetAction(requestId: number): Promise<{ error?: string }> {
  try {
    const admin = await requireAdmin();

    const [request] = await db
      .select({ id: hwidResetRequestsTable.id, status: hwidResetRequestsTable.status })
      .from(hwidResetRequestsTable)
      .where(eq(hwidResetRequestsTable.id, requestId))
      .limit(1);

    if (!request) return { error: "Request not found" };
    if (request.status !== "pending") return { error: `Request is already ${request.status}` };

    await db
      .update(hwidResetRequestsTable)
      .set({ status: "denied", resolvedAt: new Date(), resolvedBy: admin.id })
      .where(eq(hwidResetRequestsTable.id, requestId));

    revalidatePath("/admin");
    return {};
  } catch (err: any) {
    return { error: err?.message || "Failed to deny request" };
  }
}
