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
    console.error("CRITICAL DATABASE CONNECTION ERROR:", err);
    console.warn(
      "Could not connect to DATABASE_URL Postgres. Falling back to in-memory PGLite."
    );

    // fallback path into local pglite block
    if (isProduction && !forcePglite) {
      console.error(
        "FATAL: Falling back to in-memory PGLite in production! " +
        "DATA WILL NOT BE PERSISTED. Please check DATABASE_URL and network connectivity."
      );
    } else if (!isProduction || forcePglite) {
      console.log("Using mock PGLite database for local development...");
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
    // Check for essential categories
    const categories = await db.select().from(categoriesTable);
    const catMap = new Map(categories.map((c: any) => [c.productId || c.name, c.id]));

    async function getOrInsertCategory(name: string, description: string, productId: string | null, sortOrder: number) {
      const key = productId || name;
      if (catMap.has(key)) return catMap.get(key);
      
      console.log(`Seeding missing category: ${name}`);
      const [cat] = await db.insert(categoriesTable).values({ name, description, productId, sortOrder }).returning();
      catMap.set(key, cat.id);
      return cat.id;
    }

    const cat1Id = await getOrInsertCategory("General Discussions", "Talk about anything Scootware related", null, 1);
    const cat2Id = await getOrInsertCategory("Product Support", "Help with products and optimization", null, 2);

    const productIds = ["BODYCAM", "RUST", "DAYZ", "TARKOV", "CS2", "SPOOFER"];
    let currentOrder = 3;

    for (const productId of productIds) {
      const catId = await getOrInsertCategory(`${productId} Discussions`, `Exclusive forum for ${productId} owners`, productId, currentOrder++);
      
      // Ensure default subforums for this product
      const subforums = await db.select().from(subforumsTable).where(eq(subforumsTable.categoryId, catId));
      const sfNames = new Set(subforums.map((s: any) => s.name));

      if (!sfNames.has("Feature Showcase")) {
        await db.insert(subforumsTable).values({
          name: "Feature Showcase",
          description: "Official product showcase - showcasing the latest features, updates, and product demonstrations",
          categoryId: catId,
          sortOrder: 1,
          requiresUpgrade: false
        });
      }
      if (!sfNames.has("Community Configs")) {
        await db.insert(subforumsTable).values({
          name: "Community Configs",
          description: "Share your configs",
          categoryId: catId,
          sortOrder: 2,
          requiresUpgrade: false
        });
      }
    }

    // Also ensure general subforums
    const generalSubforums = await db.select().from(subforumsTable).where(eq(subforumsTable.categoryId, cat1Id));
    const genSfNames = new Set(generalSubforums.map((s: any) => s.name));
    
    const generalSfToEnsure = [
      { name: "News & Announcements", description: "Stay updated with latest releases", sortOrder: 1 },
      { name: "General Chat", description: "Casual talk with the community", sortOrder: 2 },
    ];

    for (const sf of generalSfToEnsure) {
      if (!genSfNames.has(sf.name)) {
        await db.insert(subforumsTable).values({ ...sf, categoryId: cat1Id });
      }
    }

    const supportSubforums = await db.select().from(subforumsTable).where(eq(subforumsTable.categoryId, cat2Id));
    const suppSfNames = new Set(supportSubforums.map((s: any) => s.name));

    const supportSfToEnsure = [
      { name: "Support Tickets", description: "Get official help", sortOrder: 1 },
      { name: "Troubleshooting Guide", description: "Share your best settings", sortOrder: 2 },
      { name: "Suggestions", description: "Share your ideas for new features and improvements", sortOrder: 3 },
    ];

    for (const sf of supportSfToEnsure) {
      if (!suppSfNames.has(sf.name)) {
        await db.insert(subforumsTable).values({ ...sf, categoryId: cat2Id });
      }
    }

  } catch (err) {
    console.warn("Failed to ensure database is seeded:", err);
  }
}

await ensureSeeded();
/*
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
*/
async function ensureSiteConfig() {
  try {
    // Check if the setting already exists to avoid overwriting user preference
    const existing = await db.select()
      .from(schema.siteConfigTable)
      .where(eq(schema.siteConfigTable.key, "requireEmailVerification"))
      .limit(1);

    if (existing.length === 0) {
      // Default to true if missing, as requested
      const configValue = "true";
      await db.insert(schema.siteConfigTable).values({
        key: "requireEmailVerification",
        value: configValue,
      });
      console.log(`Site config initialized: requireEmailVerification = ${configValue} (default)`);
    } else {
      console.log("Site config 'requireEmailVerification' already exists, skipping initialization.");
    }
  } catch (err) {
    console.warn("Failed to initialize site config:", err);
  }
}

/*
await ensureLocalAdminSeed();
await ensureLocalUserSeed();
*/
await ensureSiteConfig();

export * from "./schema";
