import { afterEach, describe, expect, it, vi } from "vitest";

import { generateId } from "./uuid";

describe("generateId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses randomUUID when available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "fixed-id" });

    expect(generateId()).toBe("fixed-id");
  });

  it("falls back to RFC4122 v4 formatting from random bytes", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint8Array) => {
        array.set(Array.from({ length: 16 }, (_, index) => index));
        return array;
      },
    });

    expect(generateId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("throws clearly when secure randomness is missing", () => {
    vi.stubGlobal("crypto", {});

    expect(() => generateId()).toThrow("Secure random ID generation is not available.");
  });
});
