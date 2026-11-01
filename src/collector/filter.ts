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

/** 필터 판정에 쓰는 BidItem 필드. */
export type FilterInput = Pick<
  BidItem,
  "dmndInsttNm" | "bsnsDivNm" | "bidNtceNm" | "bidprcPsblIndstrytyNm"
>;

/** 판정 결과 + 근거. */
export interface BidVerdict {
  pass: boolean;
  /** 탈락시킨 조건. pass=true 이면 null. 업종 탈락은 industry_include / industry_exclude. */
  rule: RuleType | null;
  /**
   * 판정에 쓰인 패턴 — 탈락: 걸린 제외 패턴 (포함 조건 미충족이면 null),
   * 통과: 매칭된 industryInclude 패턴 (industryInclude 빈 그룹이면 null).
   */
  keyword: string | null;
}

function reject(rule: RuleType, keyword: string | null = null): BidVerdict {
  return { pass: false, rule, keyword };
}

/**
 * 대학 SW 용역 입찰공고 판정 + 근거 — isTargetBid 의 단일 구현.
 *
 * 조건 (AND, 순서대로 평가해 처음 실패한 조건을 보고):
 * 1. dmndInsttNm 이 dmndInclude 중 하나 포함 (빈 그룹 → skip)
 * 2. dmndInsttNm 이 dmndExclude 어느 것도 미포함
 * 3. bsnsDivNm 이 bsnsDivEquals 중 하나와 일치 (빈 그룹 → skip)
 * 4. bidNtceNm 이 nameExclude 어느 것도 미포함
 * 5. 업종 세그먼트 중 — industryInclude 포함 AND industryExclude 미포함 인 것 존재
 *    (industryInclude 빈 그룹 → 업종 제약 skip)
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

  // industryInclude 빈 그룹 → 포함 제약 해제. 단 industryExclude 는 항상 적용
  // (dmnd/name exclude 와 일관). 세그먼트 단위 — exclude 안 걸린 세그먼트가 하나라도 있으면 통과.
  // 포함 조건은 맞았으나 exclude 로 탈락한 세그먼트만 industry_exclude 근거로 보고.
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

/** 대학 SW 용역 입찰공고 필터 — 규칙 주입형 순수 함수. 조건은 explainBid 참고. */
export function isTargetBid(item: BidItem, rules: FilterRules = DEFAULT_RULES): boolean {
  return explainBid(item, rules).pass;
}

export interface VerdictChange<T> {
  item: T;
  before: BidVerdict;
  after: BidVerdict;
}

export interface RuleComparison<T> {
  /** before 통과 → after 탈락 */
  newlyExcluded: VerdictChange<T>[];
  /** before 탈락 → after 통과 */
  newlyIncluded: VerdictChange<T>[];
  /** 통과 여부가 같은 표본 수 */
  unchanged: number;
}

/** 표본에 두 규칙을 적용해 통과 여부가 바뀐 공고를 모은다 — 규칙 저장 전 시험용. */
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
