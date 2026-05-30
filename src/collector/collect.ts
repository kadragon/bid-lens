import { getFilterRules, upsertBids } from "../db/repo";
import { type BidClientConfig, fetchBids } from "./client";
import { DEFAULT_RULES, isTargetBid } from "./filter";

const MAX_COLLECT_RANGE_DAYS = 7;

export interface CollectDayResult {
  date: string;
  fetched: number;
  filtered: number;
  upserted: number;
  error?: string;
}

export type CollectProgressEvent =
  | { type: "day-start"; date: string; dayIndex: number }
  | {
      type: "page";
      date: string;
      page: number;
      totalPages: number;
      fetched: number;
      totalCount: number;
    }
  | { type: "day-complete"; date: string; fetched: number; filtered: number; upserted: number }
  | { type: "day-error"; date: string; error: string };

export function normalizeCollectDate(input: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString().slice(0, 10);
  return iso === input ? input.replaceAll("-", "") : null;
}

function compactDateToIso(date: string): string {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

export function collectDateRange(
  startInput: string,
  endInput: string,
  maxDays = MAX_COLLECT_RANGE_DAYS,
): string[] | null {
  const start = normalizeCollectDate(startInput);
  const end = normalizeCollectDate(endInput || startInput);
  if (start === null || end === null || start > end) return null;

  const dates: string[] = [];
  const cursor = new Date(`${compactDateToIso(start)}T00:00:00.000Z`);
  const endDate = new Date(`${compactDateToIso(end)}T00:00:00.000Z`);

  while (cursor <= endDate) {
    if (dates.length >= maxDays) return null;
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    dates.push(`${y}${m}${d}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export async function collectBidDates(
  db: D1Database,
  config: BidClientConfig,
  dates: string[],
  logPrefix: string,
  onProgress?: (event: CollectProgressEvent) => void | Promise<void>,
): Promise<CollectDayResult[]> {
  const rules = await getFilterRules(db).catch((err) => {
    console.error(`${logPrefix} 필터 규칙 로드 실패 — DEFAULT_RULES 사용:`, err);
    return structuredClone(DEFAULT_RULES);
  });

  const results: CollectDayResult[] = [];

  for (const [index, date] of dates.entries()) {
    const startDt = `${date}0000`;
    const endDt = `${date}2359`;
    console.log(`${logPrefix} 날짜창: ${startDt}~${endDt}`);
    await onProgress?.({ type: "day-start", date, dayIndex: index + 1 });

    try {
      const allItems = await fetchBids(config, startDt, endDt, (progress) =>
        onProgress?.({ type: "page", date, ...progress }),
      );
      const filtered = allItems.filter((item) => isTargetBid(item, rules));
      console.log(`${logPrefix} ${date}: 전체 ${allItems.length}건 → 필터 후 ${filtered.length}건`);

      const upserted = filtered.length > 0 ? await upsertBids(db, filtered) : 0;
      if (filtered.length > 0) console.log(`${logPrefix} ${date}: ${upserted}건 upsert`);
      const result = { date, fetched: allItems.length, filtered: filtered.length, upserted };
      results.push(result);
      await onProgress?.({ type: "day-complete", ...result });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`${logPrefix} ${date} 수집 실패:`, error);
      results.push({ date, fetched: 0, filtered: 0, upserted: 0, error });
      await onProgress?.({ type: "day-error", date, error });
    }
  }

  return results;
}
