import { describe, expect, it } from "vitest";
import { kstDateIso } from "../src/util/date";

describe("kstDateIso", () => {
  it("keeps same KST date during UTC daytime", () => {
    expect(kstDateIso(new Date("2026-05-29T03:00:00Z"))).toBe("2026-05-29");
  });

  it("keeps same KST date at UTC 14:59", () => {
    expect(kstDateIso(new Date("2026-05-29T14:59:59Z"))).toBe("2026-05-29");
  });

  it("rolls to next KST date after UTC 15:00", () => {
    expect(kstDateIso(new Date("2026-05-29T15:30:00Z"))).toBe("2026-05-30");
  });

  it("rolls year boundary to next KST year", () => {
    expect(kstDateIso(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});
