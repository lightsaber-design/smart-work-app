import { describe, expect, it } from "vitest";
import { formatPlaceName } from "./placeNames";

describe("place names", () => {
  it("translates known place parts and keeps unknown parts", () => {
    const t = (key: string) => `translated:${key}`;

    expect(formatPlaceName("Las Palmas, España, Unknown", t)).toBe("translated:place_las_palmas, translated:place_spain, Unknown");
  });

  it("drops empty comma-separated parts", () => {
    const t = (key: string) => key;

    expect(formatPlaceName(" Dublin, , Ireland ", t)).toBe("place_dublin, place_ireland");
  });
});
