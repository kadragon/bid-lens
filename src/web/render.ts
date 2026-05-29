import type { BidRow, SearchResult } from "../db/repo";

export function formatAmount(amount: number | null): string {
  if (!amount) return "미정";
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** YYYYMMDDHHSS → YYYY-MM-DD HH:MM */
export function formatDate(raw: string | null): string {
  if (!raw) return "-";
  if (raw.length >= 12) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
  }
  if (raw.length >= 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface SearchQuery {
  q: string;
  dmnd: string;
  from: string;
  to: string;
  page: number;
}

export function renderPage(result: SearchResult, query: SearchQuery): string {
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const rows = result.rows.map((row) => renderRow(row)).join("\n");

  const pagination = renderPagination(query, result.page, totalPages, result.total);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>bid-lens — 대학 SW 용역 입찰공고</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; font-size: 14px; margin: 0; background: #f8f9fa; color: #212529; }
    .container { max-width: 1200px; margin: 0 auto; padding: 1rem; }
    h1 { font-size: 1.4rem; margin-bottom: 1rem; }
    form { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; background: #fff; padding: 1rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    form input { border: 1px solid #dee2e6; border-radius: 4px; padding: 0.4rem 0.6rem; font-size: 13px; }
    form input[name="q"] { flex: 2; min-width: 150px; }
    form input[name="dmnd"] { flex: 1.5; min-width: 120px; }
    form input[type="date"] { min-width: 120px; }
    form button { padding: 0.4rem 1rem; background: #0d6efd; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
    form button:hover { background: #0b5ed7; }
    .meta { font-size: 12px; color: #6c757d; margin-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    th { background: #343a40; color: #fff; text-align: left; padding: 0.6rem 0.8rem; font-size: 12px; white-space: nowrap; }
    td { padding: 0.5rem 0.8rem; border-bottom: 1px solid #f0f0f0; vertical-align: top; font-size: 13px; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8f9fa; }
    .title-cell { max-width: 320px; }
    .title-cell a { color: #0d6efd; text-decoration: none; font-weight: 500; }
    .title-cell a:hover { text-decoration: underline; }
    .amount { white-space: nowrap; }
    .clse-date { white-space: nowrap; }
    .pagination { display: flex; gap: 0.4rem; margin-top: 1rem; justify-content: center; flex-wrap: wrap; }
    .pagination a, .pagination span { padding: 0.3rem 0.7rem; border-radius: 4px; border: 1px solid #dee2e6; font-size: 13px; text-decoration: none; color: #212529; }
    .pagination a:hover { background: #e9ecef; }
    .pagination .active { background: #0d6efd; color: #fff; border-color: #0d6efd; }
    .no-results { text-align: center; padding: 3rem; color: #6c757d; }
    .label { font-size: 11px; color: #6c757d; margin-bottom: 2px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 대학 SW 용역 입찰공고</h1>
    <form method="GET" action="/">
      <input name="q" type="text" placeholder="공고명 검색" value="${escapeHtml(query.q)}" />
      <input name="dmnd" type="text" placeholder="수요기관" value="${escapeHtml(query.dmnd)}" />
      <input name="from" type="date" value="${escapeHtml(query.from)}" title="마감일 시작" />
      <input name="to" type="date" value="${escapeHtml(query.to)}" title="마감일 종료" />
      <button type="submit">검색</button>
      <a href="/" style="align-self:center;font-size:12px;color:#6c757d;text-decoration:none">초기화</a>
    </form>
    <div class="meta">총 ${result.total.toLocaleString("ko-KR")}건 · ${result.page}/${totalPages} 페이지</div>
    ${
      result.rows.length === 0
        ? '<div class="no-results">결과가 없습니다.</div>'
        : `<table>
      <thead>
        <tr>
          <th>공고명</th>
          <th>수요기관</th>
          <th>계약방법</th>
          <th>배정예산</th>
          <th>마감일시</th>
          <th>공고일</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${pagination}`
    }
  </div>
</body>
</html>`;
}

function renderRow(row: BidRow): string {
  return `<tr>
  <td class="title-cell">
    ${
      row.bid_ntce_url
        ? `<a href="${escapeHtml(row.bid_ntce_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.bid_ntce_nm ?? "-")}</a>`
        : escapeHtml(row.bid_ntce_nm ?? "-")
    }
    <div class="label">${escapeHtml(row.bidprc_psbl_indstryty_nm ?? "")}</div>
  </td>
  <td>${escapeHtml(row.dmnd_instt_nm ?? "-")}</td>
  <td>${escapeHtml(row.cntrct_cncls_mthd_nm ?? "-")}</td>
  <td class="amount">${formatAmount(row.asign_bdgt_amt)}</td>
  <td class="clse-date">${formatDate(row.bid_clse_date)}${row.bid_clse_tm ? ` ${row.bid_clse_tm.slice(0, 2)}:${row.bid_clse_tm.slice(2, 4)}` : ""}</td>
  <td class="clse-date">${formatDate(row.bid_ntce_date)}</td>
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
