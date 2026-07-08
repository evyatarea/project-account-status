import { Router } from "express";
import { z } from "zod";
import { and, eq, inArray, isNull, lte, or, gte } from "drizzle-orm";
import type { RuleConfig } from "@project/shared";
import { db } from "../db/client.js";
import { attendanceRaw, contractRules, dailyLogs, resourceRows } from "../db/schema.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";
import { calculateDailyPay } from "../services/rulesEngine.js";

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

const ingestSchema = z.object({
  companyId: z.string().uuid(),
  projectId: z.string().uuid(),
  workerRef: z.string().min(1),
  workDate: z.string(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  source: z.string().optional(),
});

// Simulates importing biometric punches (Phase 1: manual/CSV-style entry;
// Phase 2: replaced by a real biometric/Priority feed).
attendanceRouter.post("/", requireRole("admin", "engineer"), async (req, res) => {
  const parsed = ingestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { checkIn, checkOut, ...rest } = parsed.data;

  const [record] = await db
    .insert(attendanceRaw)
    .values({
      ...rest,
      checkIn: checkIn ? new Date(checkIn) : undefined,
      checkOut: checkOut ? new Date(checkOut) : undefined,
    })
    .returning();

  await recordAudit({
    tableName: "attendance_raw",
    recordId: record.id,
    action: "insert",
    changedBy: req.user!.sub,
    newValues: record,
  });

  res.status(201).json(record);
});

attendanceRouter.get("/", requireRole("admin", "engineer"), async (req, res) => {
  const companyId = req.query.companyId as string | undefined;
  const unprocessedOnly = req.query.unprocessed === "true";

  const conditions = [];
  if (companyId) conditions.push(eq(attendanceRaw.companyId, companyId));
  if (unprocessedOnly) conditions.push(isNull(attendanceRaw.resourceRowId));

  const rows = conditions.length
    ? await db.select().from(attendanceRaw).where(and(...conditions))
    : await db.select().from(attendanceRaw);
  res.json(rows);
});

const processSchema = z.object({
  dailyLogId: z.string().uuid(),
  attendanceIds: z.array(z.string().uuid()).min(1),
});

// Converts unprocessed attendance_raw punches into labor resource_rows,
// running each worker's punch through that company's active rules engine
// configuration and attaching the rule breakdown to the row's notes.
attendanceRouter.post("/process", requireRole("admin", "engineer"), async (req, res) => {
  const parsed = processSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { dailyLogId, attendanceIds } = parsed.data;

  const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, dailyLogId)).limit(1);
  if (!log) return res.status(404).json({ error: "Daily log not found" });

  const punches = await db
    .select()
    .from(attendanceRaw)
    .where(and(inArray(attendanceRaw.id, attendanceIds), isNull(attendanceRaw.resourceRowId)));

  const created = [];
  for (const punch of punches) {
    if (!punch.checkIn || !punch.checkOut) continue;

    const activeRules = await db
      .select()
      .from(contractRules)
      .where(
        and(
          eq(contractRules.companyId, punch.companyId),
          eq(contractRules.isActive, true),
          or(isNull(contractRules.projectId), eq(contractRules.projectId, punch.projectId)),
          lte(contractRules.effectiveFrom, punch.workDate),
          or(isNull(contractRules.effectiveTo), gte(contractRules.effectiveTo, punch.workDate)),
        ),
      );

    const ruleConfigs = activeRules
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.ruleConfig as RuleConfig);

    const { rawHours, paidHours, breakdown } = calculateDailyPay(
      punch.checkIn,
      punch.checkOut,
      new Date(punch.workDate),
      ruleConfigs,
    );

    const [row] = await db
      .insert(resourceRows)
      .values({
        dailyLogId,
        projectId: log.projectId,
        reporterId: req.user!.sub,
        resourceType: "labor",
        companyId: punch.companyId,
        quantityReported: String(paidHours),
        unit: "שעה",
        rawHours: String(rawHours),
        calculatedHours: String(paidHours),
        notes: `עובד ${punch.workerRef} — ${breakdown.map((b) => b.description).join("; ") || "ללא חוקים"}`,
      })
      .returning();

    await db.update(attendanceRaw).set({ resourceRowId: row.id }).where(eq(attendanceRaw.id, punch.id));

    await recordAudit({
      tableName: "resource_rows",
      recordId: row.id,
      action: "insert",
      changedBy: req.user!.sub,
      newValues: { ...row, rulesApplied: breakdown },
    });

    created.push(row);
  }

  res.status(201).json(created);
});
