import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { addFilterRule, deleteFilterRule, listFilterRules, setFilterRuleEnabled } from "../db/repo";
import type { Env } from "../types";
import { renderAdminPage } from "./render-admin";

export const adminRouter = new Hono<{ Bindings: Env }>();

// 모든 /admin* (GET 페이지 + POST 변경) Basic Auth 게이트. 비밀번호 미설정 시 fail-closed.
// CSRF 방어는 Origin host 검사가 담당 (Basic Auth 자격증명은 브라우저가 캐시해 자동 첨부될 수 있어
// 단독으로는 CSRF 미방어). 변경(non-GET) 요청에서 Origin 있고 host 불일치/파싱불가 → 403.
// Origin 없는 변경 요청은 통과: 비브라우저 클라이언트엔 ambient credential 없고, 브라우저는 POST에 항상 Origin 첨부.
adminRouter.use("*", async (c, next) => {
  if (!c.env.ADMIN_PASSWORD) return c.text("admin password not configured", 503);

  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const origin = c.req.header("Origin");
    if (origin) {
      let reqHost: string;
      try {
        reqHost = new URL(c.req.url).host;
      } catch {
        return c.text("forbidden", 403);
      }
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = "";
      }
      if (originHost !== reqHost) return c.text("forbidden", 403);
    }
  }

  return basicAuth({ username: "admin", password: c.env.ADMIN_PASSWORD })(c, next);
});

adminRouter.get("/", async (c) => {
  const rules = await listFilterRules(c.env.DB);
  return c.html(renderAdminPage(rules));
});

adminRouter.post("/rules", async (c) => {
  const body = await c.req.parseBody();
  const ruleType = typeof body.rule_type === "string" ? body.rule_type : "";
  const pattern = typeof body.pattern === "string" ? body.pattern : "";
  try {
    await addFilterRule(c.env.DB, ruleType, pattern);
  } catch (err) {
    return c.text(err instanceof Error ? err.message : "invalid input", 400);
  }
  return c.redirect("/admin");
});

adminRouter.post("/rules/:id/delete", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.text("invalid id", 400);
  await deleteFilterRule(c.env.DB, id);
  return c.redirect("/admin");
});

adminRouter.post("/rules/:id/toggle", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.text("invalid id", 400);
  const body = await c.req.parseBody();
  const enabled = body.enabled === "1";
  await setFilterRuleEnabled(c.env.DB, id, enabled);
  return c.redirect("/admin");
});
