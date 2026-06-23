import { describe, expect, it } from "vitest";
import type { RuleConfig } from "@project/shared";
import { calculateDailyPay } from "./rulesEngine.js";

function dateAt(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time}:00`);
}

describe("calculateDailyPay", () => {
  it("returns raw hours unchanged when no rules apply", () => {
    const result = calculateDailyPay(dateAt("2026-06-22", "07:00"), dateAt("2026-06-22", "15:00"), new Date("2026-06-22"), []);
    expect(result.rawHours).toBe(8);
    expect(result.paidHours).toBe(8);
    expect(result.breakdown).toHaveLength(0);
  });

  it("deducts lunch once the threshold is crossed", () => {
    const rules: RuleConfig[] = [{ ruleType: "lunch_deduction", afterHours: 6, deductMinutes: 30 }];
    const result = calculateDailyPay(dateAt("2026-06-22", "07:00"), dateAt("2026-06-22", "16:00"), new Date("2026-06-22"), rules);
    expect(result.rawHours).toBe(9);
    expect(result.paidHours).toBe(8.5);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].ruleType).toBe("lunch_deduction");
  });

  it("does not deduct lunch below the threshold", () => {
    const rules: RuleConfig[] = [{ ruleType: "lunch_deduction", afterHours: 6, deductMinutes: 30 }];
    const result = calculateDailyPay(dateAt("2026-06-22", "07:00"), dateAt("2026-06-22", "12:00"), new Date("2026-06-22"), rules);
    expect(result.paidHours).toBe(5);
  });

  it("rounds an early arrival up to the official shift start", () => {
    const rules: RuleConfig[] = [{ ruleType: "rounding_early_start", shiftStart: "07:00" }];
    const result = calculateDailyPay(dateAt("2026-06-22", "06:15"), dateAt("2026-06-22", "15:00"), new Date("2026-06-22"), rules);
    expect(result.rawHours).toBeCloseTo(8.75, 5);
    expect(result.paidHours).toBe(8);
  });

  it("leaves on-time or late arrivals untouched by rounding", () => {
    const rules: RuleConfig[] = [{ ruleType: "rounding_early_start", shiftStart: "07:00" }];
    const result = calculateDailyPay(dateAt("2026-06-22", "07:30"), dateAt("2026-06-22", "15:00"), new Date("2026-06-22"), rules);
    expect(result.paidHours).toBe(7.5);
  });

  it("clamps to the daily cap", () => {
    const rules: RuleConfig[] = [{ ruleType: "daily_cap", maxHours: 9 }];
    const result = calculateDailyPay(dateAt("2026-06-22", "06:00"), dateAt("2026-06-22", "18:00"), new Date("2026-06-22"), rules);
    expect(result.rawHours).toBe(12);
    expect(result.paidHours).toBe(9);
  });

  it("applies a fixed daily rate once the minimum hours threshold is reached", () => {
    const rules: RuleConfig[] = [{ ruleType: "fixed_daily_rate", minHoursForFullDay: 7, fullDayHours: 8.5 }];
    const result = calculateDailyPay(dateAt("2026-06-22", "07:00"), dateAt("2026-06-22", "15:00"), new Date("2026-06-22"), rules);
    expect(result.paidHours).toBe(8.5);
  });

  it("short-circuits to a flat day on Friday, ignoring other rules", () => {
    const rules: RuleConfig[] = [
      { ruleType: "friday_full_day", fullDayHours: 6 },
      { ruleType: "daily_cap", maxHours: 9 },
      { ruleType: "lunch_deduction", afterHours: 1, deductMinutes: 60 },
    ];
    const result = calculateDailyPay(dateAt("2026-06-26", "07:00"), dateAt("2026-06-26", "12:00"), new Date("2026-06-26"), rules);
    expect(result.rawHours).toBe(5);
    expect(result.paidHours).toBe(6);
    expect(result.breakdown).toEqual([
      {
        ruleType: "friday_full_day",
        description: "יום שישי — שכר יום מלא קבוע (6 שעות)",
        hoursBefore: 5,
        hoursAfter: 6,
      },
    ]);
  });

  it("applies the full pipeline in order: rounding -> lunch -> fixed rate -> cap", () => {
    const rules: RuleConfig[] = [
      { ruleType: "rounding_early_start", shiftStart: "07:00" },
      { ruleType: "lunch_deduction", afterHours: 6, deductMinutes: 30 },
      { ruleType: "daily_cap", maxHours: 9 },
    ];
    const result = calculateDailyPay(dateAt("2026-06-22", "06:00"), dateAt("2026-06-22", "17:00"), new Date("2026-06-22"), rules);
    expect(result.rawHours).toBe(11);
    expect(result.paidHours).toBe(9);
    expect(result.breakdown.map((b) => b.ruleType)).toEqual([
      "rounding_early_start",
      "lunch_deduction",
      "daily_cap",
    ]);
  });
});
