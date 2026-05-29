import { Hono } from "hono";
import type { SearchParams } from "../db/repo";
import { searchBids } from "../db/repo";
import type { Env } from "../types";
import { kstDateIso } from "../util/date";
import { renderPage } from "./render";

export const webRouter = new Hono<{ Bindings: Env }>();

interface SearchInput {
  q: string;
  dmnd: string;
  from: string;
  to: string;
  page: number;
  includeClosed: boolean;
  today: string;
  pageSize?: number;
}

function buildSearchParams(input: SearchInput): SearchParams {
  const params: SearchParams = {
    page: input.page,
    includeClosed: input.includeClosed,
    today: input.today,
  };
  if (input.q) params.q = input.q;
  if (input.dmnd) params.dmnd = input.dmnd;
  if (input.from) params.from = input.from;
  if (input.to) params.to = input.to;
  if (input.pageSize !== undefined) params.pageSize = input.pageSize;
  return params;
}

webRouter.get("/", async (c) => {
  const q = c.req.query("q") ?? "";
  const dmnd = c.req.query("dmnd") ?? "";
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  // 체크박스 미체크 시 쿼리 파라미터 자체가 없음 → 부재=마감 제외(기본)
  const includeClosed = c.req.query("includeClosed") !== undefined;
  const today = kstDateIso(new Date());

  // form input은 YYYY-MM-DD, D1 비교는 YYYYMMDD
  const fromFmt = from.replace(/-/g, "");
  const toFmt = to.replace(/-/g, "");

  const result = await searchBids(
    c.env.DB,
    buildSearchParams({ q, dmnd, from: fromFmt, to: toFmt, page, includeClosed, today }),
  );

  const html = renderPage(result, { q, dmnd, from, to, page, includeClosed });
  return c.html(html);
});

webRouter.get("/api/bids", async (c) => {
  const q = c.req.query("q") ?? "";
  const dmnd = c.req.query("dmnd") ?? "";
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "20")));
  const includeClosed = c.req.query("includeClosed") !== undefined;
  const today = kstDateIso(new Date());

  const result = await searchBids(
    c.env.DB,
    buildSearchParams({ q, dmnd, from, to, page, includeClosed, today, pageSize }),
  );

  return c.json(result);
});
