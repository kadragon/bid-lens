import { getFilterRules, upsertBids } from "../db/repo";
import { type BidClientConfig, fetchBids } from "./client";
import { DEFAULT_RULES, isTargetBid } from "./filter";

export interface CollectDayResult {
  date: string;
  fetched: number;
  filtered: number;
  upserted: number;
  error?: string;
}

export function normalizeCollectDate(input: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString().slice(0, 10);
  return iso === input ? input.replaceAll("-", "") : null;
}

export async function collectBidDates(
  db: D1Database,
  config: BidClientConfig,
  dates: string[],
  logPrefix: string,
): Promise<CollectDayResult[]> {
  const rules = await getFilterRules(db).catch((err) => {
    console.error(`${logPrefix} 필터 규칙 로드 실패 — DEFAULT_RULES 사용:`, err);
    return structuredClone(DEFAULT_RULES);
  });

  const results: CollectDayResult[] = [];

  for (const date of dates) {
    const startDt = `${date}0000`;
    const endDt = `${date}2359`;
    console.log(`${logPrefix} 날짜창: ${startDt}~${endDt}`);

    try {
      const allItems = await fetchBids(config, startDt, endDt);
      const filtered = allItems.filter((item) => isTargetBid(item, rules));
      console.log(`${logPrefix} ${date}: 전체 ${allItems.length}건 → 필터 후 ${filtered.length}건`);

      const upserted = filtered.length > 0 ? await upsertBids(db, filtered) : 0;
      if (filtered.length > 0) console.log(`${logPrefix} ${date}: ${upserted}건 upsert`);
      results.push({ date, fetched: allItems.length, filtered: filtered.length, upserted });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`${logPrefix} ${date} 수집 실패:`, error);
      results.push({ date, fetched: 0, filtered: 0, upserted: 0, error });
    }
  }

  return results;
}
