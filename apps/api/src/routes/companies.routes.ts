import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { companies } from "../db/schema.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";

export const companiesRouter = Router();
companiesRouter.use(authenticate);

const createCompanySchema = z.object({
  name: z.string().min(1),
  taxId: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});

companiesRouter.post("/", requireRole("admin", "engineer"), async (req, res) => {
  const parsed = createCompanySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [company] = await db.insert(companies).values(parsed.data).returning();

  await recordAudit({
    tableName: "companies",
    recordId: company.id,
    action: "insert",
    changedBy: req.user!.sub,
    newValues: company,
  });

  res.status(201).json(company);
});

companiesRouter.get("/", async (_req, res) => {
  res.json(await db.select().from(companies));
});
