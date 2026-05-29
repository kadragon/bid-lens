import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type FilterRules, isTargetBid } from "../src/collector/filter";
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
  it("기본 케이스: 대학 SW 용역 공고 → true", () => {
    expect(isTargetBid(makeBid())).toBe(true);
  });

  it("수요기관에 '대학' 없음 → false", () => {
    expect(isTargetBid(makeBid({ dmndInsttNm: "행정안전부" }))).toBe(false);
  });

  it("수요기관에 '병원' 포함 → false", () => {
    expect(isTargetBid(makeBid({ dmndInsttNm: "한국교원대학교병원" }))).toBe(false);
  });

  it("업무구분이 '물품' → false", () => {
    expect(isTargetBid(makeBid({ bsnsDivNm: "물품" }))).toBe(false);
  });

  it("업무구분이 '공사' → false", () => {
    expect(isTargetBid(makeBid({ bsnsDivNm: "공사" }))).toBe(false);
  });

  it("공고명에 '유지보수' 포함 → false", () => {
    expect(isTargetBid(makeBid({ bidNtceNm: "학사관리시스템 유지보수" }))).toBe(false);
  });

  it("업종명에 SW 키워드 없음 → false", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "건축설계및관련서비스업" }))).toBe(false);
  });

  it("업종명에 '컴퓨터' 포함 → true", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "컴퓨터시스템설계및구축서비스업" }))).toBe(
      true,
    );
  });

  it("업종명에 '정보보호' 포함 → true", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "정보보호서비스업" }))).toBe(true);
  });

  it("업종명에 '이러닝서비스업' 포함 → true", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "이러닝서비스업" }))).toBe(true);
  });

  it("업종명에 '정보통신' 포함 → true", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "정보통신공사업" }))).toBe(true);
  });

  it("제외 업종 '디지털콘텐츠개발서비스사업' 단독 → false", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "디지털콘텐츠개발서비스사업" }))).toBe(
      false,
    );
  });

  it("복수 업종: SW 키워드 + 제외업종 혼재 → SW 세그먼트 때문에 true", () => {
    expect(
      isTargetBid(
        makeBid({
          bidprcPsblIndstrytyNm: "소프트웨어개발공급업, 디지털콘텐츠개발서비스사업",
        }),
      ),
    ).toBe(true);
  });

  it("복수 업종: 제외업종만 SW 키워드 포함한 세그먼트 없음 → false", () => {
    expect(
      isTargetBid(
        makeBid({
          bidprcPsblIndstrytyNm: "디지털콘텐츠개발서비스사업, 건축설계및관련서비스업",
        }),
      ),
    ).toBe(false);
  });

  it("업종명 빈 문자열 → false", () => {
    expect(isTargetBid(makeBid({ bidprcPsblIndstrytyNm: "" }))).toBe(false);
  });
});

function rules(over: Partial<FilterRules> = {}): FilterRules {
  return { ...DEFAULT_RULES, ...over };
}

describe("isTargetBid — 동적 규칙 주입", () => {
  it("명시한 DEFAULT_RULES 결과는 무인자 호출과 동일", () => {
    const bid = makeBid();
    expect(isTargetBid(bid, DEFAULT_RULES)).toBe(isTargetBid(bid));
  });

  it("dmndInclude 빈 그룹 → 제약 비활성, '대학' 없어도 통과", () => {
    expect(isTargetBid(makeBid({ dmndInsttNm: "행정안전부" }), rules({ dmndInclude: [] }))).toBe(
      true,
    );
  });

  it("industryInclude 빈 그룹 → 포함 제약 비활성, 비SW 업종도 통과", () => {
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "건축설계및관련서비스업" }),
        rules({ industryInclude: [] }),
      ),
    ).toBe(true);
  });

  it("industryInclude 빈 그룹이어도 industryExclude 는 적용 — 제외 세그먼트만 있으면 false", () => {
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "디지털콘텐츠개발서비스사업" }),
        rules({ industryInclude: [], industryExclude: ["디지털콘텐츠개발서비스사업"] }),
      ),
    ).toBe(false);
  });

  it("industryInclude 빈 그룹: clean 세그먼트 존재 시 통과 (per-segment 일관)", () => {
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "디지털콘텐츠개발서비스사업, 소프트웨어개발공급업" }),
        rules({ industryInclude: [], industryExclude: ["디지털콘텐츠개발서비스사업"] }),
      ),
    ).toBe(true);
  });

  it("bsnsDivEquals 빈 그룹 → 업무구분 제약 비활성, '물품'도 통과", () => {
    expect(isTargetBid(makeBid({ bsnsDivNm: "물품" }), rules({ bsnsDivEquals: [] }))).toBe(true);
  });

  it("커스텀 industryInclude=['건축'] → 비SW 공고가 true로 뒤집힘", () => {
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "건축설계및관련서비스업" }),
        rules({ industryInclude: ["건축"] }),
      ),
    ).toBe(true);
  });

  it("커스텀 nameExclude 추가어 → 신규 제외 동작", () => {
    expect(
      isTargetBid(makeBid({ bidNtceNm: "AI 챗봇 구축" }), rules({ nameExclude: ["챗봇"] })),
    ).toBe(false);
  });

  it("커스텀 dmndExclude 추가어 → 신규 제외 동작", () => {
    expect(
      isTargetBid(makeBid({ dmndInsttNm: "한국방송통신대학교" }), rules({ dmndExclude: ["방송"] })),
    ).toBe(false);
  });

  it("커스텀 bsnsDivEquals=['물품'] → 물품 공고 통과, 용역 공고 탈락", () => {
    const r = rules({ bsnsDivEquals: ["물품"] });
    expect(isTargetBid(makeBid({ bsnsDivNm: "물품" }), r)).toBe(true);
    expect(isTargetBid(makeBid({ bsnsDivNm: "용역" }), r)).toBe(false);
  });

  it("커스텀 멀티세그먼트: include 맞고 exclude 없는 세그먼트 존재 → true", () => {
    // "건축설계서비스업"(건축O 리모델링X → 통과), "건축리모델링업"(건축O 리모델링O → 탈락)
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "건축설계서비스업, 건축리모델링업" }),
        rules({ industryInclude: ["건축"], industryExclude: ["리모델링"] }),
      ),
    ).toBe(true);
  });

  it("커스텀 멀티세그먼트: include 맞는 유일 세그먼트가 exclude도 매치 → false", () => {
    // 세그먼트별 exclude 우선 — 같은 세그먼트가 둘 다 매치하면 탈락
    expect(
      isTargetBid(
        makeBid({ bidprcPsblIndstrytyNm: "건축리모델링업" }),
        rules({ industryInclude: ["건축"], industryExclude: ["리모델링"] }),
      ),
    ).toBe(false);
  });
});
