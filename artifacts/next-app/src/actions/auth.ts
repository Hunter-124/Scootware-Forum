"use server";

import { db, usersTable, siteConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET || "super-secret");

export async function loginAction(prevState: any, formData: FormData) {
  const identifier = (formData.get("identifier") as string) || (formData.get("email") as string);
  const password = formData.get("password") as string;

  if (!identifier || !password) {
    return { error: "Email/username and password are required" };
  }

  try {
    const isEmail = identifier.includes("@");
    const query = isEmail
      ? eq(usersTable.email, identifier.toLowerCase())
      : eq(usersTable.username, identifier);

    const [user] = await db
      .select()
      .from(usersTable)
      .where(query)
      .limit(1);

    if (!user || !user.passwordHash) {
      return { error: "Invalid credentials" };
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return { error: "Invalid credentials" };
    }

    if (user.isBanned) {
      return { error: `Account banned: ${user.banReason || "Contact support"}` };
    }

    // Example reading from siteConfigTable
    // Email verification is optional - allow login immediately after registration
    // let requireEmailVerification = true;
    // try {
    //   const rows = await db
    //     .select()
    //     .from(siteConfigTable)
    //     .where(eq(siteConfigTable.key, "requireEmailVerification"));
    //   if (rows.length > 0) {
    //     requireEmailVerification = rows[0].value !== "false";
    //   }
    // } catch (_) {}

    // if (requireEmailVerification && !user.isEmailVerified) {
    //   return { error: "Please verify your email address before logging in." };
    // }

    // Create session string
    const token = await new SignJWT({ userId: user.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return { success: true };
  } catch (err) {
    console.error("Login error:", err);
    return { error: "Internal server error" };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  return { success: true };
}

export async function registerAction(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!email || !username || !password) {
    return { error: "All fields are required" };
  }

  try {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      return { error: "Email already registered" };
    }

    const [existingUsername] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (existingUsername) {
      return { error: "Username already taken" };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db.insert(usersTable).values({
      username,
      email: email.toLowerCase(),
      passwordHash,
      isEmailVerified: false,
    }).returning();

    return { success: true, message: "Account created successfully." };
  } catch (err) {
    console.error("Register error:", err);
    return { error: "Internal server error" };
  }
}
