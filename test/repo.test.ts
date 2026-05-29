import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { BidItem } from "../src/collector/types";
import { searchBids, upsertBids } from "../src/db/repo";

const TODAY = "2026-05-29";

function bid(over: Partial<BidItem> & Pick<BidItem, "bidNtceNo">): BidItem {
  return {
    bidNtceOrd: "00",
    bidNtceNm: "테스트 공고",
    bidNtceSttusNm: "공고중",
    bidNtceDate: "2026-05-01",
    bsnsDivNm: "용역",
    ntceInsttNm: "발주기관",
    dmndInsttNm: "테스트대학교",
    cntrctCnclsMthdNm: "일반경쟁",
    bidClseDate: "2026-12-31",
    bidClseTm: "0900",
    opengDate: "202612311000",
    opengTm: "1000",
    asignBdgtAmt: "100000000",
    presmptPrce: "90000000",
    bidprcPsblIndstrytyNm: "소프트웨어",
    bidNtceUrl: "https://example.com/1",
    ...over,
  };
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM bids").run();
});

describe("searchBids 마감 필터 (보존 정책)", () => {
  it("기본: 마감 지난 공고 제외, 미마감·당일·빈값 포함", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "past", bidClseDate: "2026-05-28" }), // 어제 마감 → 제외
      bid({ bidNtceNo: "today", bidClseDate: "2026-05-29" }), // 당일 마감 → 포함
      bid({ bidNtceNo: "future", bidClseDate: "2026-06-01" }), // 미래 → 포함
      bid({ bidNtceNo: "empty", bidClseDate: "" }), // 빈값 → 포함 (정보 없음, 숨기지 않음)
    ]);

    const res = await searchBids(env.DB, { today: TODAY });
    const nos = res.rows.map((r) => r.bid_ntce_no).sort();

    expect(nos).toEqual(["empty", "future", "today"]);
    expect(res.total).toBe(3);
  });

  it("includeClosed=true: 마감 포함 전체 반환", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "past", bidClseDate: "2026-05-28" }),
      bid({ bidNtceNo: "future", bidClseDate: "2026-06-01" }),
    ]);

    const res = await searchBids(env.DB, { today: TODAY, includeClosed: true });

    expect(res.total).toBe(2);
  });

  it("today 미지정 시 필터 미적용 (전체 반환)", async () => {
    await upsertBids(env.DB, [bid({ bidNtceNo: "past", bidClseDate: "2026-05-28" })]);

    const res = await searchBids(env.DB, {});

    expect(res.total).toBe(1);
  });

  it("마감 필터는 q·dmnd 조건과 AND 결합", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "a", bidNtceNm: "AI 플랫폼 구축", bidClseDate: "2026-05-28" }), // 마감 → 제외
      bid({ bidNtceNo: "b", bidNtceNm: "AI 플랫폼 운영", bidClseDate: "2026-06-01" }), // 미래 → 포함
      bid({ bidNtceNo: "c", bidNtceNm: "포털 구축", bidClseDate: "2026-06-01" }), // q 불일치
    ]);

    const res = await searchBids(env.DB, { today: TODAY, q: "플랫폼" });
    const nos = res.rows.map((r) => r.bid_ntce_no);

    expect(nos).toEqual(["b"]);
  });
});
