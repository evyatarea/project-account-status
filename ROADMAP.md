# Site Log & Sub-Contractor Cost Control System — Development Roadmap

Stack: React + Vite + Tailwind (frontend) · Node.js/Express (backend) · PostgreSQL (DB)
Domain: Daily site logs (יומני עבודה), delivery tickets (תעודות משלוח), sub-contractor labor cost control, Priority ERP integration.

## Phase 0 — Foundations (Week 1)
- Monorepo layout: `/apps/web` (React), `/apps/api` (Express), `/packages/shared` (shared TS types/enums for ResourceType, PaymentStatus, Role).
- Postgres via Docker Compose for local dev; `pg` or `Prisma`/`Drizzle` as the query layer (Drizzle recommended — typed SQL, migration-friendly, low magic).
- Auth: JWT (access + refresh) with role claim. bcrypt for password hashes. Middleware for RBAC (`requireRole(['admin','engineer'])`).
- CI: lint + typecheck + migration-dry-run on PR.

## Phase 1 — Core Data Model & API (Weeks 2–3)
- Implement schema (see DDL below) via migrations.
- REST endpoints, all scoped by `project_id` and enforced by RBAC:
  - `POST/GET /projects` (admin/engineer create, all roles read assigned)
  - `POST /daily-logs` (engineer/admin only — "opens" a log for a project+date+site manager)
  - `GET /daily-logs?project_id=&date=` (site manager sees only logs assigned to them)
  - `POST /resource-rows` (site manager writes into an open log only)
  - `PATCH /resource-rows/:id/status` (engineer-only transition Draft→Submitted→Approved; admin-only →Paid)
  - `GET /items?type=` (materials/labor/equipment/service catalog, future Priority-fed)
- Server-side validation: a site manager can only POST rows to a `daily_log` where `daily_logs.site_manager_id = req.user.id` and `status = 'open'`.
- Audit log middleware on every mutating endpoint (who/when/old→new) — required for the "budget controller can modify historical data" requirement to stay traceable.

## Phase 2 — Rules Engine (Weeks 3–4)
This is the highest-risk component; build it as a pure, testable function, independent of the DB/HTTP layer.
- Define `RuleConfig` as a discriminated union (one variant per `rule_type`):
  - `lunch_deduction`: `{ afterHours: number, deductMinutes: number }`
  - `daily_cap`: `{ maxHours: number }`
  - `rounding_early_start`: `{ shiftStart: "07:00" }`
  - `fixed_daily_rate`: `{ minHoursForFullDay: number, fullDayHours: number }`
  - `friday_full_day`: `{ fullDayHours: number }`
- Engine: `calculateDailyPay(rawCheckIn, rawCheckOut, rules[]) -> { paidHours, breakdown[] }`. Rules apply in a defined, configurable order (rounding → cap → lunch deduction → fixed-day override), each rule documented with a pure unit-testable function.
- Rules are versioned per company (`effective_from`/`effective_to`) so re-running historical payroll periods is deterministic even after a rule changes.
- Admin UI: rule builder (form, not raw JSON) that serializes to `contract_rules.rule_config jsonb`.
- Nightly/on-demand job: ingest raw biometric punches → `attendance_raw` → run engine → write/refresh `resource_rows` (labor type) with calculated hours + amount, status `Draft`.

## Phase 3 — Site Manager Mobile UI (Weeks 4–5)
- Mobile-first, large tap targets, high contrast, minimal typing.
- Flow: pick today's open log (pre-filtered to assigned projects) → tap resource type → pick item from searchable dropdown → enter quantity + ticket number → save row. No log/project creation capability anywhere in this UI.
- Offline-tolerant: queue writes in IndexedDB/localStorage if connectivity drops on site, sync on reconnect (PWA).

## Phase 4 — Engineer/Admin Desktop Dashboard (Weeks 5–7)
- Data tables (server-paginated) with bulk select → bulk status transition.
- BOQ/contract-quantity vs. reported-quantity charts (over/under tracking) per item per project.
- Budget controller views: cost-to-date vs. budget, labor cost by sub-contractor, rule-engine audit trail.
- Export module: generates the Priority-formatted spreadsheet (XLSX) for `Approved by Engineer` rows, then flips them toward `Paid` once confirmed loaded.

## Phase 5 — Priority ERP Integration Hooks (Weeks 7–8, future-proofed now)
- Backend already isolates "export" behind an `ExportAdapter` interface: `SpreadsheetExportAdapter` (Phase 1) implements it today; `PriorityRestAdapter` (Phase 2) implements the same interface later — swap without touching business logic.
- Add `external_item_code`/`external_ref` columns now (already in DDL) so Priority item-code sync and GRV push have a landing spot without later migrations.
- Stub `POST /integrations/priority/sync-items` and `POST /integrations/priority/push-grv` routes behind a feature flag, unimplemented until Priority Web SDK credentials exist.

## Phase 6 — Hardening & Launch (Weeks 8–9)
- RBAC penetration pass (can a site manager hit any engineer/admin route or another site's log?).
- Load test resource-row writes (many concurrent mobile submissions).
- Backup/restore runbook for Postgres, point-in-time recovery check.
- UAT with one real site manager and one engineer on real projects before full rollout.

## Cross-cutting
- All monetary calculations stored in minor currency units (agorot) as integers to avoid float drift; convert at display layer.
- All quantities use `numeric` (not float) in Postgres for exact decimal handling.
- Every table gets `created_at`/`updated_at` and a trigger to maintain `updated_at`.
