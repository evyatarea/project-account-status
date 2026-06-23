import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes.js";
import { projectsRouter } from "./routes/projects.routes.js";
import { dailyLogsRouter } from "./routes/dailyLogs.routes.js";
import { resourceRowsRouter } from "./routes/resourceRows.routes.js";
import { itemsRouter } from "./routes/items.routes.js";
import { usersRouter } from "./routes/users.routes.js";
import { companiesRouter } from "./routes/companies.routes.js";
import { contractRulesRouter } from "./routes/contractRules.routes.js";
import { attendanceRouter } from "./routes/attendance.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/projects", projectsRouter);
app.use("/daily-logs", dailyLogsRouter);
app.use("/resource-rows", resourceRowsRouter);
app.use("/items", itemsRouter);
app.use("/companies", companiesRouter);
app.use("/contract-rules", contractRulesRouter);
app.use("/attendance", attendanceRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
