import { Hono } from "hono";
import { fetchBids, getQueryDates } from "./collector/client";
import { isTargetBid } from "./collector/filter";
import { upsertBids } from "./db/repo";
import type { Env } from "./types";
import { webRouter } from "./web/routes";

const app = new Hono<{ Bindings: Env }>();

app.route("/", webRouter);

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    console.log("[scheduled] 수집 시작");
    const dates = getQueryDates(2);
    let totalUpserted = 0;

    for (const date of dates) {
      const startDt = `${date}0000`;
      const endDt = `${date}2359`;
      console.log(`[scheduled] 날짜창: ${startDt}~${endDt}`);

      try {
        const allItems = await fetchBids(
          { proxyUrl: env.OPEN_DATA_API_PROXY_URL, apiKey: env.OPEN_DATA_X_API_KEY },
          startDt,
          endDt,
        );

        const filtered = allItems.filter(isTargetBid);
        console.log(
          `[scheduled] ${date}: 전체 ${allItems.length}건 → 필터 후 ${filtered.length}건`,
        );

        if (filtered.length > 0) {
          const upserted = await upsertBids(env.DB, filtered);
          console.log(`[scheduled] ${date}: ${upserted}건 upsert`);
          totalUpserted += upserted;
        }
      } catch (err) {
        // 날짜 하나 실패해도 다음 날짜 계속 진행 (부분 실패 허용)
        console.error(`[scheduled] ${date} 수집 실패:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`[scheduled] 완료: 총 ${totalUpserted}건 upsert`);
  },
};
