import { describe, expect, it } from "vitest";
import { applyMonthlySupportCap } from "./ldcCap";

const LDC_CATEGORY = [{ name: "LDC", support: true }];

describe("monthly support-hours cap", () => {
  it("counts only enough support-category time to reach 55h total", () => {
    const capped = applyMonthlySupportCap([
      { cat: "Predi", ms: 40 * 3_600_000 },
      { cat: "LDC", ms: 40 * 3_600_000 },
    ], LDC_CATEGORY);

    expect(capped.find((item) => item.cat === "Predi")?.ms).toBe(40 * 3_600_000);
    expect(capped.find((item) => item.cat === "LDC")?.ms).toBe(15 * 3_600_000);
  });

  it("does not reduce non-support time when it already exceeds 55h", () => {
    const capped = applyMonthlySupportCap([
      { cat: "Predi", ms: 60 * 3_600_000 },
      { cat: "LDC", ms: 10 * 3_600_000 },
    ], LDC_CATEGORY);

    expect(capped.find((item) => item.cat === "Predi")?.ms).toBe(60 * 3_600_000);
    expect(capped.find((item) => item.cat === "LDC")?.ms).toBe(0);
  });
});
