// Mirrors the Postgres enums in database/schema.sql — keep in sync manually.

export const USER_ROLES = ["admin", "engineer", "site_manager"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const RESOURCE_TYPES = ["material", "labor", "equipment", "service"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const PAYMENT_STATUSES = ["draft", "submitted", "approved_by_engineer", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DAILY_LOG_STATUSES = ["open", "closed"] as const;
export type DailyLogStatus = (typeof DAILY_LOG_STATUSES)[number];

export const RULE_TYPES = [
  "lunch_deduction",
  "daily_cap",
  "rounding_early_start",
  "fixed_daily_rate",
  "friday_full_day",
] as const;
export type RuleType = (typeof RULE_TYPES)[number];

export const LOG_CREATION_SOURCES = ["manual", "ai_assisted"] as const;
export type LogCreationSource = (typeof LOG_CREATION_SOURCES)[number];

export const ROW_CREATION_SOURCES = ["manual", "ai_extracted"] as const;
export type RowCreationSource = (typeof ROW_CREATION_SOURCES)[number];

export interface JwtPayload {
  sub: string; // user id
  role: UserRole;
  email: string;
}

// Valid forward-only transitions for resource_rows.payment_status.
export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  draft: ["submitted"],
  submitted: ["approved_by_engineer", "draft"],
  approved_by_engineer: ["paid", "submitted"],
  paid: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_STATUS_TRANSITIONS[from].includes(to);
}
