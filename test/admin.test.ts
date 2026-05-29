import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getFilterRules } from "../src/db/repo";
import type { Env } from "../src/types";
import { adminRouter } from "../src/web/admin";

const PW = "test-pw";
const AUTH = `Basic ${btoa(`admin:${PW}`)}`;

const testEnv: Env = {
  DB: env.DB,
  OPEN_DATA_API_PROXY_URL: "",
  OPEN_DATA_X_API_KEY: "",
  ADMIN_PASSWORD: PW,
};

function form(data: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data).toString(),
  };
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM filter_rules").run();
});

describe("어드민 인증", () => {
  it("인증 헤더 없이 GET /admin → 401", async () => {
    const res = await adminRouter.request("/", {}, testEnv);
    expect(res.status).toBe(401);
  });

  it("올바른 creds GET /admin → 200, 페이지 렌더", async () => {
    const res = await adminRouter.request("/", { headers: { Authorization: AUTH } }, testEnv);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("수집 필터 규칙");
  });

  it("잘못된 creds로 POST /rules → 401 (변경 라우트도 게이트)", async () => {
    const res = await adminRouter.request(
      "/rules",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa("admin:wrong")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ rule_type: "dmnd_include", pattern: "x" }).toString(),
      },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("ADMIN_PASSWORD 미설정 → 503 (fail-closed)", async () => {
    const res = await adminRouter.request("/", {}, { ...testEnv, ADMIN_PASSWORD: "" });
    expect(res.status).toBe(503);
  });
});

describe("어드민 규칙 변경", () => {
  it("POST /rules → 302, getFilterRules 에 반영", async () => {
    const res = await adminRouter.request(
      "/rules",
      form({ rule_type: "name_exclude", pattern: "테스트제외" }),
      testEnv,
    );
    expect(res.status).toBe(302);

    const rules = await getFilterRules(env.DB);
    expect(rules.nameExclude).toContain("테스트제외");
  });

  it("POST /rules 잘못된 rule_type → 400", async () => {
    const res = await adminRouter.request(
      "/rules",
      form({ rule_type: "bogus", pattern: "x" }),
      testEnv,
    );
    expect(res.status).toBe(400);
  });

  it("id <= 0 (예: /rules/0/delete) → 400", async () => {
    const res = await adminRouter.request("/rules/0/delete", form({}), testEnv);
    expect(res.status).toBe(400);
  });

  it("존재하지 않는 id delete → 302 (멱등 — no-op)", async () => {
    const res = await adminRouter.request("/rules/999999/delete", form({}), testEnv);
    expect(res.status).toBe(302);
  });

  it("POST /rules/:id/delete → 302, 제거", async () => {
    await adminRouter.request(
      "/rules",
      form({ rule_type: "dmnd_exclude", pattern: "삭제대상" }),
      testEnv,
    );
    const before = await getFilterRules(env.DB);
    expect(before.dmndExclude).toContain("삭제대상");

    const row = await env.DB.prepare(
      "SELECT id FROM filter_rules WHERE pattern = '삭제대상'",
    ).first<{
      id: number;
    }>();
    expect(row).not.toBeNull();
    if (!row) return;

    const res = await adminRouter.request(`/rules/${row.id}/delete`, form({}), testEnv);
    expect(res.status).toBe(302);

    const after = await getFilterRules(env.DB);
    expect(after.dmndExclude).not.toContain("삭제대상");
  });

  it("POST /rules/:id/toggle off→on 왕복 (enabled=0 후 enabled=1)", async () => {
    await adminRouter.request(
      "/rules",
      form({ rule_type: "dmnd_include", pattern: "대학" }),
      testEnv,
    );
    await adminRouter.request(
      "/rules",
      form({ rule_type: "dmnd_exclude", pattern: "병원" }),
      testEnv,
    );
    const row = await env.DB.prepare("SELECT id FROM filter_rules WHERE pattern = '병원'").first<{
      id: number;
    }>();
    expect(row).not.toBeNull();
    if (!row) return;

    // off
    const off = await adminRouter.request(
      `/rules/${row.id}/toggle`,
      form({ enabled: "0" }),
      testEnv,
    );
    expect(off.status).toBe(302);
    const afterOff = await getFilterRules(env.DB);
    expect(afterOff.dmndInclude).toContain("대학");
    expect(afterOff.dmndExclude).not.toContain("병원");

    // on (재활성 경로 — enabled=1 / setFilterRuleEnabled true 브랜치 커버)
    const on = await adminRouter.request(
      `/rules/${row.id}/toggle`,
      form({ enabled: "1" }),
      testEnv,
    );
    expect(on.status).toBe(302);
    const afterOn = await getFilterRules(env.DB);
    expect(afterOn.dmndExclude).toContain("병원");
  });

  it("교차 출처 POST → 403 (CSRF 차단), 동일 출처는 통과", async () => {
    const csrf = await adminRouter.request(
      "/rules",
      {
        method: "POST",
        headers: {
          Authorization: AUTH,
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://evil.example",
        },
        body: new URLSearchParams({ rule_type: "name_exclude", pattern: "공격" }).toString(),
      },
      testEnv,
    );
    expect(csrf.status).toBe(403);
    expect((await getFilterRules(env.DB)).nameExclude).not.toContain("공격");

    const same = await adminRouter.request(
      "/rules",
      {
        method: "POST",
        headers: {
          Authorization: AUTH,
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "http://localhost",
        },
        body: new URLSearchParams({ rule_type: "name_exclude", pattern: "정상" }).toString(),
      },
      testEnv,
    );
    expect(same.status).toBe(302);
    expect((await getFilterRules(env.DB)).nameExclude).toContain("정상");
  });
});
