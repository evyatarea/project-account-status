import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { items } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";

export const itemsRouter = Router();
itemsRouter.use(authenticate);

itemsRouter.get("/", async (_req, res) => {
  const rows = await db.select().from(items).where(eq(items.isActive, true));
  res.json(rows);
});
