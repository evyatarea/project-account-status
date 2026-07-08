import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";

export const usersRouter = Router();
usersRouter.use(authenticate);

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  role: z.enum(["admin", "engineer", "site_manager"]),
});

// Only admin creates users — there is no public self-registration.
usersRouter.post("/", requireRole("admin"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { password, ...rest } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, rest.email)).limit(1);
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ ...rest, passwordHash })
    .returning({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  await recordAudit({
    tableName: "users",
    recordId: user.id,
    action: "insert",
    changedBy: req.user!.sub,
    newValues: user,
  });

  res.status(201).json(user);
});

// Admin/engineer need to list users (e.g. to pick a site manager when
// opening a log or assigning a project). Site managers don't need this.
usersRouter.get("/", requireRole("admin", "engineer"), async (req, res) => {
  const role = req.query.role as "admin" | "engineer" | "site_manager" | undefined;
  const baseQuery = db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users);
  const rows = role ? await baseQuery.where(eq(users.role, role)) : await baseQuery;
  res.json(rows);
});
