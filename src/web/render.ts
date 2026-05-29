import { type FilterRules, classifySegments } from "../collector/filter";
import type { BidRow, SearchResult } from "../db/repo";

/** 배정예산(원) → X.X억원 */
export function formatAmount(amount: number | null): string {
  if (amount === null) return "미정";
  return `${(amount / 100_000_000).toFixed(1)}억원`;
}

/** 다양한 날짜 표기(YYYYMMDD, YYYY-MM-DD, +시간)를 숫자만 추출해 정규화 */
export function formatDate(raw: string | null): string {
  if (!raw) return "-";
  const d = raw.replace(/\D/g, "");
  if (d.length === 0) return "-";
  if (d.length >= 12) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${d.slice(8, 10)}:${d.slice(10, 12)}`;
  }
  if (d.length >= 8) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  return raw;
}

/** 계약방법 → 시각 구분용 CSS 클래스 */
export function contractMethodClass(name: string | null): string {
  if (name === null) return "method-default";
  if (name.includes("제한경쟁")) return "method-limited";
  if (name.includes("일반경쟁")) return "method-general";
  return "method-default";
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : "#";
}

export function renderStatusBadge(status: string | null): string {
  if (!status) return "";
  let cls = "badge-default";
  if (/마감|취소|종료|개찰/.test(status)) cls = "badge-closed";
  else if (/공고중(?!지)|진행/.test(status)) cls = "badge-open";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

interface SearchQuery {
  q: string;
  dmnd: string;
  from: string;
  to: string;
  page: number;
  includeClosed: boolean;
}

interface RenderOpts {
  isAdmin: boolean;
  filterRules: FilterRules;
}

export function renderPage(result: SearchResult, query: SearchQuery, opts?: RenderOpts): string {
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const rows = result.rows.map((row) => renderRow(row, opts)).join("\n");
  const pagination = renderPagination(query, result.page, totalPages, result.total);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>bid-lens — 대학 SW 용역 입찰공고</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" rel="stylesheet" />
  <style>
    :root {
      --ink: #181d26;
      --body: #333840;
      --muted: #41454d;
      --hairline: #dddddd;
      --canvas: #ffffff;
      --surface-soft: #f8fafc;
      --primary: #181d26;
      --primary-active: #0d1218;
      --link: #1b61c9;
      --link-active: #1a3866;
      --info-border: #458fff;
      --success: #006400;
      --success-bg: #f0faf0;
      --r-sm: 6px;
      --r-md: 10px;
      --r-lg: 12px;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 400;
      line-height: 1.5;
      margin: 0;
      background: var(--canvas);
      color: var(--body);
    }
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 48px 48px 96px;
    }
    h1 {
      font-size: 28px;
      font-weight: 500;
      line-height: 1.2;
      color: var(--ink);
      margin: 0 0 32px;
    }
    form {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
      background: var(--canvas);
      padding: 24px;
      border-radius: var(--r-lg);
      border: 1px solid var(--hairline);
    }
    form input {
      border: 1px solid var(--hairline);
      border-radius: var(--r-sm);
      padding: 0 16px;
      height: 44px;
      font-size: 14px;
      font-family: inherit;
      color: var(--ink);
      background: var(--canvas);
    }
    form input:focus { border-color: var(--info-border); outline: 2px solid var(--info-border); outline-offset: 2px; }
    form input[name="q"] { flex: 2; min-width: 150px; }
    form input[name="dmnd"] { flex: 1.5; min-width: 120px; }
    form input[type="date"] { min-width: 130px; }
    .btn-primary {
      padding: 0 24px;
      height: 44px;
      background: var(--primary);
      color: #ffffff;
      border: none;
      border-radius: var(--r-lg);
      font-size: 14px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-primary:active { background: var(--primary-active); }
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      height: 44px;
      background: var(--canvas);
      color: var(--ink);
      border: 1px solid var(--hairline);
      border-radius: var(--r-lg);
      font-size: 14px;
      font-family: inherit;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;
    }
    .check-inline {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 44px;
      padding: 0 8px;
      font-size: 14px;
      color: var(--body);
      white-space: nowrap;
      cursor: pointer;
    }
    .check-inline input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); }
    .meta {
      font-size: 13px;
      font-weight: 500;
      color: var(--muted);
      letter-spacing: 0.16px;
      margin-bottom: 12px;
    }
    .scroll-x { overflow-x: auto; }
    .table-wrap {
      border: 1px solid var(--hairline);
      border-radius: var(--r-md);
      overflow: hidden;
      background: var(--canvas);
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      background: transparent;
      color: var(--muted);
      text-align: left;
      padding: 12px 16px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      white-space: nowrap;
      border-bottom: 1px solid var(--hairline);
    }
    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--hairline);
      vertical-align: top;
      font-size: 13px;
      color: var(--body);
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface-soft); }
    .title-cell { max-width: 340px; }
    .title-cell a {
      color: var(--link);
      text-decoration: none;
      font-weight: 500;
      line-height: 1.4;
    }
    .title-cell a:active { color: var(--link-active); }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.08em;
      padding: 2px 8px;
      border-radius: var(--r-sm);
      border: 1px solid var(--hairline);
      white-space: nowrap;
    }
    .badge-default { background: var(--surface-soft); color: var(--body); }
    .badge-closed { background: var(--surface-soft); color: var(--muted); }
    .badge-open { background: var(--success-bg); color: var(--success); border-color: #b7e0b7; }
    .label { font-size: 11px; color: var(--muted); margin-top: 3px; line-height: 1.35; }
    .amount { white-space: nowrap; }
    .ntce-date { white-space: nowrap; }
    .method {
      display: inline-block;
      font-size: 12px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: var(--r-sm);
      border: 1px solid var(--hairline);
      white-space: nowrap;
    }
    .method-general { background: #eef4ff; color: #1b4fa0; border-color: #bcd3f5; }
    .method-limited { background: #fff4e5; color: #9a5b00; border-color: #ffd9a0; }
    .method-default { background: var(--surface-soft); color: var(--body); }
    /* 업종 태그 */
    .industry-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
    .ind-chip {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 11px; padding: 1px 7px;
      border-radius: var(--r-sm); border: 1px solid var(--hairline);
      background: var(--surface-soft); color: var(--muted);
      white-space: nowrap;
    }
    .ind-chip-match {
      background: #eef4ff; color: #1b4fa0; border-color: #bcd3f5;
    }
    .ind-chip-excl {
      background: var(--surface-soft); color: var(--muted);
      text-decoration: line-through; opacity: 0.65;
    }
    .ind-match-badge {
      font-size: 10px; font-weight: 500;
      padding: 0 4px; border-radius: 3px;
      background: #1b4fa0; color: #fff;
    }
    .ind-x-btn {
      display: inline-flex; align-items: center;
      margin: 0; padding: 0; background: none; border: none;
      cursor: pointer; color: var(--muted); font-size: 11px; line-height: 1;
    }
    .ind-x-btn:hover { color: #b3261e; }
    .pagination {
      display: flex;
      gap: 4px;
      margin-top: 24px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .pagination a, .pagination span {
      padding: 6px 12px;
      border-radius: var(--r-md);
      border: 1px solid var(--hairline);
      font-size: 13px;
      text-decoration: none;
      color: var(--body);
      line-height: 1.4;
    }
    .pagination a:hover { background: var(--surface-soft); }
    .pagination .active { background: var(--ink); color: #ffffff; border-color: var(--ink); }
    .no-results { text-align: center; padding: 64px 24px; color: var(--muted); font-size: 14px; }
    @media (max-width: 768px) {
      .container { padding: 24px 16px 48px; }
      h1 { font-size: 22px; margin-bottom: 24px; }
      form { padding: 16px; flex-direction: column; }
      form input, .btn-primary, .btn-secondary { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>대학 SW 용역 입찰공고</h1>
    <form method="GET" action="/">
      <input name="q" type="text" placeholder="공고명 검색" value="${escapeHtml(query.q)}" />
      <input name="dmnd" type="text" placeholder="수요기관" value="${escapeHtml(query.dmnd)}" />
      <input name="from" type="date" value="${escapeHtml(query.from)}" title="공고일 시작" />
      <input name="to" type="date" value="${escapeHtml(query.to)}" title="공고일 종료" />
      <label class="check-inline" title="마감일이 지난 공고도 표시">
        <input type="checkbox" name="includeClosed" value="1"${query.includeClosed ? " checked" : ""} />
        마감 포함
      </label>
      <button type="submit" class="btn-primary">검색</button>
      <a href="/" class="btn-secondary">초기화</a>
    </form>
    <div class="meta">총 ${result.total.toLocaleString("ko-KR")}건 · ${result.page}/${totalPages} 페이지</div>
    ${
      result.rows.length === 0
        ? '<div class="no-results">결과가 없습니다.</div>'
        : `<div class="scroll-x"><div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>공고구분</th>
            <th>공고명</th>
            <th>수요기관</th>
            <th>계약방법</th>
            <th>배정예산</th>
            <th>공고일</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div></div>
    ${pagination}`
    }
  </div>
</body>
</html>`;
}

function renderIndustryTags(raw: string | null, opts: RenderOpts | undefined): string {
  if (!raw) return "";
  const rules = opts?.filterRules;
  if (!rules) return `<div class="label">${escapeHtml(raw)}</div>`;

  const segments = classifySegments(raw, rules);
  const chips = segments
    .map((info) => {
      const segHtml = escapeHtml(info.segment);
      if (!segHtml) return "";

      let cls = "ind-chip";
      let inner = segHtml;

      if (info.excluded) {
        cls += " ind-chip-excl";
      } else if (info.matchedBy !== null) {
        cls += " ind-chip-match";
        inner += ` <span class="ind-match-badge">${escapeHtml(info.matchedBy)}</span>`;
      }

      // X 버튼: admin 로그인 중이고 아직 excluded 아닌 세그먼트에만 표시
      let xBtn = "";
      if (opts?.isAdmin && !info.excluded) {
        xBtn = `<form method="POST" action="/admin/rules" style="display:inline">
          <input type="hidden" name="rule_type" value="industry_exclude" />
          <input type="hidden" name="pattern" value="${escapeHtml(info.segment)}" />
          <button type="submit" class="ind-x-btn" title="업종 제외 규칙 추가 (다음 수집부터 적용)">✕</button>
        </form>`;
      }

      return `<span class="${cls}">${inner}${xBtn}</span>`;
    })
    .filter(Boolean)
    .join("");

  return chips ? `<div class="industry-tags">${chips}</div>` : "";
}

function renderRow(row: BidRow, opts?: RenderOpts): string {
  return `<tr>
  <td>${renderStatusBadge(row.bid_ntce_sttus_nm)}</td>
  <td class="title-cell">
    ${
      row.bid_ntce_url
        ? `<a href="${safeUrl(row.bid_ntce_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.bid_ntce_nm ?? "-")}</a>`
        : escapeHtml(row.bid_ntce_nm ?? "-")
    }
    ${renderIndustryTags(row.bidprc_psbl_indstryty_nm, opts)}
  </td>
  <td>${escapeHtml(row.dmnd_instt_nm ?? "-")}</td>
  <td><span class="method ${contractMethodClass(row.cntrct_cncls_mthd_nm)}">${escapeHtml(row.cntrct_cncls_mthd_nm ?? "-")}</span></td>
  <td class="amount">${formatAmount(row.asign_bdgt_amt)}</td>
  <td class="ntce-date">${formatDate(row.bid_ntce_date)}</td>
</tr>`;
}

function renderPagination(
  query: SearchQuery,
  currentPage: number,
  totalPages: number,
  _total: number,
): string {
  if (totalPages <= 1) return "";

  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.dmnd) params.set("dmnd", query.dmnd);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);
    if (query.includeClosed) params.set("includeClosed", "1");
    params.set("page", String(p));
    return `/?${params.toString()}`;
  };

  const WINDOW = 2;
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= WINDOW) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  const items = pages
    .map((p) => {
      if (p === "…") return "<span>…</span>";
      if (p === currentPage) return `<span class="active">${p}</span>`;
      return `<a href="${buildUrl(p)}">${p}</a>`;
    })
    .join("\n");

  return `<div class="pagination">
  ${currentPage > 1 ? `<a href="${buildUrl(currentPage - 1)}">‹</a>` : ""}
  ${items}
  ${currentPage < totalPages ? `<a href="${buildUrl(currentPage + 1)}">›</a>` : ""}
</div>`;
}
