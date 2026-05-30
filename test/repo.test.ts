import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "../src/collector/filter";
import type { BidItem } from "../src/collector/types";
import {
  addFilterRule,
  deleteFilterRule,
  getFilterRules,
  listFilterRules,
  searchBids,
  setFilterRuleEnabled,
  upsertBids,
} from "../src/db/repo";

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

describe("searchBids close-date handling", () => {
  it("keeps closed bids in default results", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "past", bidClseDate: "2026-05-28" }),
      bid({ bidNtceNo: "today", bidClseDate: "2026-05-29" }),
      bid({ bidNtceNo: "future", bidClseDate: "2026-06-01" }),
      bid({ bidNtceNo: "empty", bidClseDate: "" }),
    ]);

    const res = await searchBids(env.DB, {});
    const nos = res.rows.map((r) => r.bid_ntce_no).sort();

    expect(nos).toEqual(["empty", "future", "past", "today"]);
    expect(res.total).toBe(4);
  });

  it("combines q with closed bids still visible", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "a", bidNtceNm: "AI 플랫폼 구축", bidClseDate: "2026-05-28" }),
      bid({ bidNtceNo: "b", bidNtceNm: "AI 플랫폼 운영", bidClseDate: "2026-06-01" }),
      bid({ bidNtceNo: "c", bidNtceNm: "포털 구축", bidClseDate: "2026-06-01" }), // q 불일치
    ]);

    const res = await searchBids(env.DB, { q: "플랫폼" });
    const nos = res.rows.map((r) => r.bid_ntce_no).sort();

    expect(nos).toEqual(["a", "b"]);
  });
});

describe("searchBids LIKE escaping", () => {
  it("matches q percent literally", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "lit", bidNtceNm: "할인 50% 행사" }),
      bid({ bidNtceNo: "other", bidNtceNm: "할인 5000원 행사" }),
    ]);

    const res = await searchBids(env.DB, { q: "50%" });

    expect(res.rows.map((r) => r.bid_ntce_no)).toEqual(["lit"]);
    expect(res.total).toBe(1);
  });

  it("matches dmnd underscore literally", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "u", dmndInsttNm: "A_대학교" }),
      bid({ bidNtceNo: "v", dmndInsttNm: "AX대학교" }),
    ]);

    const res = await searchBids(env.DB, { dmnd: "A_대" });

    expect(res.rows.map((r) => r.bid_ntce_no)).toEqual(["u"]);
  });

  // 백슬래시(ESCAPE 문자 자체) 분기 고정. 미이스케이프 시 `\B` → 이스케이프된 리터럴 B 로 읽혀
  // 패턴이 깨지고 0건 반환 → 이 케이스가 escapeLike 의 백슬래시 분기를 pin.
  it("matches q backslash literally", async () => {
    await upsertBids(env.DB, [
      bid({ bidNtceNo: "bs", bidNtceNm: "A\\B 프로젝트" }),
      bid({ bidNtceNo: "plain", bidNtceNm: "AXB 프로젝트" }),
    ]);

    const res = await searchBids(env.DB, { q: "A\\B" });

    expect(res.rows.map((r) => r.bid_ntce_no)).toEqual(["bs"]);
  });
});

// filter_rules 시드 무결성 → test/seed.test.ts (order-independent, 폴백 마스킹 차단).

describe("filter_rules CRUD", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM filter_rules").run();
  });

  it("falls back with no active rules", async () => {
    expect(await getFilterRules(env.DB)).toEqual(DEFAULT_RULES);
  });

  it("groups added rules by type", async () => {
    await addFilterRule(env.DB, "dmnd_include", "대학");
    await addFilterRule(env.DB, "industry_include", "소프트웨어");
    await addFilterRule(env.DB, "industry_include", "컴퓨터");

    const r = await getFilterRules(env.DB);
    expect(r.dmndInclude).toEqual(["대학"]);
    expect(r.industryInclude).toEqual(["소프트웨어", "컴퓨터"]);
    expect(r.dmndExclude).toEqual([]);
  });

  it("omits disabled rules", async () => {
    await addFilterRule(env.DB, "dmnd_include", "대학");
    await addFilterRule(env.DB, "dmnd_exclude", "병원");

    const rows = await listFilterRules(env.DB);
    const target = rows.find((x) => x.rule_type === "dmnd_exclude");
    expect(target).toBeDefined();
    if (!target) return;
    await setFilterRuleEnabled(env.DB, target.id, false);

    const r = await getFilterRules(env.DB);
    expect(r.dmndInclude).toEqual(["대학"]);
    expect(r.dmndExclude).toEqual([]);
  });

  it("falls back when all rules disabled", async () => {
    await addFilterRule(env.DB, "dmnd_include", "대학");
    const rows = await listFilterRules(env.DB);
    const first = rows.find((x) => x.rule_type === "dmnd_include");
    expect(first).toBeDefined();
    if (!first) return;
    await setFilterRuleEnabled(env.DB, first.id, false);

    expect(await getFilterRules(env.DB)).toEqual(DEFAULT_RULES);
  });

  it("deletes rules", async () => {
    await addFilterRule(env.DB, "name_exclude", "유지보수");
    const rows = await listFilterRules(env.DB);
    const target = rows.find((x) => x.rule_type === "name_exclude");
    expect(target).toBeDefined();
    if (!target) return;
    await deleteFilterRule(env.DB, target.id);

    expect(await listFilterRules(env.DB)).toHaveLength(0);
  });

  it("rejects invalid rule_type", async () => {
    await expect(addFilterRule(env.DB, "bogus_type", "x")).rejects.toThrow();
  });

  it("rejects blank pattern", async () => {
    await expect(addFilterRule(env.DB, "dmnd_include", "   ")).rejects.toThrow();
  });

  it("keeps duplicate rule unique", async () => {
    await addFilterRule(env.DB, "dmnd_include", "대학");
    await addFilterRule(env.DB, "dmnd_include", "대학");
    const matches = (await listFilterRules(env.DB)).filter(
      (r) => r.rule_type === "dmnd_include" && r.pattern === "대학",
    );
    expect(matches).toHaveLength(1);
  });

  it("reactivates duplicate disabled rule", async () => {
    await addFilterRule(env.DB, "dmnd_include", "대학"); // 활성 규칙 — DEFAULT 폴백 방지
    await addFilterRule(env.DB, "name_exclude", "유지보수");
    const target = (await listFilterRules(env.DB)).find((r) => r.pattern === "유지보수");
    expect(target).toBeDefined();
    if (!target) return;
    await setFilterRuleEnabled(env.DB, target.id, false);
    expect((await getFilterRules(env.DB)).nameExclude).not.toContain("유지보수");

    await addFilterRule(env.DB, "name_exclude", "유지보수");
    expect((await getFilterRules(env.DB)).nameExclude).toContain("유지보수");
  });
});
