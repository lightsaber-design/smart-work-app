import { describe, expect, it } from "vitest";
import { applyMonthlyLdcCap } from "./ldcCap";

describe("monthly LDC cap", () => {
  it("counts only enough LDC to reach 55h total", () => {
    const capped = applyMonthlyLdcCap([
      { cat: "Predi", ms: 40 * 3_600_000 },
      { cat: "LDC", ms: 40 * 3_600_000 },
    ]);

    expect(capped.find((item) => item.cat === "Predi")?.ms).toBe(40 * 3_600_000);
    expect(capped.find((item) => item.cat === "LDC")?.ms).toBe(15 * 3_600_000);
  });

  it("does not reduce non-LDC time when it already exceeds 55h", () => {
    const capped = applyMonthlyLdcCap([
      { cat: "Predi", ms: 60 * 3_600_000 },
      { cat: "LDC", ms: 10 * 3_600_000 },
    ]);

    expect(capped.find((item) => item.cat === "Predi")?.ms).toBe(60 * 3_600_000);
    expect(capped.find((item) => item.cat === "LDC")?.ms).toBe(0);
  });
});
