import "dotenv/config";
import { drizzle as nodeDrizzle } from "drizzle-orm/node-postgres";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { categoriesTable, subforumsTable } from "./schema";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

export let db: any;
export let pool: any;

const isProduction = process.env.NODE_ENV === "production";
const forcePglite =
  process.env.USE_PGLITE_DB === "1" ||
  process.env.USE_PGLITE_DB?.toLowerCase() === "true";

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = nodeDrizzle(pool, { schema });

    // Validate startup DB connection early to avoid half-initialized build/server failures.
    await pool.query("SELECT 1");

    console.log("Connected to PostgreSQL via DATABASE_URL.");
  } catch (err) {
    console.warn(
      "Could not connect to DATABASE_URL Postgres, falling back to in-memory PGLite for this process:",
      err
    );

    // fallback path into local pglite block
    if (isProduction && !forcePglite) {
      console.warn(
        "WARNING: Falling back to in-memory PGLite in production. " +
        "This is intended for 1-off tasks build/test only and will NOT persist data across restarts."
      );
    } else if (!isProduction || forcePglite) {
      console.log("Using mock PGLite database due to Postgres connection failure...");
    }

    console.log("Using in-memory PGLite database...");
    const rootDir = path.resolve(__dirname, "../../..");
    const client = new PGlite();
    pool = client;
    db = pgliteDrizzle(client, { schema });

    // Apply schema to in-memory PGLite
    try {
      const drizzleDir = path.resolve(rootDir, "lib/db/drizzle");
      if (fs.existsSync(drizzleDir)) {
        const files = fs.readdirSync(drizzleDir).filter(f => f.endsWith(".sql")).sort();
        for (const file of files) {
          const migrationPath = path.join(drizzleDir, file);
          const sql = fs.readFileSync(migrationPath, "utf8");
          await client.exec(sql);
          console.log(`Mock database migration ${file} applied successfully.`);
        }
      } else {
        console.warn("Drizzle migration directory not found at:", drizzleDir);
      }
    } catch (err2) {
      console.error("Failed to apply mock schema:", err2);
    }
  }
} else {
  if (isProduction && !forcePglite) {
    console.warn(
      "WARNING: DATABASE_URL not set in production. Falling back to in-memory PGLite. " +
      "This is intended for offline/testing only and will NOT persist data across restarts."
    );
  } else if (!isProduction || forcePglite) {
    console.log("DATABASE_URL not set, using mock PGLite database...");
  }
  console.log("Using in-memory PGLite database...");
  const rootDir = path.resolve(__dirname, "../../..");
  const client = new PGlite();
  pool = client;
  db = pgliteDrizzle(client, { schema });

  // Apply schema to in-memory PGLite
  try {
    const drizzleDir = path.resolve(rootDir, "lib/db/drizzle");
    
    if (fs.existsSync(drizzleDir)) {
      const files = fs.readdirSync(drizzleDir)
        .filter(f => f.endsWith(".sql"))
        .sort(); // Apply migrations in order

      for (const file of files) {
        const migrationPath = path.join(drizzleDir, file);
        const sql = fs.readFileSync(migrationPath, "utf8");
        await client.exec(sql);
        console.log(`Mock database migration ${file} applied successfully.`);
      }
    } else {
      console.warn("Drizzle migration directory not found at:", drizzleDir);
    }
  } catch (err) {
    console.error("Failed to apply mock schema:", err);
  }
}

// Ensure the database is seeded regardless of whether it's PGLite or Postgres
async function ensureSeeded() {
  try {
    const existingCategories = await db.select().from(categoriesTable).limit(1);
    if (existingCategories.length === 0) {
      console.log("Seeding initial forum data...");
      const [cat1] = await db.insert(categoriesTable).values({
        name: "General Discussions",
        description: "Talk about anything Scootware related",
        sortOrder: 1,
      }).returning();

      const [cat2] = await db.insert(categoriesTable).values({
        name: "Product Support",
        description: "Help with products and optimization",
        sortOrder: 2,
      }).returning();

      const subforumsToInsert = [
        { name: "News & Announcements", description: "Stay updated with latest releases", categoryId: cat1.id, sortOrder: 1 },
        { name: "General Chat", description: "Casual talk with the community", categoryId: cat1.id, sortOrder: 2 },
        { name: "Support Tickets", description: "Get official help", categoryId: cat2.id, sortOrder: 1 },
        { name: "Troubleshooting Guide", description: "Share your best settings", categoryId: cat2.id, sortOrder: 2 },
        { name: "Suggestions", description: "Share your ideas for new features and improvements", categoryId: cat2.id, sortOrder: 3 },
      ];

      const productIds = ["BODYCAM", "RUST", "DAYZ", "TARKOV", "SPOOFER"];
      let currentOrder = 3;

      for (const productId of productIds) {
        const [productCat] = await db.insert(categoriesTable).values({
          name: `${productId} Discussions`,
          description: `Exclusive forum for ${productId} owners`,
          productId: productId,
          sortOrder: currentOrder++,
        }).returning();

        subforumsToInsert.push(
          { name: "Feature Showcase", description: "Show off your gameplay clips and highlights", categoryId: productCat.id, sortOrder: 1, requiresUpgrade: false } as any,
          { name: "Community Configs", description: "Share your configs", categoryId: productCat.id, sortOrder: 2, requiresUpgrade: false } as any
        );
      }

      await db.insert(subforumsTable).values(subforumsToInsert);
      console.log("Initial forum data seeded successfully.");
    }
  } catch (err) {
    console.warn("Failed to seed initial data:", err);
  }
}

await ensureSeeded();

async function ensureLocalAdminSeed() {
  try {
    // Enable local admin account creation for easier initial setup and testing
    // (Can be disabled later by adding back the early return)

    const adminUsername = process.env.LOCAL_ADMIN_USERNAME || "local-admin";
    const adminPassword = process.env.LOCAL_ADMIN_PASSWORD || "localadmin123";
    const adminEmail = process.env.LOCAL_ADMIN_EMAIL || "local-admin@scootware.test";

    // Generate hash for the password
    let passwordHash: string;
    if (process.env.LOCAL_ADMIN_PASSWORD_HASH) {
      passwordHash = process.env.LOCAL_ADMIN_PASSWORD_HASH;
    } else {
      passwordHash = await bcrypt.hash(adminPassword, 12);
    }

    const existingAdmin = await db.select().from(schema.usersTable).where(eq(schema.usersTable.username, adminUsername)).limit(1);
    if (existingAdmin.length === 0) {
      await db.insert(schema.usersTable).values({
        username: adminUsername,
        email: adminEmail,
        passwordHash,
        role: "admin",
        isEmailVerified: true,
      });
      console.log(`Local admin created: ${adminUsername} / ${adminPassword}`);
    } else {
      await db.update(schema.usersTable)
        .set({ role: "admin", passwordHash, isEmailVerified: true })
        .where(eq(schema.usersTable.username, adminUsername));
      console.log(`Local admin verified/updated: ${adminUsername}`);
    }

    // existing admin backdoor fallback for convenience
    try {
      await db.update(schema.usersTable)
        .set({ role: "admin" })
        .where(eq(schema.usersTable.username, "[TEST_USERNAME]"));
      console.log("Mattshanks42 privileges checked/granted.");
    } catch (err) {
      console.warn("Could not set admin privileges for [TEST_USERNAME]", err);
    }
  } catch (err) {
    console.warn("Skipping local admin seed due to DB error on startup:", err);
  }
}

async function ensureLocalUserSeed() {
  try {
    // Create a standard test user for offline/testing scenarios
    const userUsername = process.env.LOCAL_USER_USERNAME || "testuser";
    const userPassword = process.env.LOCAL_USER_PASSWORD || "testuser123";
    const userEmail = process.env.LOCAL_USER_EMAIL || "testuser@scootware.test";

    // Generate hash for the password
    let passwordHash: string;
    if (process.env.LOCAL_USER_PASSWORD_HASH) {
      passwordHash = process.env.LOCAL_USER_PASSWORD_HASH;
    } else {
      passwordHash = await bcrypt.hash(userPassword, 12);
    }

    const existingUser = await db.select().from(schema.usersTable).where(eq(schema.usersTable.username, userUsername)).limit(1);
    if (existingUser.length === 0) {
      await db.insert(schema.usersTable).values({
        username: userUsername,
        email: userEmail,
        passwordHash,
        role: "user",
        isEmailVerified: true,
      });
      console.log(`Local test user created: ${userUsername} / ${userPassword}`);
    } else {
      await db.update(schema.usersTable)
        .set({ role: "user", passwordHash, isEmailVerified: true })
        .where(eq(schema.usersTable.username, userUsername));
      console.log(`Local test user verified/updated: ${userUsername}`);
    }
  } catch (err) {
    console.warn("Skipping local user seed due to DB error on startup:", err);
  }
}

async function ensureSiteConfig() {
  try {
    // Default: disable email verification for all users
    // Users can still verify their email, but it won't block login
    const configValue = "false";
    
    try {
      // Always delete and recreate to ensure correct value
      await db.delete(schema.siteConfigTable)
        .where(eq(schema.siteConfigTable.key, "requireEmailVerification"));
    } catch (err) {
      // Might fail if row doesn't exist, which is fine
    }
    
    // Create fresh config entry
    await db.insert(schema.siteConfigTable).values({
      key: "requireEmailVerification",
      value: configValue,
    });
    console.log(`Site config initialized: requireEmailVerification = ${configValue}`);
  } catch (err) {
    console.warn("Failed to initialize site config:", err);
  }
}

await ensureLocalAdminSeed();
await ensureLocalUserSeed();
await ensureSiteConfig();

export * from "./schema";
