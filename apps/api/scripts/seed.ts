import bcrypt from "bcrypt";
import { db, pool } from "../src/db/client.js";
import { users } from "../src/db/schema.js";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

  const passwordHash = await bcrypt.hash(password, 12);
  const [admin] = await db
    .insert(users)
    .values({ fullName: "System Admin", email, passwordHash, role: "admin" })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (admin) {
    console.log(`Seeded admin user: ${email} / ${password}`);
  } else {
    console.log(`Admin user ${email} already exists, skipped.`);
  }
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
