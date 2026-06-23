import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  numeric,
  date,
  integer,
  jsonb,
  bigserial,
  unique,
} from "drizzle-orm/pg-core";

// Mirrors database/schema.sql exactly — that file is the source of truth for
// migrations; this file is the typed query layer on top of it.

export const userRole = pgEnum("user_role", ["admin", "engineer", "site_manager"]);
export const resourceType = pgEnum("resource_type", ["material", "labor", "equipment", "service"]);
export const paymentStatus = pgEnum("payment_status", [
  "draft",
  "submitted",
  "approved_by_engineer",
  "paid",
]);
export const dailyLogStatus = pgEnum("daily_log_status", ["open", "closed"]);
export const ruleType = pgEnum("rule_type", [
  "lunch_deduction",
  "daily_cap",
  "rounding_early_start",
  "fixed_daily_rate",
  "friday_full_day",
]);
export const logCreationSource = pgEnum("log_creation_source", ["manual", "ai_assisted"]);
export const rowCreationSource = pgEnum("row_creation_source", ["manual", "ai_extracted"]);
export const logPageInputType = pgEnum("log_page_input_type", ["text", "image", "voice"]);
export const logPageStatus = pgEnum("log_page_status", ["pending", "parsed", "failed", "reviewed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  taxId: text("tax_id"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  clientName: text("client_name"),
  address: text("address"),
  budgetAmount: numeric("budget_amount", { precision: 14, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps,
});

export const projectAssignments = pgTable(
  "project_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniq: unique().on(t.projectId, t.userId) }),
);

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemCode: text("item_code").notNull().unique(),
  externalItemCode: text("external_item_code"),
  description: text("description").notNull(),
  resourceType: resourceType("resource_type").notNull(),
  unit: text("unit").notNull(),
  defaultUnitPrice: numeric("default_unit_price", { precision: 14, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const contractItems = pgTable(
  "contract_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => items.id),
    contractedQuantity: numeric("contracted_quantity", { precision: 14, scale: 3 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    ...timestamps,
  },
  (t) => ({ uniq: unique().on(t.projectId, t.itemId) }),
);

export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    siteManagerId: uuid("site_manager_id").notNull().references(() => users.id),
    openedBy: uuid("opened_by").notNull().references(() => users.id),
    status: dailyLogStatus("status").notNull().default("open"),
    weather: text("weather"),
    notes: text("notes"),
    creationSource: logCreationSource("creation_source").notNull().default("manual"),
    aiInstruction: text("ai_instruction"),
    ...timestamps,
  },
  (t) => ({ uniq: unique().on(t.projectId, t.logDate, t.siteManagerId) }),
);

export const logPages = pgTable("log_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  dailyLogId: uuid("daily_log_id").notNull().references(() => dailyLogs.id, { onDelete: "cascade" }),
  submittedBy: uuid("submitted_by").notNull().references(() => users.id),
  inputType: logPageInputType("input_type").notNull(),
  rawText: text("raw_text"),
  rawImageUrl: text("raw_image_url"),
  aiModel: text("ai_model"),
  aiRawResponse: jsonb("ai_raw_response"),
  status: logPageStatus("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  ...timestamps,
});

export const resourceRows = pgTable("resource_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  dailyLogId: uuid("daily_log_id").notNull().references(() => dailyLogs.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  reporterId: uuid("reporter_id").notNull().references(() => users.id),
  resourceType: resourceType("resource_type").notNull(),
  itemId: uuid("item_id").references(() => items.id),
  companyId: uuid("company_id").references(() => companies.id),
  quantityReported: numeric("quantity_reported", { precision: 14, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  deliveryTicketNumber: text("delivery_ticket_number"),
  rawHours: numeric("raw_hours", { precision: 6, scale: 2 }),
  calculatedHours: numeric("calculated_hours", { precision: 6, scale: 2 }),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }),
  calculatedAmount: numeric("calculated_amount", { precision: 14, scale: 2 }),
  externalRef: text("external_ref"),
  paymentStatus: paymentStatus("payment_status").notNull().default("draft"),
  creationSource: rowCreationSource("creation_source").notNull().default("manual"),
  sourcePageId: uuid("source_page_id").references(() => logPages.id),
  notes: text("notes"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  ...timestamps,
});

export const attendanceRaw = pgTable("attendance_raw", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  workerRef: text("worker_ref").notNull(),
  workDate: date("work_date").notNull(),
  checkIn: timestamp("check_in", { withTimezone: true }),
  checkOut: timestamp("check_out", { withTimezone: true }),
  source: text("source").notNull().default("biometric"),
  resourceRowId: uuid("resource_row_id").references(() => resourceRows.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contractRules = pgTable("contract_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id),
  ruleType: ruleType("rule_type").notNull(),
  ruleConfig: jsonb("rule_config").notNull(),
  priority: integer("priority").notNull().default(0),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...timestamps,
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: uuid("record_id").notNull(),
  action: text("action").notNull(),
  changedBy: uuid("changed_by").notNull().references(() => users.id),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});
