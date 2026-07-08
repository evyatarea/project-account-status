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

## Phase 2.5 — Claude-Assisted Log Creation & Page Ingestion (Weeks 4–5)
Two distinct, narrow integrations with the Claude API — Claude proposes structured data, it never writes to the DB directly and never grants itself permissions beyond the calling user's role.

**A. Opening a new daily log ("creating a new notebook") — engineer/admin only.**
- Engineer/admin gives a free-text instruction (e.g. "פתח יומן להיום בפרויקט X למנהל העבודה יוסי").
- Backend calls Claude with a forced tool-call (strict JSON schema: `project_code|id`, `log_date`, `site_manager_id|name`, `weather`, `notes`) — never free text into the DB.
- Backend resolves names → ids, validates the caller is engineer/admin AND the named site manager is actually assigned to that project (`project_assignments`) before insert.
- Row is written to `daily_logs` with `creation_source = 'ai_assisted'` and the original instruction kept in `ai_instruction` for audit.
- This endpoint is just an alternate input path to the exact same "open log" logic the manual form uses — same validation, same RBAC, same result row.

**B. Ingesting a "page" into an existing open log — site manager only.**
- Site manager submits one "page": a photo of a paper delivery ticket, or a typed/dictated free-text description of the day (e.g. "הגיע 10 קוב חול, תעודה 4521, עבדו 3 פועלים מחברת דני 8 שעות").
- Stored first as a `log_pages` row (`input_type`, `raw_text`/`raw_image_url`, status `pending`) scoped to a daily_log that must be `open` and assigned to that site manager — identical guard to manual row entry.
- Backend calls Claude (vision-capable for images) with a forced tool-call returning an **array** of row candidates: `{resource_type, item_code_or_description, quantity, unit, delivery_ticket_number, company_name}[]` — one page can and often does fan out into several rows, mirroring a real paper log page.
- Backend resolves `item_code_or_description`/`company_name` against `items`/`companies` (exact code match first, fuzzy fallback flagged for engineer review), then inserts one `resource_rows` per array entry: `payment_status = 'draft'`, `creation_source = 'ai_extracted'`, `source_page_id` pointing back at the page.
- `log_pages.ai_raw_response` keeps Claude's full structured output and `log_pages.status` moves `pending → parsed | failed`, so every AI-derived financial row is traceable back to its exact source input.
- Nothing AI-extracted skips the existing approval pipeline — rows still need engineer sign-off (Draft → Submitted → Approved → Paid) exactly like manually-typed rows.

Schema support for this: `log_creation_source`/`row_creation_source` enums, `daily_logs.creation_source`/`ai_instruction`, and the `log_pages` table (with `resource_rows.source_page_id`) — see `database/schema.sql`.

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
