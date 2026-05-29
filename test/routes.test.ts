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
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM bids").run();
});

describe("GET / 공고일 from/to 필터 (저장 포맷 YYYY-MM-DD)", () => {
  it("from 이상 공고만 노출 — 대시 포맷 그대로 비교", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "in", bidNtceNm: "범위내공고ABC", bidNtceDate: "2026-05-27" }),
      bid({ bidNtceNo: "out", bidNtceNm: "범위밖공고XYZ", bidNtceDate: "2026-05-20" }),
    ]);

    const res = await webRouter.request("/?from=2026-05-25", {}, testEnv);
    const html = await res.text();

    expect(html).toContain("범위내공고ABC");
    expect(html).not.toContain("범위밖공고XYZ");
  });

  it("to 이하 공고만 노출", async () => {
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
