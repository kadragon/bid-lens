import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "../src/collector/filter";
import { getFilterRules, listFilterRules } from "../src/db/repo";

// 0002 마이그레이션 시드가 DEFAULT_RULES 와 동기인지 검증 (드리프트 방지).
// repo.test.ts CRUD describe 의 destructive beforeEach(DELETE filter_rules)와 격리하려고 별도 파일 —
// 테스트 실행 순서에 의존하지 않음.
// 핵심: 비어있음 가드. filter_rules 가 비면 getFilterRules 가 DEFAULT 폴백을 반환해 시드 부재를
// 가려버린다 → 행 존재를 먼저 단언해야 시드를 실제로 검증하는 의미 있는 테스트가 됨.
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("filter_rules seed integrity", () => {
  it("0002 seed has active rows matching DEFAULT_RULES", async () => {
    const rows = await listFilterRules(env.DB);
    expect(rows.length).toBeGreaterThan(0); // 시드 존재 — 폴백 마스킹 차단
    expect(rows.every((r) => r.enabled === 1)).toBe(true); // 시드 행 활성
    expect(await getFilterRules(env.DB)).toEqual(DEFAULT_RULES);
  });
});
