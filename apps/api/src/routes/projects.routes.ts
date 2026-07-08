import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { projects, projectAssignments } from "../db/schema.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";

export const projectsRouter = Router();
projectsRouter.use(authenticate);

const createProjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  clientName: z.string().optional(),
  address: z.string().optional(),
  budgetAmount: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Admin/engineer create projects; site managers never do.
projectsRouter.post("/", requireRole("admin", "engineer"), async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { budgetAmount, ...rest } = parsed.data;
  const [project] = await db
    .insert(projects)
    .values({
      ...rest,
      budgetAmount: budgetAmount !== undefined ? String(budgetAmount) : undefined,
      createdBy: req.user!.sub,
    })
    .returning();

  await recordAudit({
    tableName: "projects",
    recordId: project.id,
    action: "insert",
    changedBy: req.user!.sub,
    newValues: project,
  });

  res.status(201).json(project);
});

// Admin/engineer see every active project; a site manager only sees
// projects they are explicitly assigned to via project_assignments.
projectsRouter.get("/", async (req, res) => {
  if (req.user!.role === "site_manager") {
    const rows = await db
      .select({ project: projects })
      .from(projectAssignments)
      .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
      .where(eq(projectAssignments.userId, req.user!.sub));
    return res.json(rows.map((r) => r.project));
  }

  const all = await db.select().from(projects).where(eq(projects.isActive, true));
  res.json(all);
});

const assignSchema = z.object({ userId: z.string().uuid() });

// Admin/engineer assign a site manager (or another engineer) to a project.
// This is the gate that later lets that user be picked as a log's site_manager_id.
projectsRouter.post("/:projectId/assignments", requireRole("admin", "engineer"), async (req, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [assignment] = await db
    .insert(projectAssignments)
    .values({ projectId: req.params.projectId, userId: parsed.data.userId })
    .onConflictDoNothing()
    .returning();

  if (!assignment) return res.status(409).json({ error: "User already assigned to this project" });

  await recordAudit({
    tableName: "project_assignments",
    recordId: assignment.id,
    action: "insert",
    changedBy: req.user!.sub,
    newValues: assignment,
  });

  res.status(201).json(assignment);
});

projectsRouter.get("/:projectId/assignments", requireRole("admin", "engineer"), async (req, res) => {
  const rows = await db
    .select()
    .from(projectAssignments)
    .where(eq(projectAssignments.projectId, req.params.projectId));
  res.json(rows);
});
