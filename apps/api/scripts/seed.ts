import bcrypt from "bcrypt";
import { db, pool } from "../src/db/client.js";
import { users, items } from "../src/db/schema.js";

const SEED_ITEMS = [
  { itemCode: "MAT-SAND", description: "חול", resourceType: "material" as const, unit: "מ\"ק" },
  { itemCode: "MAT-CEMENT", description: "צמנט", resourceType: "material" as const, unit: "טון" },
  { itemCode: "MAT-REBAR", description: "פלדת זיון", resourceType: "material" as const, unit: "טון" },
  { itemCode: "LAB-GENERAL", description: "עבודה כללית", resourceType: "labor" as const, unit: "שעה" },
  { itemCode: "EQ-CRANE", description: "עגורן", resourceType: "equipment" as const, unit: "שעה" },
  { itemCode: "SRV-TRANSPORT", description: "הסעות", resourceType: "service" as const, unit: "יחידה" },
];

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

  for (const item of SEED_ITEMS) {
    await db.insert(items).values(item).onConflictDoNothing({ target: items.itemCode });
  }
  console.log(`Seeded ${SEED_ITEMS.length} catalog items (skipping any that already exist).`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
