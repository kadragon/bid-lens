import { Hono } from "hono";
import {
  addFilterRule,
  clearLoginFailures,
  countRecentFailures,
  deleteFilterRule,
  listFilterRules,
  pruneOldLoginAttempts,
  recordLoginAttempt,
  setFilterRuleEnabled,
} from "../db/repo";
import type { Env } from "../types";
import { renderAdminPage } from "./render-admin";

export const adminRouter = new Hono<{ Bindings: Env }>();

/** 브라우저가 admin_auth 쿠키 비교에 사용할 SHA-256 핑거프린트. */
export async function passwordFingerprint(password: string): Promise<string> {
  const data = new TextEncoder().encode(`bid-lens:admin:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/** XOR 상수 시간 비교 — 길이 및 내용 모두 체크. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  const aPad = new Uint8Array(maxLen);
  const bPad = new Uint8Array(maxLen);
  aPad.set(aBytes);
  bPad.set(bBytes);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) diff |= (aPad[i] ?? 0) ^ (bPad[i] ?? 0);
  return diff === 0;
}

const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES = 10;
const COOKIE_MAX_AGE = 86400; // 24h

/**
 * 모든 /admin* 요청에 적용.
 * - ADMIN_PASSWORD 미설정 → 503
 * - 비-GET: Origin host 검사 (CSRF 방어)
 * - Authorization 헤더 있을 때만 실패 카운트 (노 헤더 = 아직 미인증 브라우저)
 * - IP당 15분 내 10회 실패 → 429
 * - 성공 시: 실패 카운트 초기화 + admin_auth 쿠키 설정
 */
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

  const authHeader = c.req.header("Authorization");

  // Authorization 헤더 없음 → 챌린지만 반환, 실패 카운트 없음
  if (!authHeader) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="bid-lens admin"' },
    });
  }

  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";
  const now = Math.floor(Date.now() / 1000);
  const since = now - LOGIN_WINDOW_SECONDS;

  // 오래된 기록 기회 삭제 (관리자 접근 빈도 낮아 저비용)
  await pruneOldLoginAttempts(c.env.DB, since);

  const failures = await countRecentFailures(c.env.DB, ip, since);
  if (failures >= MAX_FAILURES) {
    return c.text("Too many failed login attempts. Try again later.", 429);
  }

  // Basic 자격증명 파싱
  let username = "";
  let password = "";
  if (authHeader.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice(6));
    const colon = decoded.indexOf(":");
    if (colon !== -1) {
      username = decoded.slice(0, colon);
      password = decoded.slice(colon + 1);
    }
  }

  const valid =
    timingSafeEqual(username, "admin") && timingSafeEqual(password, c.env.ADMIN_PASSWORD);

  if (!valid) {
    await recordLoginAttempt(c.env.DB, ip, false, now);
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="bid-lens admin"' },
    });
  }

  // 성공: 실패 카운트 초기화 + 쿠키 설정
  await clearLoginFailures(c.env.DB, ip);
  const fingerprint = await passwordFingerprint(c.env.ADMIN_PASSWORD);
  // 응답에 쿠키 첨부 (next() 결과를 가로채 헤더 추가)
  await next();
  c.header(
    "Set-Cookie",
    `admin_auth=${fingerprint}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
  );
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

  // Referer 가 같은 호스트면 되돌아가기 (주로 main-page X 버튼에서 호출)
  const referer = c.req.header("Referer");
  let redirectTo = "/admin";
  if (referer) {
    try {
      const refUrl = new URL(referer);
      const reqUrl = new URL(c.req.url);
      if (refUrl.host === reqUrl.host && !refUrl.pathname.startsWith("/admin")) {
        redirectTo = refUrl.pathname + refUrl.search;
      }
    } catch {
      /* referer 파싱 실패 → 기본 /admin */
    }
  }
  return c.redirect(redirectTo);
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
