import type { RuleConfig } from "@project/shared";

export interface RuleEngineStep {
  ruleType: RuleConfig["ruleType"];
  description: string;
  hoursBefore: number;
  hoursAfter: number;
}

export interface RuleEngineResult {
  rawHours: number;
  paidHours: number;
  breakdown: RuleEngineStep[];
}

function hoursBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
}

function findRule<T extends RuleConfig>(rules: RuleConfig[], ruleType: T["ruleType"]): T | undefined {
  return rules.find((r) => r.ruleType === ruleType) as T | undefined;
}

function parseShiftStart(workDate: Date, shiftStart: string): Date {
  const [hours, minutes] = shiftStart.split(":").map(Number);
  const result = new Date(workDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Deterministic pipeline, applied in this fixed order regardless of input order:
 * 1. friday_full_day short-circuits everything else.
 * 2. rounding_early_start adjusts the effective check-in time.
 * 3. raw hours computed from effective check-in/check-out.
 * 4. lunch_deduction removes a break once a threshold is crossed.
 * 5. fixed_daily_rate overrides to a flat day once a minimum is reached.
 * 6. daily_cap clamps the final result.
 */
export function calculateDailyPay(
  checkIn: Date,
  checkOut: Date,
  workDate: Date,
  rules: RuleConfig[],
): RuleEngineResult {
  const breakdown: RuleEngineStep[] = [];
  const rawHours = hoursBetween(checkIn, checkOut);

  const fridayRule = findRule<Extract<RuleConfig, { ruleType: "friday_full_day" }>>(rules, "friday_full_day");
  if (fridayRule && workDate.getDay() === 5) {
    breakdown.push({
      ruleType: "friday_full_day",
      description: `יום שישי — שכר יום מלא קבוע (${fridayRule.fullDayHours} שעות)`,
      hoursBefore: rawHours,
      hoursAfter: fridayRule.fullDayHours,
    });
    return { rawHours, paidHours: fridayRule.fullDayHours, breakdown };
  }

  let effectiveCheckIn = checkIn;
  const roundingRule = findRule<Extract<RuleConfig, { ruleType: "rounding_early_start" }>>(
    rules,
    "rounding_early_start",
  );
  if (roundingRule) {
    const shiftStart = parseShiftStart(workDate, roundingRule.shiftStart);
    if (checkIn < shiftStart) {
      effectiveCheckIn = shiftStart;
      breakdown.push({
        ruleType: "rounding_early_start",
        description: `הגעה לפני ${roundingRule.shiftStart} מעוגלת לשעת התחלה`,
        hoursBefore: rawHours,
        hoursAfter: hoursBetween(effectiveCheckIn, checkOut),
      });
    }
  }

  let hours = hoursBetween(effectiveCheckIn, checkOut);

  const lunchRule = findRule<Extract<RuleConfig, { ruleType: "lunch_deduction" }>>(rules, "lunch_deduction");
  if (lunchRule && hours > lunchRule.afterHours) {
    const before = hours;
    hours = Math.max(0, hours - lunchRule.deductMinutes / 60);
    breakdown.push({
      ruleType: "lunch_deduction",
      description: `ניכוי הפסקת צהריים של ${lunchRule.deductMinutes} דקות (מעבר ל-${lunchRule.afterHours} שעות)`,
      hoursBefore: before,
      hoursAfter: hours,
    });
  }

  const fixedRateRule = findRule<Extract<RuleConfig, { ruleType: "fixed_daily_rate" }>>(rules, "fixed_daily_rate");
  if (fixedRateRule && hours >= fixedRateRule.minHoursForFullDay) {
    const before = hours;
    hours = fixedRateRule.fullDayHours;
    breakdown.push({
      ruleType: "fixed_daily_rate",
      description: `מעל ${fixedRateRule.minHoursForFullDay} שעות — שכר יום מלא קבוע (${fixedRateRule.fullDayHours} שעות)`,
      hoursBefore: before,
      hoursAfter: hours,
    });
  }

  const capRule = findRule<Extract<RuleConfig, { ruleType: "daily_cap" }>>(rules, "daily_cap");
  if (capRule && hours > capRule.maxHours) {
    const before = hours;
    hours = capRule.maxHours;
    breakdown.push({
      ruleType: "daily_cap",
      description: `תקרת שעות יומית (${capRule.maxHours} שעות)`,
      hoursBefore: before,
      hoursAfter: hours,
    });
  }

  return { rawHours, paidHours: hours, breakdown };
}
