import { DEFAULT_RULES, type FilterRules, RULE_TYPES, type RuleType } from "../collector/filter";
import type { BidItem } from "../collector/types";

export interface BidRow {
  bid_ntce_no: string;
  bid_ntce_ord: string;
  bid_ntce_nm: string | null;
  bid_ntce_sttus_nm: string | null;
  bid_ntce_date: string | null;
  bsns_div_nm: string | null;
  ntce_instt_nm: string | null;
  dmnd_instt_nm: string | null;
  cntrct_cncls_mthd_nm: string | null;
  bid_clse_date: string | null;
  bid_clse_tm: string | null;
  openg_date: string | null;
  openg_tm: string | null;
  asign_bdgt_amt: number | null;
  presmpt_prce: number | null;
  bidprc_psbl_indstryty_nm: string | null;
  bid_ntce_url: string | null;
  proposal_request_file_nm: string | null;
  proposal_request_url: string | null;
  collected_at: string;
  history_ords?: string;
}

/** 마감 상태 어휘 — 검색 필터(`searchBids`)와 상태 배지(`renderStatusBadge`)가 공유하는 단일 원천. */
export const CLOSED_STATUS_KEYWORDS = ["마감", "취소", "종료", "개찰"] as const;

export interface SearchParams {
  q?: string;
  dmnd?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  /** true면 마감 지난 공고 포함. 기본 false → 마감 공고 제외. */
  includeClosed?: boolean;
  /** 마감 기준일 YYYY-MM-DD (KST). includeClosed=false일 때만 사용. 생략 시 마감 필터 비활성. */
  today?: string;
}

export interface SearchResult {
  rows: BidRow[];
  total: number;
  page: number;
  pageSize: number;
}

function parseAmount(v: string): number | null {
  const n = Number(v);
  return Number.isNaN(n) || n === 0 ? null : n;
}

/** LIKE 메타문자(\ % _)를 이스케이프 — 사용자 입력을 리터럴로 매칭. `ESCAPE '\'` 절과 함께 사용. */
function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, "\\$&");
}

function hasSpecialChars(query: string): boolean {
  return /[\\%_"]/.test(query);
}

function shouldApplyFts(query: string): boolean {
  if (hasSpecialChars(query)) return false;
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  // 모든 검색 토큰이 3글자 이상일 때만 FTS 인덱스 활용 (중간글자 매칭 누락 방지)
  return tokens.length > 0 && tokens.every((t) => t.length >= 3);
}

/**
 * 사용자 입력 문자열을 FTS5 MATCH 쿼리에 적합하도록 변환합니다.
 * - 공백을 기준으로 단어를 분리합니다.
 * - 각 단어 내의 큰따옴표(")는 두 배("")로 늘려 이스케이프합니다.
 * - 각 단어는 쌍따옴표로 감싸 구문 오류를 방지하고 정확한 단어 매칭을 보장합니다.
 * - 모든 토큰을 AND 조건으로 엮어 공백 검색을 지원합니다.
 */
function buildFtsQuery(field: string, query: string): string {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `${field} : "${t.replace(/"/g, '""')}"*`).join(" AND ");
}

export async function upsertBids(db: D1Database, items: BidItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const sql = `
    INSERT INTO bids (
      bid_ntce_no, bid_ntce_ord, bid_ntce_nm, bid_ntce_sttus_nm,
      bid_ntce_date, bsns_div_nm, ntce_instt_nm, dmnd_instt_nm,
      cntrct_cncls_mthd_nm, bid_clse_date, bid_clse_tm,
      openg_date, openg_tm, asign_bdgt_amt, presmpt_prce,
      bidprc_psbl_indstryty_nm, bid_ntce_url, proposal_request_file_nm,
      proposal_request_url, collected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(bid_ntce_no, bid_ntce_ord) DO UPDATE SET
      bid_ntce_nm = excluded.bid_ntce_nm,
      bid_ntce_sttus_nm = excluded.bid_ntce_sttus_nm,
      bid_ntce_date = excluded.bid_ntce_date,
      bsns_div_nm = excluded.bsns_div_nm,
      ntce_instt_nm = excluded.ntce_instt_nm,
      dmnd_instt_nm = excluded.dmnd_instt_nm,
      cntrct_cncls_mthd_nm = excluded.cntrct_cncls_mthd_nm,
      bid_clse_date = excluded.bid_clse_date,
      bid_clse_tm = excluded.bid_clse_tm,
      openg_date = excluded.openg_date,
      openg_tm = excluded.openg_tm,
      asign_bdgt_amt = excluded.asign_bdgt_amt,
      presmpt_prce = excluded.presmpt_prce,
      bidprc_psbl_indstryty_nm = excluded.bidprc_psbl_indstryty_nm,
      bid_ntce_url = excluded.bid_ntce_url,
      proposal_request_file_nm = COALESCE(excluded.proposal_request_file_nm, bids.proposal_request_file_nm),
      proposal_request_url = COALESCE(excluded.proposal_request_url, bids.proposal_request_url),
      collected_at = excluded.collected_at
  `.trim();

  const now = new Date().toISOString();
  const stmts = items.map((item) =>
    db
      .prepare(sql)
      .bind(
        item.bidNtceNo,
        item.bidNtceOrd,
        item.bidNtceNm,
        item.bidNtceSttusNm,
        item.bidNtceDate,
        item.bsnsDivNm,
        item.ntceInsttNm,
        item.dmndInsttNm,
        item.cntrctCnclsMthdNm,
        item.bidClseDate,
        item.bidClseTm,
        item.opengDate,
        item.opengTm,
        parseAmount(item.asignBdgtAmt),
        parseAmount(item.presmptPrce),
        item.bidprcPsblIndstrytyNm,
        item.bidNtceUrl,
        item.proposalRequestFileNm ?? null,
        item.proposalRequestUrl ?? null,
        now,
      ),
  );

  await db.batch(stmts);
  return items.length;
}

export async function searchBids(db: D1Database, params: SearchParams): Promise<SearchResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (params.q) {
    const useFts = shouldApplyFts(params.q);
    const ftsQuery = useFts ? buildFtsQuery("bid_ntce_nm", params.q) : null;
    if (ftsQuery) {
      conditions.push(
        "(bid_ntce_no, bid_ntce_ord) IN (SELECT bid_ntce_no, bid_ntce_ord FROM bids_fts WHERE bids_fts MATCH ?)",
      );
      bindings.push(ftsQuery);
    }
    const tokens = params.q.trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      conditions.push("bid_ntce_nm LIKE ? ESCAPE '\\'");
      bindings.push(`%${escapeLike(token)}%`);
    }
  }
  if (params.dmnd) {
    const useFts = shouldApplyFts(params.dmnd);
    const ftsQuery = useFts ? buildFtsQuery("dmnd_instt_nm", params.dmnd) : null;
    if (ftsQuery) {
      conditions.push(
        "(bid_ntce_no, bid_ntce_ord) IN (SELECT bid_ntce_no, bid_ntce_ord FROM bids_fts WHERE bids_fts MATCH ?)",
      );
      bindings.push(ftsQuery);
    }
    const tokens = params.dmnd.trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      conditions.push("dmnd_instt_nm LIKE ? ESCAPE '\\'");
      bindings.push(`%${escapeLike(token)}%`);
    }
  }
  if (params.from) {
    conditions.push("bid_ntce_date >= ?");
    bindings.push(params.from);
  }
  if (params.to) {
    conditions.push("bid_ntce_date <= ?");
    bindings.push(params.to);
  }
  // 마감 지난 공고 제외 (soft 필터 — 삭제 없음). bid_clse_date 저장 포맷은 YYYY-MM-DD
  // (prod 확인 — client.ts raw 저장). today도 동일 포맷이라 사전순=시간순 비교 성립.
  // 컬럼 미래핑 → idx_bids_clse 사용. null·빈값은 정보 없음 → 숨기지 않음.
  if (!params.includeClosed && params.today) {
    conditions.push("(bid_clse_date IS NULL OR bid_clse_date = '' OR bid_clse_date >= ?)");
    bindings.push(params.today);

    // 마감/취소 상태 공고 제외 — 미래 마감일이어도 상태가 종료면 노출 대상 아님.
    // 키워드는 고정 내부 상수라 LIKE 메타문자 없음 → escapeLike/ESCAPE 불필요.
    const statusNotLike = CLOSED_STATUS_KEYWORDS.map(() => "bid_ntce_sttus_nm NOT LIKE ?").join(
      " AND ",
    );
    conditions.push(`(bid_ntce_sttus_nm IS NULL OR (${statusNotLike}))`);
    for (const keyword of CLOSED_STATUS_KEYWORDS) bindings.push(`%${keyword}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db
    .prepare(
      `
      WITH ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY bid_ntce_no ORDER BY bid_ntce_ord DESC) as rn FROM bids
      ),
      latest_bids AS (
        SELECT * FROM ranked WHERE rn = 1
      )
      SELECT COUNT(*) as total FROM latest_bids ${where}
    `.trim(),
    )
    .bind(...bindings)
    .first<{ total: number }>();

  const total = countResult?.total ?? 0;

  const querySql = `
    WITH ranked AS (
      SELECT *,
             ROW_NUMBER() OVER (PARTITION BY bid_ntce_no ORDER BY bid_ntce_ord DESC) as rn
      FROM bids
    ),
    latest_bids AS (
      SELECT * FROM ranked WHERE rn = 1
    ),
    filtered AS (
      SELECT * FROM latest_bids ${where}
    ),
    paginated AS (
      SELECT * FROM filtered
      ORDER BY bid_ntce_date DESC, bid_ntce_no DESC
      LIMIT ? OFFSET ?
    )
    SELECT *,
           (SELECT GROUP_CONCAT(b2.bid_ntce_ord, ',') FROM bids b2 WHERE b2.bid_ntce_no = paginated.bid_ntce_no ORDER BY b2.bid_ntce_ord ASC) as history_ords
    FROM paginated
  `.trim();

  const rows = await db
    .prepare(querySql)
    .bind(...bindings, pageSize, offset)
    .all<BidRow>();

  return { rows: rows.results, total, page, pageSize };
}

export interface FilterRuleRow {
  id: number;
  rule_type: string;
  pattern: string;
  enabled: number;
  created_at: string;
}

const RULE_TYPE_TO_KEY: Record<RuleType, keyof FilterRules> = {
  dmnd_include: "dmndInclude",
  dmnd_exclude: "dmndExclude",
  bsns_div_equals: "bsnsDivEquals",
  name_exclude: "nameExclude",
  industry_include: "industryInclude",
  industry_exclude: "industryExclude",
};

function isRuleType(v: string): v is RuleType {
  return (RULE_TYPES as readonly string[]).includes(v);
}

/**
 * 활성(enabled=1) 규칙을 그룹핑해 FilterRules 반환.
 * 활성 규칙 0건(미시드 또는 전체 비활성) → DEFAULT_RULES 폴백 (fail-safe).
 */
export async function getFilterRules(db: D1Database): Promise<FilterRules> {
  const res = await db
    .prepare("SELECT rule_type, pattern FROM filter_rules WHERE enabled = 1")
    .all<{ rule_type: string; pattern: string }>();

  // 참조 반환 시 호출부 mutation 이 전역 상수 오염 → 복제.
  if (res.results.length === 0) return structuredClone(DEFAULT_RULES);

  const rules: FilterRules = {
    dmndInclude: [],
    dmndExclude: [],
    bsnsDivEquals: [],
    nameExclude: [],
    industryInclude: [],
    industryExclude: [],
  };
  for (const row of res.results) {
    if (isRuleType(row.rule_type)) rules[RULE_TYPE_TO_KEY[row.rule_type]].push(row.pattern);
  }
  return rules;
}

/** 어드민용 — 비활성 포함 전체 규칙 (rule_type, id 순). */
export async function listFilterRules(db: D1Database): Promise<FilterRuleRow[]> {
  const res = await db
    .prepare(
      "SELECT id, rule_type, pattern, enabled, created_at FROM filter_rules ORDER BY rule_type, id",
    )
    .all<FilterRuleRow>();
  return res.results;
}

export async function addFilterRule(
  db: D1Database,
  ruleType: string,
  pattern: string,
): Promise<void> {
  if (!isRuleType(ruleType)) throw new Error(`invalid rule_type: ${ruleType}`);
  const trimmed = pattern.trim();
  if (trimmed === "") throw new Error("pattern must not be empty");

  // 중복 (rule_type, pattern) → 새 행 만들지 않고 기존 행 재활성화 (idempotent add).
  await db
    .prepare(
      "INSERT INTO filter_rules (rule_type, pattern, enabled, created_at) VALUES (?, ?, 1, ?) " +
        "ON CONFLICT(rule_type, pattern) DO UPDATE SET enabled = 1",
    )
    .bind(ruleType, trimmed, new Date().toISOString())
    .run();
}

export async function deleteFilterRule(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM filter_rules WHERE id = ?").bind(id).run();
}

export async function setFilterRuleEnabled(
  db: D1Database,
  id: number,
  enabled: boolean,
): Promise<void> {
  await db
    .prepare("UPDATE filter_rules SET enabled = ? WHERE id = ?")
    .bind(enabled ? 1 : 0, id)
    .run();
}

// --- login rate-limiting ---

export async function countRecentFailures(
  db: D1Database,
  ip: string,
  since: number,
): Promise<number> {
  const res = await db
    .prepare(
      "SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND attempted_at >= ? AND success = 0",
    )
    .bind(ip, since)
    .first<{ count: number }>();
  return res?.count ?? 0;
}

export async function recordLoginAttempt(
  db: D1Database,
  ip: string,
  success: boolean,
  now: number,
): Promise<void> {
  await db
    .prepare("INSERT INTO login_attempts (ip, attempted_at, success) VALUES (?, ?, ?)")
    .bind(ip, now, success ? 1 : 0)
    .run();
}

export async function clearLoginFailures(db: D1Database, ip: string): Promise<void> {
  await db.prepare("DELETE FROM login_attempts WHERE ip = ? AND success = 0").bind(ip).run();
}

export async function pruneOldLoginAttempts(db: D1Database, before: number): Promise<void> {
  await db.prepare("DELETE FROM login_attempts WHERE attempted_at < ?").bind(before).run();
}
