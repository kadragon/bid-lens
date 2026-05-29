import { describe, expect, it } from "vitest";
import {
  classifySegments,
  DEFAULT_RULES,
  type FilterRules,
  isTargetBid,
} from "../src/collector/filter";
import type { BidItem } from "../src/collector/types";

function makeBid(overrides: Partial<BidItem> = {}): BidItem {
  return {
    bidNtceNo: "20250001",
    bidNtceOrd: "00",
    bidNtceNm: "학사관리시스템 구축",
    bidNtceSttusNm: "공고",
    bidNtceDate: "202501010900",
    bsnsDivNm: "용역",
    ntceInsttNm: "한국교원대학교",
    dmndInsttNm: "한국교원대학교",
    cntrctCnclsMthdNm: "일반경쟁",
    bidClseDate: "202501150900",
    bidClseTm: "0900",
    opengDate: "202501160900",
    opengTm: "0900",
    asignBdgtAmt: "50000000",
    presmptPrce: "45000000",
    bidprcPsblIndstrytyNm: "소프트웨어개발공급업",
    bidNtceUrl: "https://www.g2b.go.kr/",
    ...overrides,
  };
}

describe("isTargetBid", () => {
  it("accepts target bid", () => {
    expect(isTargetBid(makeBid())).toBe(true);
  });

  it("rejects non-university demand org", () => {
    expect(isTargetBid(makeBid({ dmndInsttNm: "행정안전부" }))).toBe(false);
  });

  it("rejects hospital demand org", () => {
    expect(isTargetBid(makeBid({ dmndInsttNm: "한국교원대학교병원" }))).toBe(false);
  });

  it("rejects goods business type", () => {
    expect(isTargetBid(makeBid({ bsnsDivNm: "물품" }))).toBe(false);
  });

  it("rejects construction business type", () => {
    expect(isTargetBid(makeBid({ bsnsDivNm: "공사" }))).toBe(false);
  });

  it("rejects excluded notice name", () => {
    expect(isTargetBid(makeBid({ bidNtceNm: "학사관리시스템 유지보수" }))).toBe(false);
  });

  it("rejects non-SW industry", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "건축설계및관련서비스업" }))).toBe(false);
  });

  it("accepts computer industry", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "컴퓨터시스템설계및구축서비스업" }))).toBe(
      true,
    );
  });

  it("accepts security industry", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "정보보호서비스업" }))).toBe(true);
  });

  it("accepts e-learning industry", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "이러닝서비스업" }))).toBe(true);
  });

  it("accepts telecom industry", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "정보통신공사업" }))).toBe(true);
  });

  it("rejects excluded industry alone", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "디지털콘텐츠개발서비스사업" }))).toBe(
      false,
    );
  });

  it("accepts mixed clean SW segment", () => {
    expect(
      isTargetBid(
        makeBid({
          bidprcPsblIndstrytyNm: "소프트웨어개발공급업, 디지털콘텐츠개발서비스사업",
        }),
      ),
    ).toBe(true);
  });

  it("rejects mixed segments without clean SW", () => {
    expect(
      isTargetBid(
        makeBid({
          bidprcPsblIndstrytyNm: "디지털콘텐츠개발서비스사업, 건축설계및관련서비스업",
        }),
      ),
    ).toBe(false);
  });

  it("rejects blank industry", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "" }))).toBe(false);
  });
});

function rules(over: Partial<FilterRules> = {}): FilterRules {
  return { ...DEFAULT_RULES, ...over };
}

describe("isTargetBid dynamic rules", () => {
  it("matches default rules", () => {
    const bid = makeBid();
    expect(isTargetBid(bid, DEFAULT_RULES)).toBe(isTargetBid(bid));
  });

  it("disables demand include when empty", () => {
    expect(isTargetBid(makeBid({ dmndInsttNm: "행정안전부" }), rules({ dmndInclude: [] }))).toBe(
      true,
    );
  });

  it("disables industry include when empty", () => {
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "건축설계및관련서비스업" }),
        rules({ industryInclude: [] }),
      ),
    ).toBe(true);
  });

  it("keeps industry exclude with empty include", () => {
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "디지털콘텐츠개발서비스사업" }),
        rules({ industryInclude: [], industryExclude: ["디지털콘텐츠개발서비스사업"] }),
      ),
    ).toBe(false);
  });

  it("accepts clean segment with empty include", () => {
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "디지털콘텐츠개발서비스사업, 소프트웨어개발공급업" }),
        rules({ industryInclude: [], industryExclude: ["디지털콘텐츠개발서비스사업"] }),
      ),
    ).toBe(true);
  });

  it("disables business type check when empty", () => {
    expect(isTargetBid(makeBid({ bsnsDivNm: "물품" }), rules({ bsnsDivEquals: [] }))).toBe(true);
  });

  it("accepts custom industry include", () => {
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "건축설계및관련서비스업" }),
        rules({ industryInclude: ["건축"] }),
      ),
    ).toBe(true);
  });

  it("applies custom name exclude", () => {
    expect(
      isTargetBid(makeBid({ bidNtceNm: "AI 챗봇 구축" }), rules({ nameExclude: ["챗봇"] })),
    ).toBe(false);
  });

  it("applies custom demand exclude", () => {
    expect(
      isTargetBid(makeBid({ dmndInsttNm: "한국방송통신대학교" }), rules({ dmndExclude: ["방송"] })),
    ).toBe(false);
  });

  it("applies custom business type", () => {
    const r = rules({ bsnsDivEquals: ["물품"] });
    expect(isTargetBid(makeBid({ bsnsDivNm: "물품" }), r)).toBe(true);
    expect(isTargetBid(makeBid({ bsnsDivNm: "용역" }), r)).toBe(false);
  });

  it("accepts custom clean segment", () => {
    // "건축설계서비스업"(건축O 리모델링X → 통과), "건축리모델링업"(건축O 리모델링O → 탈락)
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "건축설계서비스업, 건축리모델링업" }),
        rules({ industryInclude: ["건축"], industryExclude: ["리모델링"] }),
      ),
    ).toBe(true);
  });

  it("rejects custom excluded segment", () => {
    // 세그먼트별 exclude 우선 — 같은 세그먼트가 둘 다 매치하면 탈락
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "건축리모델링업" }),
        rules({ industryInclude: ["건축"], industryExclude: ["리모델링"] }),
      ),
    ).toBe(false);
  });
});

describe("classifySegments", () => {
  it("marks matched segment with first matching include pattern", () => {
    const result = classifySegments("소프트웨어개발공급업", DEFAULT_RULES);
    expect(result).toHaveLength(1);
    expect(result[0]?.matchedBy).toBe("소프트웨어");
    expect(result[0]?.excluded).toBe(false);
  });

  it("marks excluded segment", () => {
    const result = classifySegments("디지털콘텐츠개발서비스사업", DEFAULT_RULES);
    expect(result[0]?.excluded).toBe(true);
    expect(result[0]?.matchedBy).toBeNull();
  });

  it("marks neutral segment (no include match, not excluded)", () => {
    const result = classifySegments("건축설계및관련서비스업", DEFAULT_RULES);
    expect(result[0]?.matchedBy).toBeNull();
    expect(result[0]?.excluded).toBe(false);
  });

  it("handles comma-separated multiple segments", () => {
    const result = classifySegments(
      "소프트웨어개발공급업, 디지털콘텐츠개발서비스사업",
      DEFAULT_RULES,
    );
    expect(result).toHaveLength(2);
    expect(result[0]?.segment).toBe("소프트웨어개발공급업");
    expect(result[0]?.matchedBy).toBe("소프트웨어");
    expect(result[1]?.segment).toBe("디지털콘텐츠개발서비스사업");
    expect(result[1]?.excluded).toBe(true);
  });

  it("returns correct segment text trimmed", () => {
    const result = classifySegments("  정보보호서비스업  ", DEFAULT_RULES);
    expect(result[0]?.segment).toBe("정보보호서비스업");
    expect(result[0]?.matchedBy).toBe("정보보호");
  });

  it("respects empty industryInclude — no matchedBy badges", () => {
    const rules: FilterRules = { ...DEFAULT_RULES, industryInclude: [] };
    const result = classifySegments("소프트웨어개발공급업", rules);
    expect(result[0]?.matchedBy).toBeNull();
    expect(result[0]?.excluded).toBe(false);
  });

  it("excluded takes priority over include match when patterns overlap", () => {
    const rules: FilterRules = {
      ...DEFAULT_RULES,
      industryInclude: ["소프트웨어"],
      industryExclude: ["소프트웨어"],
    };
    const result = classifySegments("소프트웨어개발공급업", rules);
    expect(result[0]?.excluded).toBe(true);
    expect(result[0]?.matchedBy).toBeNull();
  });

  it("returns empty array for empty string", () => {
    const result = classifySegments("", DEFAULT_RULES);
    expect(result).toHaveLength(1);
    expect(result[0]?.segment).toBe("");
  });
});
