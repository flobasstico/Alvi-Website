import { describe, expect, it } from "vitest"
import { dueRuleCount, formatClock, RULE_COLORS, ruleColor, secondsToNextRule } from "./escalation"

const start = "2026-01-01T20:00:00Z"
const at = (sec: number) => Date.parse(start) + sec * 1000
const running = { status: "laeuft", started_at: start, interval_s: 240, pool_exhausted: false }

describe("escalation", () => {
  it("vor dem Start nur die Grundregel, kein Timer", () => {
    const ready = { ...running, status: "bereit", started_at: null }
    expect(dueRuleCount(ready, at(9999))).toBe(1)
    expect(secondsToNextRule(ready, at(0))).toBeNull()
  })

  it("alle 4 Minuten kommt eine Regel dazu", () => {
    expect(dueRuleCount(running, at(0))).toBe(1)
    expect(dueRuleCount(running, at(239))).toBe(1)
    expect(dueRuleCount(running, at(240))).toBe(2)
    expect(dueRuleCount(running, at(9 * 60))).toBe(3)
  })

  it("Timer startet nach jeder Regel neu", () => {
    expect(secondsToNextRule(running, at(0))).toBe(240)
    expect(secondsToNextRule(running, at(1))).toBe(239)
    expect(secondsToNextRule(running, at(240))).toBe(240)
    expect(secondsToNextRule(running, at(250))).toBe(230)
  })

  it("kein Timer, wenn der Pool ausgeschöpft ist", () => {
    expect(secondsToNextRule({ ...running, pool_exhausted: true }, at(10))).toBeNull()
  })

  it("Farben wiederholen sich erst nach der Palette", () => {
    expect(ruleColor(1)).toBe(RULE_COLORS[0])
    expect(ruleColor(2)).not.toBe(ruleColor(1))
    expect(ruleColor(RULE_COLORS.length + 1)).toBe(RULE_COLORS[0])
  })

  it("formatClock", () => {
    expect(formatClock(240)).toBe("04:00")
    expect(formatClock(59)).toBe("00:59")
  })
})
