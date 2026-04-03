import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET || "super-secret");

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: number };
  } catch (err) {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      upgradeType: user.upgradeType,
      upgradeExpiresAt: user.upgradeExpiresAt,
      avatarUrl: user.avatarUrl,
      isBanned: user.isBanned,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      postCount: user.postCount,
    };
  } catch (err) {
    return null;
  }
}
