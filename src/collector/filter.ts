import type { BidItem } from "./types";

/** 동적 수집 필터 규칙. 각 그룹은 패턴 문자열 배열. */
export interface FilterRules {
  /** dmndInsttNm 에 포함되어야 함 (그룹 내 OR). 빈 그룹 → 제약 비활성. */
  dmndInclude: string[];
  /** dmndInsttNm 에 포함되면 제외. */
  dmndExclude: string[];
  /** bsnsDivNm 완전일치 중 하나여야 함. 빈 그룹 → 제약 비활성. */
  bsnsDivEquals: string[];
  /** bidNtceNm 에 포함되면 제외. */
  nameExclude: string[];
  /** 업종 세그먼트에 포함되어야 함 (그룹 내 OR). 빈 그룹 → 업종 제약 비활성. */
  industryInclude: string[];
  /** 업종 세그먼트에 포함되면 해당 세그먼트 탈락. */
  industryExclude: string[];
}

/** rule_type 식별자 — D1 filter_rules.rule_type 와 1:1. */
export type RuleType = keyof FilterRulesByType;
type FilterRulesByType = {
  dmnd_include: string;
  dmnd_exclude: string;
  bsns_div_equals: string;
  name_exclude: string;
  industry_include: string;
  industry_exclude: string;
};

export const RULE_TYPES: readonly RuleType[] = [
  "dmnd_include",
  "dmnd_exclude",
  "bsns_div_equals",
  "name_exclude",
  "industry_include",
  "industry_exclude",
] as const;

/**
 * 기본 규칙 — 하드코딩 시절 동작과 동일.
 * migrations/0002_filter_rules.sql 시드값과 **반드시 동기**.
 */
export const DEFAULT_RULES: FilterRules = {
  dmndInclude: ["대학"],
  dmndExclude: ["병원"],
  bsnsDivEquals: ["용역"],
  nameExclude: ["유지보수"],
  industryInclude: ["소프트웨어", "컴퓨터", "정보보호", "이러닝서비스업", "정보통신"],
  industryExclude: ["디지털콘텐츠개발서비스사업"],
};

/**
 * 대학 SW 용역 입찰공고 필터 — 규칙 주입형 순수 함수.
 *
 * 조건 (AND):
 * 1. dmndInsttNm 이 dmndInclude 중 하나 포함 (빈 그룹 → skip)
 * 2. dmndInsttNm 이 dmndExclude 어느 것도 미포함
 * 3. bsnsDivNm 이 bsnsDivEquals 중 하나와 일치 (빈 그룹 → skip)
 * 4. bidNtceNm 이 nameExclude 어느 것도 미포함
 * 5. 업종 세그먼트 중 — industryInclude 포함 AND industryExclude 미포함 인 것 존재
 *    (industryInclude 빈 그룹 → 업종 제약 skip)
 */
export function isTargetBid(item: BidItem, rules: FilterRules = DEFAULT_RULES): boolean {
  if (
    rules.dmndInclude.length > 0 &&
    !rules.dmndInclude.some((kw) => item.dmndInsttNm.includes(kw))
  )
    return false;
  if (rules.dmndExclude.some((kw) => item.dmndInsttNm.includes(kw))) return false;
  if (rules.bsnsDivEquals.length > 0 && !rules.bsnsDivEquals.includes(item.bsnsDivNm)) return false;
  if (rules.nameExclude.some((kw) => item.bidNtceNm.includes(kw))) return false;

  const segments = item.bidprcPsblIndstrytyNm.split(",").map((s) => s.trim());

  // industryInclude 빈 그룹 → 포함 제약 해제. 단 industryExclude 는 항상 적용
  // (dmnd/name exclude 와 일관). 세그먼트 단위 — exclude 안 걸린 세그먼트가 하나라도 있으면 통과.
  if (rules.industryInclude.length === 0) {
    return segments.some((seg) => !rules.industryExclude.some((ex) => seg.includes(ex)));
  }

  return segments.some((seg) => {
    if (rules.industryExclude.some((ex) => seg.includes(ex))) return false;
    return rules.industryInclude.some((kw) => seg.includes(kw));
  });
}
