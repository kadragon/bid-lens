import { describe, expect, it } from "vitest";
import { isTargetBid } from "../src/collector/filter";
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
