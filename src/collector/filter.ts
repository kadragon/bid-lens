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

export interface SegmentInfo {
  segment: string;
  /** industryInclude 에서 최초 매칭된 패턴. 없으면 null. excluded=true 이면 항상 null. */
  matchedBy: string | null;
  /** industryExclude 패턴에 매칭 → 이 세그먼트는 탈락. */
  excluded: boolean;
}

/**
 * 업종 문자열을 세그먼트별 분류 — isTargetBid 와 동일 로직, 시각화용.
 * industryInclude 빈 그룹 → matchedBy 항상 null (포함 제약 해제 상태).
 */
export function classifySegments(indstrytyNm: string, rules: FilterRules): SegmentInfo[] {
  return indstrytyNm.split(",").map((raw) => {
    const segment = raw.trim();
    const isExcluded = rules.industryExclude.some((ex) => segment.includes(ex));
    if (isExcluded) return { segment, matchedBy: null, excluded: true };
    const matchedBy =
      rules.industryInclude.length > 0
        ? (rules.industryInclude.find((kw) => segment.includes(kw)) ?? null)
        : null;
    return { segment, matchedBy, excluded: false };
  });
}

/** BidItem fields the filter reads. */
export type FilterInput = Pick<
  BidItem,
  "dmndInsttNm" | "bsnsDivNm" | "bidNtceNm" | "bidprcPsblIndstrytyNm"
>;

/** Filter verdict plus the reason behind it. */
export interface BidVerdict {
  pass: boolean;
  /** Rule that rejected the bid; null when pass. Industry rejections use industry_include / industry_exclude. */
  rule: RuleType | null;
  /**
   * Pattern behind the verdict — on reject: the matched exclude pattern (null for an unmet include rule);
   * on pass: the matched industryInclude pattern (null when industryInclude is empty).
   */
  keyword: string | null;
}

function reject(rule: RuleType, keyword: string | null = null): BidVerdict {
  return { pass: false, rule, keyword };
}

/**
 * University SW service bid verdict with its reason — the single implementation behind isTargetBid.
 *
 * Conditions (AND, evaluated in order; the first failing one is reported):
 * 1. dmndInsttNm contains one of dmndInclude (empty group → skipped)
 * 2. dmndInsttNm contains none of dmndExclude
 * 3. bsnsDivNm equals one of bsnsDivEquals (empty group → skipped)
 * 4. bidNtceNm contains none of nameExclude
 * 5. Some industry segment matches industryInclude AND no industryExclude
 *    (empty industryInclude → include constraint skipped)
 */
export function explainBid(item: FilterInput, rules: FilterRules = DEFAULT_RULES): BidVerdict {
  if (
    rules.dmndInclude.length > 0 &&
    !rules.dmndInclude.some((kw) => item.dmndInsttNm.includes(kw))
  )
    return reject("dmnd_include");
  const dmndExcluded = rules.dmndExclude.find((kw) => item.dmndInsttNm.includes(kw));
  if (dmndExcluded !== undefined) return reject("dmnd_exclude", dmndExcluded);
  if (rules.bsnsDivEquals.length > 0 && !rules.bsnsDivEquals.includes(item.bsnsDivNm))
    return reject("bsns_div_equals");
  const nameExcluded = rules.nameExclude.find((kw) => item.bidNtceNm.includes(kw));
  if (nameExcluded !== undefined) return reject("name_exclude", nameExcluded);

  // Empty industryInclude lifts the include constraint, but industryExclude always applies
  // (consistent with dmnd/name exclude). Per segment — any segment not excluded passes.
  // Only a segment that met the include rule and was then excluded is reported as industry_exclude.
  let excludedBy: string | null = null;
  for (const raw of item.bidprcPsblIndstrytyNm.split(",")) {
    const seg = raw.trim();
    let matchedBy: string | null = null;
    if (rules.industryInclude.length > 0) {
      matchedBy = rules.industryInclude.find((kw) => seg.includes(kw)) ?? null;
      if (matchedBy === null) continue;
    }
    const segExcluded = rules.industryExclude.find((ex) => seg.includes(ex));
    if (segExcluded === undefined) return { pass: true, rule: null, keyword: matchedBy };
    excludedBy ??= segExcluded;
  }
  return excludedBy === null ? reject("industry_include") : reject("industry_exclude", excludedBy);
}

/** University SW service bid filter — pure function with injected rules. Conditions: see explainBid. */
export function isTargetBid(item: BidItem, rules: FilterRules = DEFAULT_RULES): boolean {
  return explainBid(item, rules).pass;
}

export interface VerdictChange<T> {
  item: T;
  before: BidVerdict;
  after: BidVerdict;
}

export interface RuleComparison<T> {
  /** passed under before, rejected under after */
  newlyExcluded: VerdictChange<T>[];
  /** rejected under before, passed under after */
  newlyIncluded: VerdictChange<T>[];
  /** samples whose pass/fail did not change */
  unchanged: number;
}

/** Apply both rule sets to the samples and collect bids whose pass/fail flips — for trying rules before saving. */
export function compareRules<T extends FilterInput>(
  items: readonly T[],
  before: FilterRules,
  after: FilterRules,
): RuleComparison<T> {
  const result: RuleComparison<T> = { newlyExcluded: [], newlyIncluded: [], unchanged: 0 };
  for (const item of items) {
    const change = { item, before: explainBid(item, before), after: explainBid(item, after) };
    if (change.before.pass === change.after.pass) result.unchanged++;
    else if (change.before.pass) result.newlyExcluded.push(change);
    else result.newlyIncluded.push(change);
  }
  return result;
}
