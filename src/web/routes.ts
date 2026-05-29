import { Hono } from "hono";
import type { SearchParams } from "../db/repo";
import { searchBids } from "../db/repo";
import type { Env } from "../types";
import { renderPage } from "./render";

export const webRouter = new Hono<{ Bindings: Env }>();

function buildSearchParams(
  q: string,
  dmnd: string,
  from: string,
  to: string,
  page: number,
  pageSize?: number,
): SearchParams {
  const params: SearchParams = { page };
  if (q) params.q = q;
  if (dmnd) params.dmnd = dmnd;
  if (from) params.from = from;
  if (to) params.to = to;
  if (pageSize !== undefined) params.pageSize = pageSize;
  return params;
}

webRouter.get("/", async (c) => {
  const q = c.req.query("q") ?? "";
  const dmnd = c.req.query("dmnd") ?? "";
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));

  // form input은 YYYY-MM-DD, D1 비교는 YYYYMMDD
  const fromFmt = from.replace(/-/g, "");
  const toFmt = to.replace(/-/g, "");

  const result = await searchBids(c.env.DB, buildSearchParams(q, dmnd, fromFmt, toFmt, page));

  const html = renderPage(result, { q, dmnd, from, to, page });
  return c.html(html);
});

webRouter.get("/api/bids", async (c) => {
  const q = c.req.query("q") ?? "";
  const dmnd = c.req.query("dmnd") ?? "";
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "20")));

  const result = await searchBids(c.env.DB, buildSearchParams(q, dmnd, from, to, page, pageSize));

  return c.json(result);
});
