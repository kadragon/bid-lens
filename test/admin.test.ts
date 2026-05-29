import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getFilterRules } from "../src/db/repo";
import type { Env } from "../src/types";
import { adminRouter } from "../src/web/admin";
import { renderAdminPage } from "../src/web/render-admin";

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

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM login_attempts").run();
});

describe("admin auth", () => {
  it("includes SVG favicon link in head", () => {
    const html = renderAdminPage([]);

    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
  });

  it("returns 401 for GET /admin without auth header", async () => {
    const res = await adminRouter.request("/", {}, testEnv);
    expect(res.status).toBe(401);
  });

  it("renders page for GET /admin with valid creds", async () => {
    const res = await adminRouter.request("/", { headers: { Authorization: AUTH } }, testEnv);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("수집 필터 규칙");
  });

  it("returns 401 for POST /rules with invalid creds", async () => {
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

  it("returns 503 when ADMIN_PASSWORD is unset", async () => {
    const res = await adminRouter.request("/", {}, { ...testEnv, ADMIN_PASSWORD: "" });
    expect(res.status).toBe(503);
  });
});

describe("admin rule mutations", () => {
  it("POST /rules redirects and updates getFilterRules", async () => {
    const res = await adminRouter.request(
      "/rules",
      form({ rule_type: "name_exclude", pattern: "테스트제외" }),
      testEnv,
    );
    expect(res.status).toBe(302);

    const rules = await getFilterRules(env.DB);
    expect(rules.nameExclude).toContain("테스트제외");
  });

  it("returns 400 for POST /rules with invalid rule_type", async () => {
    const res = await adminRouter.request(
      "/rules",
      form({ rule_type: "bogus", pattern: "x" }),
      testEnv,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-positive rule id", async () => {
    const res = await adminRouter.request("/rules/0/delete", form({}), testEnv);
    expect(res.status).toBe(400);
  });

  it("redirects for missing id delete as idempotent no-op", async () => {
    const res = await adminRouter.request("/rules/999999/delete", form({}), testEnv);
    expect(res.status).toBe(302);
  });

  it("POST /rules/:id/delete redirects and removes rule", async () => {
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

  it("POST /rules/:id/toggle supports off then on", async () => {
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

  it("sets admin_auth cookie on successful login", async () => {
    const res = await adminRouter.request("/", { headers: { Authorization: AUTH } }, testEnv);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toMatch(/admin_auth=/);
  });

  it("blocks access after MAX_FAILURES wrong-credential attempts from same IP", async () => {
    const failAuth = `Basic ${btoa("admin:wrong")}`;
    for (let i = 0; i < 10; i++) {
      await adminRouter.request(
        "/",
        { headers: { Authorization: failAuth, "CF-Connecting-IP": "1.2.3.4" } },
        testEnv,
      );
    }
    const res = await adminRouter.request(
      "/",
      { headers: { Authorization: AUTH, "CF-Connecting-IP": "1.2.3.4" } },
      testEnv,
    );
    expect(res.status).toBe(429);
  });

  it("does not count missing auth header as a failure", async () => {
    for (let i = 0; i < 10; i++) {
      await adminRouter.request("/", { headers: { "CF-Connecting-IP": "2.3.4.5" } }, testEnv);
    }
    const res = await adminRouter.request(
      "/",
      { headers: { "CF-Connecting-IP": "2.3.4.5" } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("different IPs have independent failure counters", async () => {
    const failAuth = `Basic ${btoa("admin:wrong")}`;
    for (let i = 0; i < 10; i++) {
      await adminRouter.request(
        "/",
        { headers: { Authorization: failAuth, "CF-Connecting-IP": "3.3.3.3" } },
        testEnv,
      );
    }
    const res = await adminRouter.request(
      "/",
      { headers: { Authorization: AUTH, "CF-Connecting-IP": "4.4.4.4" } },
      testEnv,
    );
    expect(res.status).toBe(200);
  });

  it("blocks cross-origin POST and allows same-origin POST", async () => {
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
