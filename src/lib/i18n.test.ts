import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Lang, translations, type TranslationMap } from "./i18n";

async function loadCatalogs(): Promise<Record<Lang, TranslationMap>> {
  return {
    es: translations.es,
    en: (await import("./i18n/en")).default,
    pt: (await import("./i18n/pt")).default,
    fr: (await import("./i18n/fr")).default,
    it: (await import("./i18n/it")).default,
    de: (await import("./i18n/de")).default,
  };
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        if (["components/ui", "test"].some((skip) => path.replace(/\\/g, "/").endsWith(skip))) return [];
        return sourceFiles(path);
      }
      return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });
}

describe("i18n catalog", () => {
  it("keeps the same keys in every language", async () => {
    const catalogs = await loadCatalogs();
    const baseKeys = Object.keys(catalogs.es).sort();

    (Object.keys(catalogs) as Lang[]).forEach((lang) => {
      expect(Object.keys(catalogs[lang]).sort()).toEqual(baseKeys);
    });
  });

  it("contains every static translation key used by the app", () => {
    const keys = new Set(Object.keys(translations.es));
    const usedKeys = new Set<string>();
    const staticCalls = [
      /(?<![A-Za-z0-9_$])t\(\s*["']([a-zA-Z0-9_]+)["']/g,
      /(?<![A-Za-z0-9_$])translate\(\s*[^,\n]+,\s*["']([a-zA-Z0-9_]+)["']/g,
    ];

    sourceFiles(join(process.cwd(), "src")).forEach((file) => {
      const source = readFileSync(file, "utf8");
      staticCalls.forEach((staticCall) => {
        for (const match of source.matchAll(staticCall)) usedKeys.add(match[1]);
      });
    });

    const missing = [...usedKeys].filter((key) => !keys.has(key)).sort();
    expect(missing).toEqual([]);
  });
});
