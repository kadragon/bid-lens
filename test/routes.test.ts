import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { BidItem } from "../src/collector/types";
import { upsertBids } from "../src/db/repo";
import type { Env } from "../src/types";
import { webRouter } from "../src/web/routes";

function bid(over: Partial<BidItem> & Pick<BidItem, "bidNtceNo">): BidItem {
  return {
    bidNtceOrd: "00",
    bidNtceNm: "테스트 공고",
    bidNtceSttusNm: "공고중",
    bidNtceDate: "2026-05-27",
    bsnsDivNm: "용역",
    ntceInsttNm: "발주기관",
    dmndInsttNm: "테스트대학교",
    cntrctCnclsMthdNm: "일반경쟁",
    bidClseDate: "2099-12-31", // 미래 마감 → retention 필터 통과, from/to 동작만 격리
    bidClseTm: "0900",
    opengDate: "2099-12-31",
    opengTm: "1000",
    asignBdgtAmt: "100000000",
    presmptPrce: "90000000",
    bidprcPsblIndstrytyNm: "소프트웨어",
    bidNtceUrl: "https://example.com/1",
    ...over,
  };
}

const testEnv: Env = {
  DB: env.DB,
  OPEN_DATA_API_PROXY_URL: "",
  OPEN_DATA_X_API_KEY: "",
  ADMIN_PASSWORD: "", // routes 테스트는 admin auth 미사용 — 빈 값 (secret 스캐너 오탐 방지)
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM bids").run();
});

describe("GET /favicon.svg", () => {
  it("serves cacheable SVG favicon", async () => {
    const res = await webRouter.request("/favicon.svg", {}, testEnv);
    const svg = new TextDecoder().decode(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=604800");
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 32 32"');
  });

  it("redirects default favicon.ico request to SVG favicon", async () => {
    const res = await webRouter.request("/favicon.ico", {}, testEnv);

    expect(res.status).toBe(308);
    expect(res.headers.get("Location")).toBe("/favicon.svg");
  });
});

describe("GET / bid notice date from/to filter", () => {
  it("shows notices on or after from date", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "in", bidNtceNm: "범위내공고ABC", bidNtceDate: "2026-05-27" }),
      bid({ bidNtceNo: "out", bidNtceNm: "범위밖공고XYZ", bidNtceDate: "2026-05-20" }),
    ]);

    const res = await webRouter.request("/?from=2026-05-25", {}, testEnv);
    const html = await res.text();

    expect(html).toContain("범위내공고ABC");
    expect(html).not.toContain("범위밖공고XYZ");
  });

  it("shows notices on or before to date", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "in", bidNtceNm: "범위내공고ABC", bidNtceDate: "2026-05-20" }),
      bid({ bidNtceNo: "out", bidNtceNm: "범위밖공고XYZ", bidNtceDate: "2026-05-27" }),
    ]);

    const res = await webRouter.request("/?to=2026-05-25", {}, testEnv);
    const html = await res.text();

    expect(html).toContain("범위내공고ABC");
    expect(html).not.toContain("범위밖공고XYZ");
  });
});

// Route-level guard: the includeClosed wiring is what commit 704eada silently deleted.
// repo.test.ts covers the SQL and render.test.ts the markup — only these assert that the
// query param actually reaches searchBids, so a repeat deletion cannot pass a green suite.
describe("includeClosed query param wiring", () => {
  async function seedCancelled() {
    await upsertBids(env.DB, [
      bid({
        bidNtceNo: "cancelled",
        bidNtceNm: "취소공고ABC",
        bidNtceSttusNm: "취소",
        bidClseDate: "2099-12-31",
      }),
      bid({
        bidNtceNo: "open",
        bidNtceNm: "정상공고XYZ",
        bidNtceSttusNm: "공고중",
        bidClseDate: "2099-12-31",
      }),
    ]);
  }

  it("omits closed notices from /api/bids by default", async () => {
    await seedCancelled();

    const res = await webRouter.request("/api/bids", {}, testEnv);
    const body = (await res.json()) as { rows: { bid_ntce_no: string }[]; total: number };

    expect(body.rows.map((r) => r.bid_ntce_no)).toEqual(["open"]);
    expect(body.total).toBe(1);
  });

  it.each(["1", "true"])("includes closed notices when includeClosed=%s", async (value) => {
    await seedCancelled();

    const res = await webRouter.request(`/api/bids?includeClosed=${value}`, {}, testEnv);
    const body = (await res.json()) as { rows: { bid_ntce_no: string }[]; total: number };

    expect(body.rows.map((r) => r.bid_ntce_no).sort()).toEqual(["cancelled", "open"]);
    expect(body.total).toBe(2);
  });

  it("passes includeClosed through GET / to the rendered page", async () => {
    await seedCancelled();

    const def = await (await webRouter.request("/", {}, testEnv)).text();
    const inc = await (await webRouter.request("/?includeClosed=1", {}, testEnv)).text();

    expect(def).not.toContain("취소공고ABC");
    expect(def).toContain("정상공고XYZ");
    expect(inc).toContain("취소공고ABC");
    expect(inc).toContain('name="includeClosed" value="1" checked');
  });
});
