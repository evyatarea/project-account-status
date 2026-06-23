import { db } from "../db/client.js";
import { auditLog } from "../db/schema.js";

export async function recordAudit(params: {
  tableName: string;
  recordId: string;
  action: "insert" | "update" | "delete" | "status_change";
  changedBy: string;
  oldValues?: unknown;
  newValues?: unknown;
}) {
  await db.insert(auditLog).values({
    tableName: params.tableName,
    recordId: params.recordId,
    action: params.action,
    changedBy: params.changedBy,
    oldValues: params.oldValues ?? null,
    newValues: params.newValues ?? null,
  });
}
