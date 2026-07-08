import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { contractRules } from "../db/schema.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";

export const contractRulesRouter = Router();
contractRulesRouter.use(authenticate);

// Mirrors the RuleConfig discriminated union in packages/shared, validated
// at the API boundary since the DB column is plain JSONB.
const ruleConfigSchema = z.discriminatedUnion("ruleType", [
  z.object({ ruleType: z.literal("lunch_deduction"), afterHours: z.number(), deductMinutes: z.number() }),
  z.object({ ruleType: z.literal("daily_cap"), maxHours: z.number() }),
  z.object({ ruleType: z.literal("rounding_early_start"), shiftStart: z.string() }),
  z.object({
    ruleType: z.literal("fixed_daily_rate"),
    minHoursForFullDay: z.number(),
    fullDayHours: z.number(),
  }),
  z.object({ ruleType: z.literal("friday_full_day"), fullDayHours: z.number() }),
]);

const createRuleSchema = z.object({
  companyId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  priority: z.number().int().optional(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  config: ruleConfigSchema,
});

contractRulesRouter.post("/", requireRole("admin"), async (req, res) => {
  const parsed = createRuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { config, ...rest } = parsed.data;

  const [rule] = await db
    .insert(contractRules)
    .values({
      ...rest,
      ruleType: config.ruleType,
      ruleConfig: config,
      createdBy: req.user!.sub,
    })
    .returning();

  await recordAudit({
    tableName: "contract_rules",
    recordId: rule.id,
    action: "insert",
    changedBy: req.user!.sub,
    newValues: rule,
  });

  res.status(201).json(rule);
});

contractRulesRouter.get("/", requireRole("admin", "engineer"), async (req, res) => {
  const companyId = req.query.companyId as string | undefined;
  const rows = companyId
    ? await db.select().from(contractRules).where(eq(contractRules.companyId, companyId))
    : await db.select().from(contractRules);
  res.json(rows);
});
