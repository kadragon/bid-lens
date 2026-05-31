import { describe, expect, it } from "vitest";
import type { BidRow, SearchResult } from "../src/db/repo";
import {
  contractMethodClass,
  formatAmount,
  formatDate,
  renderPage,
  renderStatusBadge,
} from "../src/web/render";

function row(over: Partial<BidRow> & Pick<BidRow, "bid_ntce_no">): BidRow {
  return {
    bid_ntce_ord: "00",
    bid_ntce_nm: "테스트 공고",
    bid_ntce_sttus_nm: "공고중",
    bid_ntce_date: "2026-05-01",
    bsns_div_nm: "용역",
    ntce_instt_nm: "발주기관",
    dmnd_instt_nm: "테스트대학교",
    cntrct_cncls_mthd_nm: "일반경쟁",
    bid_clse_date: "2026-12-31",
    bid_clse_tm: "0900",
    openg_date: "202612311000",
    openg_tm: "1000",
    asign_bdgt_amt: 100000000,
    presmpt_prce: 90000000,
    bidprc_psbl_indstryty_nm: "소프트웨어",
    bid_ntce_url: "https://example.com/1",
    proposal_request_file_nm: null,
    proposal_request_url: null,
    collected_at: "2026-05-29T00:00:00Z",
    ...over,
  };
}

const baseQuery = { q: "", dmnd: "", from: "", to: "", page: 1 };

describe("formatAmount", () => {
  it("formats null", () => {
    expect(formatAmount(null)).toBe("미정");
  });

  it("formats zero", () => {
    expect(formatAmount(0)).toBe("0.0억원");
  });

  it("formats 1.9e8", () => {
    expect(formatAmount(190000000)).toBe("1.9억원");
  });

  it("formats 0.5e8", () => {
    expect(formatAmount(50000000)).toBe("0.5억원");
  });

  it("rounds to one decimal", () => {
    expect(formatAmount(123456789)).toBe("1.2억원");
  });
});

describe("formatDate", () => {
  it("formats null", () => {
    expect(formatDate(null)).toBe("-");
  });

  it("formats YYYYMMDDHHMM", () => {
    expect(formatDate("202501010900")).toBe("2025-01-01 09:00");
  });

  it("formats YYYYMMDD", () => {
    expect(formatDate("20250101")).toBe("2025-01-01");
  });

  it("formats dashed date", () => {
    expect(formatDate("2026-05-29")).toBe("2026-05-29");
  });

  it("formats dashed datetime", () => {
    expect(formatDate("2026-05-29 09:00:00")).toBe("2026-05-29 09:00");
  });

  it("formats non-date input", () => {
    expect(formatDate("--")).toBe("-");
  });

  it("keeps short digits", () => {
    expect(formatDate("2025")).toBe("2025");
  });

  it("keeps partial date", () => {
    expect(formatDate("2025-05")).toBe("2025-05");
  });
});

describe("renderStatusBadge", () => {
  it("renders null as empty", () => {
    expect(renderStatusBadge(null)).toBe("");
  });

  it("renders empty as empty", () => {
    expect(renderStatusBadge("")).toBe("");
  });

  it("renders closed statuses", () => {
    for (const status of ["마감", "취소", "종료", "개찰"]) {
      expect(renderStatusBadge(status)).toContain("badge-closed");
    }
  });

  it("renders open statuses", () => {
    for (const status of ["공고중", "진행"]) {
      expect(renderStatusBadge(status)).toContain("badge-open");
    }
  });

  it("keeps stopped notice as default", () => {
    const html = renderStatusBadge("공고중지");
    expect(html).toContain("badge-default");
    expect(html).not.toContain("badge-open");
  });

  it("escapes status text", () => {
    expect(renderStatusBadge("<마감>")).toContain("&lt;마감&gt;");
  });
});

describe("contractMethodClass", () => {
  it("maps general competition", () => {
    expect(contractMethodClass("일반경쟁")).toBe("method-general");
  });

  it("maps limited competition", () => {
    expect(contractMethodClass("제한경쟁")).toBe("method-limited");
  });

  it("maps unknown method", () => {
    expect(contractMethodClass("수의계약")).toBe("method-default");
  });

  it("maps null method", () => {
    expect(contractMethodClass(null)).toBe("method-default");
  });
});

describe("renderPage search form", () => {
  it("links SVG favicon", () => {
    const result: SearchResult = { rows: [], total: 0, page: 1, pageSize: 20 };
    const html = renderPage(result, baseQuery);

    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
  });

  it("does not render closed filter controls", () => {
    const result: SearchResult = { rows: [], total: 0, page: 1, pageSize: 20 };
    const html = renderPage(result, baseQuery);

    expect(html).not.toContain("마감 포함");
    expect(html).not.toContain('name="includeClosed"');
  });

  it("does not preserve closed filter in pagination", () => {
    const result: SearchResult = {
      rows: [row({ bid_ntce_no: "a" })],
      total: 50,
      page: 1,
      pageSize: 20,
    };
    const html = renderPage(result, baseQuery);

    expect(html).not.toContain("includeClosed=1");
  });

  it("renders proposal request link column", () => {
    const result: SearchResult = {
      rows: [
        row({
          bid_ntce_no: "rfp",
          proposal_request_file_nm: "기술제안서.hwp",
          proposal_request_url: "https://example.com/rfp",
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    const html = renderPage(result, baseQuery);

    expect(html).toContain("<th>제안</th>");
    expect(html).toContain(
      '<a class="proposal-link" href="https://example.com/rfp" target="_blank" rel="noopener noreferrer" title="기술제안서.hwp">보기</a>',
    );
  });
});

describe("renderPage history badge and expired status", () => {
  const baseQueryWithToday = { ...baseQuery, today: "2026-05-29" };

  it("renders history badges for older ords", () => {
    const result: SearchResult = {
      rows: [
        row({
          bid_ntce_no: "123",
          bid_ntce_ord: "02",
          bid_ntce_nm: "AI 플랫폼 구축",
          history_ords: "00,01,02",
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    const html = renderPage(result, baseQueryWithToday);
    expect(html).toContain("00차");
    expect(html).toContain("01차");
  });

  it("forces closed badge when bid_clse_date is in the past", () => {
    const result: SearchResult = {
      rows: [
        row({
          bid_ntce_no: "exp",
          bid_ntce_sttus_nm: "공고중",
          bid_clse_date: "2026-05-28",
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    const html = renderPage(result, baseQueryWithToday);

    expect(html).toContain("badge-closed");
    expect(html).toContain("마감");
    expect(html).not.toContain('class="badge badge-open"');
  });
});
