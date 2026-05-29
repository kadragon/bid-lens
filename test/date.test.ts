import { describe, expect, it } from "vitest";
import { kstDateIso } from "../src/util/date";

describe("kstDateIso", () => {
  it("UTC 낮 → 같은 날 KST", () => {
    expect(kstDateIso(new Date("2026-05-29T03:00:00Z"))).toBe("2026-05-29");
  });

  it("UTC 14:59 → KST 같은 날 23:59", () => {
    expect(kstDateIso(new Date("2026-05-29T14:59:59Z"))).toBe("2026-05-29");
  });

  it("UTC 15:30 → KST 다음 날 00:30 (경계)", () => {
    expect(kstDateIso(new Date("2026-05-29T15:30:00Z"))).toBe("2026-05-30");
  });

  it("연말 경계: UTC 12-31 15:00 → KST 다음 해 01-01", () => {
    expect(kstDateIso(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});
