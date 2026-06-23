import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { dailyLogs, projectAssignments } from "../db/schema.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";

export const dailyLogsRouter = Router();
dailyLogsRouter.use(authenticate);

const createLogSchema = z.object({
  projectId: z.string().uuid(),
  logDate: z.string(), // ISO date
  siteManagerId: z.string().uuid(),
  weather: z.string().optional(),
  notes: z.string().optional(),
});

// Only engineer/admin "open a notebook" — a site manager can never create
// their own log, only write into one already opened for them.
dailyLogsRouter.post("/", requireRole("admin", "engineer"), async (req, res) => {
  const parsed = createLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { projectId, siteManagerId } = parsed.data;

  const [assignment] = await db
    .select()
    .from(projectAssignments)
    .where(and(eq(projectAssignments.projectId, projectId), eq(projectAssignments.userId, siteManagerId)))
    .limit(1);
  if (!assignment) {
    return res.status(400).json({ error: "Site manager is not assigned to this project" });
  }

  const [log] = await db
    .insert(dailyLogs)
    .values({ ...parsed.data, openedBy: req.user!.sub })
    .returning();

  await recordAudit({
    tableName: "daily_logs",
    recordId: log.id,
    action: "insert",
    changedBy: req.user!.sub,
    newValues: log,
  });

  res.status(201).json(log);
});

// Site manager: only their own logs. Engineer/admin: filterable by project.
dailyLogsRouter.get("/", async (req, res) => {
  if (req.user!.role === "site_manager") {
    const rows = await db.select().from(dailyLogs).where(eq(dailyLogs.siteManagerId, req.user!.sub));
    return res.json(rows);
  }

  const projectId = req.query.projectId as string | undefined;
  const rows = projectId
    ? await db.select().from(dailyLogs).where(eq(dailyLogs.projectId, projectId))
    : await db.select().from(dailyLogs);
  res.json(rows);
});
