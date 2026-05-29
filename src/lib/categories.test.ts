import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORY_CONFIGS,
  findCategoryConfig,
  getActiveCategoryConfigs,
  getCategoryLabel,
  getCategoryMeta,
  getCategoryStyle,
  isDefaultCategoryName,
  normalizeCategoryConfigs,
} from "./categories";

describe("category helpers", () => {
  it("keeps default categories and appends valid custom categories", () => {
    const configs = normalizeCategoryConfigs([
      { name: "Predi", color: "not-a-color", active: false },
      { name: "Custom", color: "#123456", active: true, support: true },
      { name: "" },
      null,
    ]);

    expect(configs).toHaveLength(DEFAULT_CATEGORY_CONFIGS.length + 1);
    expect(configs.find((item) => item.name === "Predi")).toMatchObject({ active: false, color: "#34B1AF" });
    expect(configs.at(-1)).toMatchObject({ name: "Custom", color: "#123456", support: true });
  });

  it("detects default categories and translates only those labels", () => {
    const t = (key: string) => `translated:${key}`;

    expect(isDefaultCategoryName("Predi")).toBe(true);
    expect(isDefaultCategoryName("Custom")).toBe(false);
    expect(getCategoryLabel("Predi", t)).toBe("translated:category_predi");
    expect(getCategoryLabel("Custom", t)).toBe("Custom");
  });

  it("returns safe metadata and styles for unknown categories", () => {
    const config = findCategoryConfig(DEFAULT_CATEGORY_CONFIGS, "Other");
    expect(config).toMatchObject({ name: "Other", active: true, support: false });
    expect(getCategoryMeta(DEFAULT_CATEGORY_CONFIGS, "Other").icon).toBe("O");
    expect(getCategoryStyle(DEFAULT_CATEGORY_CONFIGS, "Other").accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("filters active categories", () => {
    expect(getActiveCategoryConfigs([{ name: "A", color: "#000000", active: true, support: false }, { name: "B", color: "#ffffff", active: false, support: false }])).toEqual([
      { name: "A", color: "#000000", active: true, support: false },
    ]);
  });
});
