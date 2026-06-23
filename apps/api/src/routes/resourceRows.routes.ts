import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { canTransition, type PaymentStatus } from "@project/shared";
import { db } from "../db/client.js";
import { dailyLogs, resourceRows } from "../db/schema.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";

export const resourceRowsRouter = Router();
resourceRowsRouter.use(authenticate);

const createRowSchema = z.object({
  dailyLogId: z.string().uuid(),
  resourceType: z.enum(["material", "labor", "equipment", "service"]),
  itemId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  quantityReported: z.number(),
  unit: z.string().min(1),
  deliveryTicketNumber: z.string().optional(),
  rawHours: z.number().optional(),
  unitPrice: z.number().optional(),
  notes: z.string().optional(),
});

// The core write-path guard: a site manager may only add a row to a log
// that (a) belongs to them and (b) is still open. Engineer/admin can also
// add rows (e.g. corrections) but are not restricted to "their own" log.
resourceRowsRouter.post("/", requireRole("admin", "engineer", "site_manager"), async (req, res) => {
  const parsed = createRowSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { dailyLogId } = parsed.data;

  const [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.id, dailyLogId)).limit(1);
  if (!log) return res.status(404).json({ error: "Daily log not found" });

  if (req.user!.role === "site_manager") {
    if (log.siteManagerId !== req.user!.sub) {
      return res.status(403).json({ error: "This log is not assigned to you" });
    }
    if (log.status !== "open") {
      return res.status(409).json({ error: "This log is closed" });
    }
  }

  const { quantityReported, rawHours, unitPrice, ...rest } = parsed.data;
  const [row] = await db
    .insert(resourceRows)
    .values({
      ...rest,
      quantityReported: String(quantityReported),
      rawHours: rawHours !== undefined ? String(rawHours) : undefined,
      unitPrice: unitPrice !== undefined ? String(unitPrice) : undefined,
      projectId: log.projectId,
      reporterId: req.user!.sub,
    })
    .returning();

  await recordAudit({
    tableName: "resource_rows",
    recordId: row.id,
    action: "insert",
    changedBy: req.user!.sub,
    newValues: row,
  });

  res.status(201).json(row);
});

resourceRowsRouter.get("/", async (req, res) => {
  const dailyLogId = req.query.dailyLogId as string | undefined;
  const projectId = req.query.projectId as string | undefined;

  if (req.user!.role === "site_manager") {
    // Restrict to rows on logs owned by this site manager.
    const rows = dailyLogId
      ? await db.select().from(resourceRows).where(eq(resourceRows.dailyLogId, dailyLogId))
      : await db.select().from(resourceRows).where(eq(resourceRows.reporterId, req.user!.sub));
    return res.json(rows);
  }

  const rows = dailyLogId
    ? await db.select().from(resourceRows).where(eq(resourceRows.dailyLogId, dailyLogId))
    : projectId
      ? await db.select().from(resourceRows).where(eq(resourceRows.projectId, projectId))
      : await db.select().from(resourceRows);
  res.json(rows);
});

const statusSchema = z.object({
  status: z.enum(["draft", "submitted", "approved_by_engineer", "paid"]),
});

// Draft -> Submitted: site manager or engineer/admin.
// Submitted -> Approved: engineer/admin only.
// Approved -> Paid: admin only (budget controller closes the loop).
resourceRowsRouter.patch("/:id/status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const target = parsed.data.status as PaymentStatus;

  const [row] = await db.select().from(resourceRows).where(eq(resourceRows.id, req.params.id)).limit(1);
  if (!row) return res.status(404).json({ error: "Row not found" });

  if (!canTransition(row.paymentStatus, target)) {
    return res.status(409).json({ error: `Cannot move from ${row.paymentStatus} to ${target}` });
  }

  if (target === "approved_by_engineer" && !["engineer", "admin"].includes(req.user!.role)) {
    return res.status(403).json({ error: "Only an engineer or admin can approve" });
  }
  if (target === "paid" && req.user!.role !== "admin") {
    return res.status(403).json({ error: "Only an admin can mark as paid" });
  }

  const [updated] = await db
    .update(resourceRows)
    .set({
      paymentStatus: target,
      approvedBy: target === "approved_by_engineer" ? req.user!.sub : row.approvedBy,
      approvedAt: target === "approved_by_engineer" ? new Date() : row.approvedAt,
    })
    .where(eq(resourceRows.id, row.id))
    .returning();

  await recordAudit({
    tableName: "resource_rows",
    recordId: row.id,
    action: "status_change",
    changedBy: req.user!.sub,
    oldValues: { paymentStatus: row.paymentStatus },
    newValues: { paymentStatus: target },
  });

  res.json(updated);
});
