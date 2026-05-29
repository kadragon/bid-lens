import { describe, expect, it } from "vitest";
import {
  contractMethodClass,
  formatAmount,
  formatDate,
  renderStatusBadge,
} from "../src/web/render";

describe("formatAmount", () => {
  it("null → 미정", () => {
    expect(formatAmount(null)).toBe("미정");
  });

  it("0원 예산은 0.0억원으로 표기", () => {
    expect(formatAmount(0)).toBe("0.0억원");
  });

  it("1.9억 예산은 1.9억원으로 표기", () => {
    expect(formatAmount(190000000)).toBe("1.9억원");
  });

  it("0.5억 예산은 0.5억원으로 표기", () => {
    expect(formatAmount(50000000)).toBe("0.5억원");
  });

  it("억 단위 소수 첫째자리 반올림", () => {
    expect(formatAmount(123456789)).toBe("1.2억원");
  });
});

describe("formatDate", () => {
  it("null → -", () => {
    expect(formatDate(null)).toBe("-");
  });

  it("YYYYMMDDHHMM(12자리) → YYYY-MM-DD HH:MM", () => {
    expect(formatDate("202501010900")).toBe("2025-01-01 09:00");
  });

  it("YYYYMMDD(8자리) → YYYY-MM-DD", () => {
    expect(formatDate("20250101")).toBe("2025-01-01");
  });

  it("이미 대시 포함된 날짜(YYYY-MM-DD)는 그대로 정규화", () => {
    expect(formatDate("2026-05-29")).toBe("2026-05-29");
  });

  it("대시+시간 포함 날짜는 분까지 정규화", () => {
    expect(formatDate("2026-05-29 09:00:00")).toBe("2026-05-29 09:00");
  });

  it("숫자 없는 입력 → -", () => {
    expect(formatDate("--")).toBe("-");
  });

  it("8자리 미만 숫자 입력 → 그대로", () => {
    expect(formatDate("2025")).toBe("2025");
  });

  it("8자리 미만 부분 날짜는 원본 보존", () => {
    expect(formatDate("2025-05")).toBe("2025-05");
  });
});

describe("renderStatusBadge", () => {
  it("null → 빈 문자열", () => {
    expect(renderStatusBadge(null)).toBe("");
  });

  it("빈 문자열 → 빈 문자열", () => {
    expect(renderStatusBadge("")).toBe("");
  });

  it("마감/취소/종료/개찰 → badge-closed", () => {
    for (const status of ["마감", "취소", "종료", "개찰"]) {
      expect(renderStatusBadge(status)).toContain("badge-closed");
    }
  });

  it("공고중/진행 → badge-open", () => {
    for (const status of ["공고중", "진행"]) {
      expect(renderStatusBadge(status)).toContain("badge-open");
    }
  });

  it("공고중지는 open이 아닌 default (부정 lookahead)", () => {
    const html = renderStatusBadge("공고중지");
    expect(html).toContain("badge-default");
    expect(html).not.toContain("badge-open");
  });

  it("status 텍스트는 HTML 이스케이프", () => {
    expect(renderStatusBadge("<마감>")).toContain("&lt;마감&gt;");
  });
});

describe("contractMethodClass", () => {
  it("일반경쟁 → method-general", () => {
    expect(contractMethodClass("일반경쟁")).toBe("method-general");
  });

  it("제한경쟁 → method-limited", () => {
    expect(contractMethodClass("제한경쟁")).toBe("method-limited");
  });

  it("그 외 계약방법 → method-default", () => {
    expect(contractMethodClass("수의계약")).toBe("method-default");
  });

  it("null → method-default", () => {
    expect(contractMethodClass(null)).toBe("method-default");
  });
});
