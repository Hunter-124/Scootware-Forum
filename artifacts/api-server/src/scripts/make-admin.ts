import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function makeAdmin() {
  const username = "[TEST_USERNAME]";
  console.log(`Setting user ${username} as admin...`);
  
  const result = await db.update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.username, username))
    .returning();
    
  if (result.length > 0) {
    console.log(`User ${username} is now an admin.`);
  } else {
    console.log(`User ${username} not found.`);
  }
  process.exit(0);
}

makeAdmin().catch((err) => {
  console.error("Failed to make admin:", err);
  process.exit(1);
});
