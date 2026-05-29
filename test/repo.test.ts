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

describe("filter_rules 시드 무결성", () => {
  // 0002 마이그레이션 시드가 DEFAULT_RULES 와 동기인지 검증 (드리프트 방지).
  // CRUD describe 의 destructive beforeEach 가 시드를 지우기 전에 실행되어야 함.
  it("마이그레이션 시드 → getFilterRules 가 DEFAULT_RULES 와 동일", async () => {
    expect(await getFilterRules(env.DB)).toEqual(DEFAULT_RULES);
  });
});

describe("filter_rules CRUD", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM filter_rules").run();
  });

  it("활성 규칙 0건 → getFilterRules 가 DEFAULT_RULES 폴백", async () => {
    expect(await getFilterRules(env.DB)).toEqual(DEFAULT_RULES);
  });

  it("add → getFilterRules 에 rule_type별 그룹핑 반영", async () => {
    await addFilterRule(env.DB, "dmnd_include", "대학");
    await addFilterRule(env.DB, "industry_include", "소프트웨어");
    await addFilterRule(env.DB, "industry_include", "컴퓨터");

    const r = await getFilterRules(env.DB);
    expect(r.dmndInclude).toEqual(["대학"]);
    expect(r.industryInclude).toEqual(["소프트웨어", "컴퓨터"]);
    expect(r.dmndExclude).toEqual([]);
  });

  it("enabled=0 규칙은 그룹에서 빠짐 (다른 활성 규칙 있으면 폴백 안 함)", async () => {
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

  it("모든 규칙 비활성 → DEFAULT_RULES 폴백", async () => {
    await addFilterRule(env.DB, "dmnd_include", "대학");
    const rows = await listFilterRules(env.DB);
    const first = rows.find((x) => x.rule_type === "dmnd_include");
    expect(first).toBeDefined();
    if (!first) return;
    await setFilterRuleEnabled(env.DB, first.id, false);

    expect(await getFilterRules(env.DB)).toEqual(DEFAULT_RULES);
  });

  it("delete → listFilterRules 에서 제거", async () => {
    await addFilterRule(env.DB, "name_exclude", "유지보수");
    const rows = await listFilterRules(env.DB);
    const target = rows.find((x) => x.rule_type === "name_exclude");
    expect(target).toBeDefined();
    if (!target) return;
    await deleteFilterRule(env.DB, target.id);

    expect(await listFilterRules(env.DB)).toHaveLength(0);
  });

  it("잘못된 rule_type → 거부", async () => {
    await expect(addFilterRule(env.DB, "bogus_type", "x")).rejects.toThrow();
  });

  it("빈/공백 pattern → 거부", async () => {
    await expect(addFilterRule(env.DB, "dmnd_include", "   ")).rejects.toThrow();
  });

  it("중복 (rule_type, pattern) add → 행 1개만 (UNIQUE)", async () => {
    await addFilterRule(env.DB, "dmnd_include", "대학");
    await addFilterRule(env.DB, "dmnd_include", "대학");
    const matches = (await listFilterRules(env.DB)).filter(
      (r) => r.rule_type === "dmnd_include" && r.pattern === "대학",
    );
    expect(matches).toHaveLength(1);
  });

  it("비활성 패턴 재add → 재활성화 (ON CONFLICT DO UPDATE enabled=1)", async () => {
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
