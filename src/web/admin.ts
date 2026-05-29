import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
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

// 같은 isolate 내 재사용 — 비밀번호 변경 시 자동 무효 (키가 다르면 캐시 미스)
let _fpCache: string | undefined;
let _fpCacheKey: string | undefined;

/** 브라우저가 admin_auth 쿠키 비교에 사용할 SHA-256 핑거프린트 (44자 고정 base64). */
export async function passwordFingerprint(password: string): Promise<string> {
  if (_fpCache !== undefined && _fpCacheKey === password) return _fpCache;
  const data = new TextEncoder().encode(`bid-lens:admin:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const result = btoa(String.fromCharCode(...new Uint8Array(hash)));
  _fpCache = result;
  _fpCacheKey = password;
  return result;
}

/**
 * XOR 상수 시간 비교 — 동일 길이 입력(44자 핑거프린트)에서 완전 상수 시간.
 * 길이 다른 입력도 안전: length XOR 가 diff 에 누적되어 false 반환.
 */
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

const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  maxAge: COOKIE_MAX_AGE,
} as const;

/**
 * 모든 /admin* 요청 게이트.
 *
 * 1. ADMIN_PASSWORD 미설정 → 503
 * 2. 비-GET: Origin host 검사 (CSRF)
 * 3. 쿠키 패스트패스: admin_auth 유효 → 쿠키 갱신 후 next()
 * 4. Authorization 헤더 없음 → 401 챌린지 (실패 카운트 없음)
 * 5. IP 레이트리밋: 15분 내 10회 실패 → 429
 * 6. Basic 자격증명 파싱 (malformed → 401 + 카운트)
 * 7. 핑거프린트 비교 (고정 44자 → 상수 시간)
 * 8. 실패 → 401 + 기록 / 성공 → 카운트 초기화 + 쿠키 설정 + next()
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

  const expectedFp = await passwordFingerprint(c.env.ADMIN_PASSWORD);

  // 쿠키 패스트패스 — DB 쿼리 없이 인증 완료
  const cookieVal = getCookie(c, "admin_auth");
  if (cookieVal && timingSafeEqual(cookieVal, expectedFp)) {
    setCookie(c, "admin_auth", expectedFp, COOKIE_OPTS);
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="bid-lens admin"' },
    });
  }

  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";
  const now = Math.floor(Date.now() / 1000);
  const since = now - LOGIN_WINDOW_SECONDS;

  await pruneOldLoginAttempts(c.env.DB, since);

  const failures = await countRecentFailures(c.env.DB, ip, since);
  if (failures >= MAX_FAILURES) {
    return c.text("Too many failed login attempts. Try again later.", 429);
  }

  // Basic 자격증명 파싱 — malformed base64 → 실패 기록 후 401
  let username = "";
  let inputFp = "";
  try {
    if (authHeader.startsWith("Basic ")) {
      const decoded = atob(authHeader.slice(6));
      const colon = decoded.indexOf(":");
      if (colon !== -1) {
        username = decoded.slice(0, colon);
        inputFp = await passwordFingerprint(decoded.slice(colon + 1));
      }
    }
  } catch {
    await recordLoginAttempt(c.env.DB, ip, false, now);
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="bid-lens admin"' },
    });
  }

  // username 은 공개 정보 — 타이밍 안전 불필요. 패스워드만 핑거프린트 비교.
  const valid = username === "admin" && timingSafeEqual(inputFp, expectedFp);

  if (!valid) {
    await recordLoginAttempt(c.env.DB, ip, false, now);
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="bid-lens admin"' },
    });
  }

  await clearLoginFailures(c.env.DB, ip);
  setCookie(c, "admin_auth", expectedFp, COOKIE_OPTS);
  return next();
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
