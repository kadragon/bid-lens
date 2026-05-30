import { Hono } from "hono";
import { getQueryDates } from "./collector/client";
import { collectBidDates } from "./collector/collect";
import type { Env } from "./types";
import { adminRouter } from "./web/admin";
import { webRouter } from "./web/routes";

const app = new Hono<{ Bindings: Env }>();

app.route("/admin", adminRouter);
app.route("/", webRouter);

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    console.log("[scheduled] 수집 시작");
    const results = await collectBidDates(
      env.DB,
      { proxyUrl: env.OPEN_DATA_API_PROXY_URL, apiKey: env.OPEN_DATA_X_API_KEY },
      getQueryDates(2),
      "[scheduled]",
    );
    const totalUpserted = results.reduce((sum, result) => sum + result.upserted, 0);

    console.log(`[scheduled] 완료: 총 ${totalUpserted}건 upsert`);
  },
};
