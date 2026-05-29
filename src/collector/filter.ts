import type { BidItem } from "./types";

// SW 업종 키워드 (from my-automator)
const SW_KEYWORDS = ["소프트웨어", "컴퓨터", "정보보호", "이러닝서비스업", "정보통신"] as const;
const EXCLUDED_INDUSTRY_KEYWORDS = ["디지털콘텐츠개발서비스사업"] as const;

/**
 * 대학 SW 용역 입찰공고 필터 — my-automator IsTargetBid 포팅
 *
 * 조건:
 * 1. 수요기관에 "대학" 포함
 * 2. 수요기관에 "병원" 미포함
 * 3. 업무구분 == "용역"
 * 4. 공고명에 "유지보수" 미포함
 * 5. 업종명 중 SW 키워드 포함, 제외 업종 미포함
 */
export function isTargetBid(item: BidItem): boolean {
  if (!item.dmndInsttNm.includes("대학")) return false;
  if (item.dmndInsttNm.includes("병원")) return false;
  if (item.bsnsDivNm !== "용역") return false;
  if (item.bidNtceNm.includes("유지보수")) return false;

  const segments = item.bidprcPsblIndstrytyNm.split(",").map((s) => s.trim());

  return segments.some((seg) => {
    if (EXCLUDED_INDUSTRY_KEYWORDS.some((ex) => seg.includes(ex))) return false;
    return SW_KEYWORDS.some((kw) => seg.includes(kw));
  });
}
