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
  collected_at: string;
}

export interface SearchParams {
  q?: string;
  dmnd?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  /** true면 마감 지난 공고 포함. 기본 false → 마감 공고 제외. */
  includeClosed?: boolean;
  /** 마감 기준일 YYYY-MM-DD (KST). includeClosed=false일 때만 사용. */
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

export async function upsertBids(db: D1Database, items: BidItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const sql = `
    INSERT INTO bids (
      bid_ntce_no, bid_ntce_ord, bid_ntce_nm, bid_ntce_sttus_nm,
      bid_ntce_date, bsns_div_nm, ntce_instt_nm, dmnd_instt_nm,
      cntrct_cncls_mthd_nm, bid_clse_date, bid_clse_tm,
      openg_date, openg_tm, asign_bdgt_amt, presmpt_prce,
      bidprc_psbl_indstryty_nm, bid_ntce_url, collected_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        now,
      ),
  );

  const results = await db.batch(stmts);
  return results.reduce((sum: number, r: D1Result) => sum + (r.meta.changes ?? 0), 0);
}

export async function searchBids(db: D1Database, params: SearchParams): Promise<SearchResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (params.q) {
    conditions.push("bid_ntce_nm LIKE ?");
    bindings.push(`%${params.q}%`);
  }
  if (params.dmnd) {
    conditions.push("dmnd_instt_nm LIKE ?");
    bindings.push(`%${params.dmnd}%`);
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
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM bids ${where}`)
    .bind(...bindings)
    .first<{ total: number }>();

  const total = countResult?.total ?? 0;

  const rows = await db
    .prepare(
      `SELECT * FROM bids ${where} ORDER BY bid_ntce_date DESC, bid_ntce_no DESC LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, pageSize, offset)
    .all<BidRow>();

  return { rows: rows.results, total, page, pageSize };
}
