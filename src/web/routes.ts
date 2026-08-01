import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { SearchParams } from "../db/repo";
import { getFilterRules, searchBids } from "../db/repo";
import type { Env } from "../types";
import { passwordFingerprint } from "./admin";
import { FAVICON_SVG } from "./favicon";
import { renderPage } from "./render";

export const webRouter = new Hono<{ Bindings: Env }>();

export function getKstToday(): string {
  const now = new Date();
  // KST는 UTC+9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0] ?? "";
}

interface SearchInput {
  q: string;
  dmnd: string;
  from: string;
  to: string;
  page: number;
  pageSize?: number;
  includeClosed?: boolean;
  today?: string;
}

function buildSearchParams(input: SearchInput): SearchParams {
  const params: SearchParams = {
    page: input.page,
  };
  if (input.q) params.q = input.q;
  if (input.dmnd) params.dmnd = input.dmnd;
  if (input.from) params.from = input.from;
  if (input.to) params.to = input.to;
  if (input.pageSize !== undefined) params.pageSize = input.pageSize;
  if (input.includeClosed !== undefined) params.includeClosed = input.includeClosed;
  if (input.today) params.today = input.today;
  return params;
}

webRouter.get("/favicon.svg", () => {
  return new Response(FAVICON_SVG, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=604800",
    },
  });
});

webRouter.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 308));

webRouter.get("/", async (c) => {
  const q = c.req.query("q") ?? "";
  const dmnd = c.req.query("dmnd") ?? "";
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const includeClosed =
    c.req.query("includeClosed") === "1" || c.req.query("includeClosed") === "true";
  const today = getKstToday();

  const [result, filterRules] = await Promise.all([
    searchBids(c.env.DB, buildSearchParams({ q, dmnd, from, to, page, includeClosed, today })),
    getFilterRules(c.env.DB),
  ]);

  // admin_auth 쿠키값이 현재 비밀번호 핑거프린트와 일치하면 isAdmin
  let isAdmin = false;
  if (c.env.ADMIN_PASSWORD) {
    const cookie = getCookie(c, "admin_auth");
    if (cookie) {
      const expected = await passwordFingerprint(c.env.ADMIN_PASSWORD);
      isAdmin = cookie === expected;
    }
  }

  const html = renderPage(
    result,
    { q, dmnd, from, to, page, includeClosed, today },
    { isAdmin, filterRules },
  );
  return c.html(html);
});

webRouter.get("/api/bids", async (c) => {
  const q = c.req.query("q") ?? "";
  const dmnd = c.req.query("dmnd") ?? "";
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "20")));
  const includeClosed =
    c.req.query("includeClosed") === "1" || c.req.query("includeClosed") === "true";
  const today = getKstToday();

  const result = await searchBids(
    c.env.DB,
    buildSearchParams({ q, dmnd, from, to, page, pageSize, includeClosed, today }),
  );

  return c.json(result);
});
