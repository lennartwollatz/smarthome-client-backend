import { describe, expect, it } from "vitest";
import {
  evaluateTimeCondition,
  getCurrentLocalMinutes,
  millisecondsUntilLocalTime,
  parseTimeToMinutes,
} from "../timeConditionEvaluate.js";

describe("timeConditionEvaluate", () => {
  const at = (hours: number, minutes: number) => new Date(2026, 4, 15, hours, minutes, 0, 0);

  it("parst HH:mm", () => {
    expect(parseTimeToMinutes("22:30")).toBe(22 * 60 + 30);
    expect(parseTimeToMinutes("9:05")).toBe(9 * 60 + 5);
    expect(parseTimeToMinutes("invalid")).toBeNull();
  });

  it("after: spaeter als Zielzeit", () => {
    expect(evaluateTimeCondition("after", "14:00", at(15, 0))).toBe(true);
    expect(evaluateTimeCondition("after", "14:00", at(14, 0))).toBe(false);
    expect(evaluateTimeCondition("after", "14:00", at(13, 59))).toBe(false);
  });

  it("before: frueher als Zielzeit", () => {
    expect(evaluateTimeCondition("before", "14:00", at(13, 0))).toBe(true);
    expect(evaluateTimeCondition("before", "14:00", at(14, 0))).toBe(false);
  });

  it("equals und notEquals auf Minutenebene", () => {
    expect(evaluateTimeCondition("equals", "08:30", at(8, 30))).toBe(true);
    expect(evaluateTimeCondition("notEquals", "08:30", at(8, 30))).toBe(false);
  });

  it("getCurrentLocalMinutes", () => {
    expect(getCurrentLocalMinutes(at(12, 34))).toBe(12 * 60 + 34);
  });

  it("millisecondsUntilLocalTime: heute spaeter", () => {
    const ms = millisecondsUntilLocalTime("15:00", at(14, 0));
    expect(ms).toBe(60 * 60 * 1000);
  });

  it("millisecondsUntilLocalTime: morgen wenn Zeit vorbei", () => {
    const ms = millisecondsUntilLocalTime("08:00", at(22, 0));
    expect(ms).toBe(10 * 60 * 60 * 1000);
  });
});
