-- =============================================================================
-- Site Log & Sub-Contractor Cost Control System — PostgreSQL Schema
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'engineer', 'site_manager');
CREATE TYPE resource_type AS ENUM ('material', 'labor', 'equipment', 'service');
CREATE TYPE payment_status AS ENUM ('draft', 'submitted', 'approved_by_engineer', 'paid');
CREATE TYPE daily_log_status AS ENUM ('open', 'closed');
CREATE TYPE rule_type AS ENUM (
    'lunch_deduction',
    'daily_cap',
    'rounding_early_start',
    'fixed_daily_rate',
    'friday_full_day'
);
CREATE TYPE log_creation_source AS ENUM ('manual', 'ai_assisted');
CREATE TYPE row_creation_source AS ENUM ('manual', 'ai_extracted');
CREATE TYPE log_page_input_type AS ENUM ('text', 'image', 'voice');
CREATE TYPE log_page_status AS ENUM ('pending', 'parsed', 'failed', 'reviewed');

-- -----------------------------------------------------------------------------
-- updated_at trigger helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    phone           TEXT,
    password_hash   TEXT NOT NULL,
    role            user_role NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Companies (sub-contractors / suppliers)
-- -----------------------------------------------------------------------------
CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    tax_id          TEXT,
    contact_name    TEXT,
    contact_phone   TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Projects
-- -----------------------------------------------------------------------------
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,           -- short project code, e.g. PRJ-2026-014
    name            TEXT NOT NULL,
    client_name     TEXT,
    address          TEXT,
    budget_amount   NUMERIC(14,2),                  -- total approved budget
    start_date      DATE,
    end_date        DATE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Which users (esp. site managers) are assigned to which projects.
CREATE TABLE project_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Items catalog (materials / labor types / equipment / services)
-- Future Priority sync target: external_item_code.
-- -----------------------------------------------------------------------------
CREATE TABLE items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code           TEXT NOT NULL UNIQUE,        -- internal code
    external_item_code  TEXT,                        -- Priority item code (Phase 2 sync target)
    description         TEXT NOT NULL,
    resource_type       resource_type NOT NULL,
    unit                TEXT NOT NULL,                -- e.g. 'm3', 'hr', 'ton', 'unit'
    default_unit_price  NUMERIC(14,2),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Contract / BOQ lines — contracted quantity & price per project+item,
-- used for over/under budget tracking against reported ResourceRows.
-- -----------------------------------------------------------------------------
CREATE TABLE contract_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES items(id),
    contracted_quantity NUMERIC(14,3) NOT NULL,
    unit_price          NUMERIC(14,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, item_id)
);
CREATE TRIGGER trg_contract_items_updated_at BEFORE UPDATE ON contract_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Daily Logs (יומני עבודה) — opened by engineer/admin, written to by site manager.
-- -----------------------------------------------------------------------------
CREATE TABLE daily_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    log_date        DATE NOT NULL,
    site_manager_id UUID NOT NULL REFERENCES users(id),     -- only this user may write rows
    opened_by       UUID NOT NULL REFERENCES users(id),     -- engineer/admin who opened the log
    status          daily_log_status NOT NULL DEFAULT 'open',
    weather         TEXT,
    notes           TEXT,
    creation_source log_creation_source NOT NULL DEFAULT 'manual',
    ai_instruction  TEXT,                                    -- the free-text instruction Claude used to open this log, if any
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, log_date, site_manager_id)
);
CREATE TRIGGER trg_daily_logs_updated_at BEFORE UPDATE ON daily_logs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_daily_logs_project_date ON daily_logs(project_id, log_date);
CREATE INDEX idx_daily_logs_site_manager ON daily_logs(site_manager_id, status);

-- -----------------------------------------------------------------------------
-- Log Pages — a single piece of raw input submitted into an OPEN daily_log
-- (a photo of a paper ticket, a dictated/typed free-text description, etc.),
-- mirroring how one page of a paper logbook lists several items at once.
-- One page fans out into many resource_rows after Claude parses it.
-- raw_text/raw_image_url hold the original input; ai_raw_response keeps
-- Claude's full structured output for audit, since this feeds financial data.
-- -----------------------------------------------------------------------------
CREATE TABLE log_pages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_log_id    UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
    submitted_by    UUID NOT NULL REFERENCES users(id),       -- site manager who submitted the page
    input_type      log_page_input_type NOT NULL,
    raw_text        TEXT,
    raw_image_url   TEXT,
    ai_model        TEXT,                                     -- Claude model id used to parse this page
    ai_raw_response JSONB,                                    -- full structured response, for audit/debugging
    status          log_page_status NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_log_pages_updated_at BEFORE UPDATE ON log_pages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_log_pages_daily_log ON log_pages(daily_log_id);

-- -----------------------------------------------------------------------------
-- Resource Rows — the atomic unit of the whole system.
-- One row per material/labor/equipment/service entry. Never columns-per-item.
-- -----------------------------------------------------------------------------
CREATE TABLE resource_rows (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_log_id            UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
    project_id              UUID NOT NULL REFERENCES projects(id),      -- denormalized for fast project-wide queries
    reporter_id             UUID NOT NULL REFERENCES users(id),         -- who entered this row (site manager)
    resource_type           resource_type NOT NULL,
    item_id                 UUID REFERENCES items(id),                  -- nullable: ad-hoc rows pending catalog entry
    company_id              UUID REFERENCES companies(id),              -- sub-contractor, relevant for labor/equipment
    quantity_reported       NUMERIC(14,3) NOT NULL,
    unit                    TEXT NOT NULL,
    delivery_ticket_number  TEXT,                                       -- מספר תעודת משלוח (materials)
    raw_hours               NUMERIC(6,2),                                -- labor: raw biometric hours before rules
    calculated_hours        NUMERIC(6,2),                                -- labor: after rules engine
    unit_price              NUMERIC(14,2),
    calculated_amount       NUMERIC(14,2),                               -- quantity/hours * price, post-rules
    external_ref            TEXT,                                       -- Priority GRV/doc reference (Phase 2)
    payment_status          payment_status NOT NULL DEFAULT 'draft',
    creation_source         row_creation_source NOT NULL DEFAULT 'manual',
    source_page_id          UUID REFERENCES log_pages(id),               -- the log_page this row was extracted from, if AI-extracted
    notes                   TEXT,
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_resource_rows_updated_at BEFORE UPDATE ON resource_rows
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_resource_rows_log ON resource_rows(daily_log_id);
CREATE INDEX idx_resource_rows_project_status ON resource_rows(project_id, payment_status);
CREATE INDEX idx_resource_rows_company ON resource_rows(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_resource_rows_ticket ON resource_rows(delivery_ticket_number) WHERE delivery_ticket_number IS NOT NULL;
CREATE INDEX idx_resource_rows_source_page ON resource_rows(source_page_id) WHERE source_page_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Raw biometric attendance punches (input to the rules engine).
-- -----------------------------------------------------------------------------
CREATE TABLE attendance_raw (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id),
    project_id      UUID NOT NULL REFERENCES projects(id),
    worker_ref      TEXT NOT NULL,             -- external biometric worker identifier
    work_date       DATE NOT NULL,
    check_in        TIMESTAMPTZ,
    check_out       TIMESTAMPTZ,
    source          TEXT NOT NULL DEFAULT 'biometric',
    resource_row_id UUID REFERENCES resource_rows(id), -- linked once processed into a labor row
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_attendance_raw_company_date ON attendance_raw(company_id, work_date);

-- -----------------------------------------------------------------------------
-- Contract Rules — the per-sub-contractor configurable rules engine.
-- rule_config holds the parameters; shape depends on rule_type (see app-level
-- discriminated-union validation, not enforced at the DB layer).
-- Versioned via effective_from/effective_to so historical payroll stays
-- reproducible after rules change.
-- -----------------------------------------------------------------------------
CREATE TABLE contract_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id),       -- NULL = applies to this company on all projects
    rule_type       rule_type NOT NULL,
    rule_config     JSONB NOT NULL,                      -- e.g. {"afterHours":8,"deductMinutes":30}
    priority        INTEGER NOT NULL DEFAULT 0,           -- application order within a day's calculation
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_contract_rules_updated_at BEFORE UPDATE ON contract_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_contract_rules_company_active ON contract_rules(company_id, is_active);

-- -----------------------------------------------------------------------------
-- Audit Log — required for budget-controller edits to historical data
-- and for status-transition traceability (Draft -> ... -> Paid).
-- -----------------------------------------------------------------------------
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    table_name      TEXT NOT NULL,
    record_id       UUID NOT NULL,
    action          TEXT NOT NULL,             -- 'insert' | 'update' | 'delete' | 'status_change'
    changed_by      UUID NOT NULL REFERENCES users(id),
    old_values      JSONB,
    new_values      JSONB,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);
