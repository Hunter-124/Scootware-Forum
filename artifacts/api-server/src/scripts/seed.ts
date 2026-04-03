import { db } from "@workspace/db";
import { categoriesTable, subforumsTable, usersTable } from "@workspace/db";
import bcrypt from "bcrypt";

async function main() {
  console.log("Starting production database seed...");
  
  try {
    const existingCategories = await db.select().from(categoriesTable).limit(1);
    if (existingCategories.length > 0) {
      console.log("Database already contains categories. Seeding skipped.");
      process.exit(0);
    }

    // 1. Insert Categories
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

    // 2. Insert Standard Subforums
    const subforumsToInsert = [
      { name: "News & Announcements", description: "Stay updated with latest releases", categoryId: cat1.id, sortOrder: 1 },
      { name: "General Chat", description: "Casual talk with the community", categoryId: cat1.id, sortOrder: 2 },
      { name: "Support Tickets", description: "Get official help", categoryId: cat2.id, sortOrder: 1 },
      { name: "Troubleshooting Guide", description: "Share your best settings", categoryId: cat2.id, sortOrder: 2 },
      { name: "Suggestions", description: "Share your ideas for new features and improvements", categoryId: cat2.id, sortOrder: 3 },
    ];

    // 3. Insert Product Categories & Subforums
    const productIds = ["BODYCAM", "RUST", "DAYZ", "TARKOV", "SPOOFER"];
    let currentOrder = 3;

    for (const productId of productIds) {
      const [productCat] = await db.insert(categoriesTable).values({
        name: `${productId} Discussions`,
        description: `Exclusive forum for ${productId} owners`,
        productId: productId,
        sortOrder: currentOrder++,
      }).returning();

      const subforums = [
        { name: "Feature Showcase", description: "Show off your gameplay clips and highlights", categoryId: productCat.id, sortOrder: 1, requiresUpgrade: false } as any
      ];

      if (productId !== "SPOOFER") {
        subforums.push({ name: "Community Configs", description: "Share your configs", categoryId: productCat.id, sortOrder: 2, requiresUpgrade: false } as any);
      }

      subforumsToInsert.push(...subforums);
    }

    await db.insert(subforumsTable).values(subforumsToInsert);

    // 4. Insert Test Admin and User Accounts
    const adminPassword = "localadmin123";
    const userPassword = "testuser123";
    const adminHash = await bcrypt.hash(adminPassword, 12);
    const userHash = await bcrypt.hash(userPassword, 12);

    await db.insert(usersTable).values([
      {
        username: "local-admin",
        email: "local-admin@scootware.test",
        passwordHash: adminHash,
        role: "admin",
        isEmailVerified: true,
        upgradeType: null,
      },
      {
        username: "testuser",
        email: "testuser@scootware.test",
        passwordHash: userHash,
        role: "user",
        isEmailVerified: true,
        upgradeType: "SPOOFER_PREMIUM",
      },
    ]);

    console.log("Database seeded with categories, subforums, and test credentials!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

main();
