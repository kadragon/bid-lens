import type { BidApiResponse, BidItem } from "./types";

const MAX_ROWS_PER_PAGE = 500;
const MAX_TIMEOUT_RETRIES = 1;

export interface BidClientConfig {
  proxyUrl: string;
  apiKey: string;
}

async function fetchPage(
  config: BidClientConfig,
  startDt: string,
  endDt: string,
  pageNo: number,
  numOfRows: number,
  retryLeft = MAX_TIMEOUT_RETRIES,
): Promise<BidApiResponse> {
  const url = `${config.proxyUrl}/PubDataOpnStdService/getDataSetOpnStdBidPblancInfo?numOfRows=${numOfRows}&pageNo=${pageNo}&type=json&bidNtceBgnDt=${startDt}&bidNtceEndDt=${endDt}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-api-key": config.apiKey },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (retryLeft > 0 && err instanceof Error && err.name === "TimeoutError") {
      console.warn(`[bid-client] timeout, retrying (${retryLeft} left)…`);
      return fetchPage(config, startDt, endDt, pageNo, numOfRows, retryLeft - 1);
    }
    throw err;
  }

  if (!res.ok) {
    throw new Error(`[bid-client] HTTP ${res.status} ${res.statusText}`);
  }

  const text = await res.text();

  // 프록시가 json 요청에도 XML 에러 봉투 반환하는 경우 처리
  if (text.trimStart().startsWith("<")) {
    throw new Error(`[bid-client] received XML response instead of JSON: ${text.slice(0, 200)}`);
  }

  const data = JSON.parse(text) as BidApiResponse;

  if (data.response.header.resultCode !== "00") {
    throw new Error(
      `[bid-client] API error: ${data.response.header.resultCode} ${data.response.header.resultMsg}`,
    );
  }

  return data;
}

/**
 * 날짜창(YYYYMMDDHHmm 형식)의 입찰공고 전량 수집 후 반환.
 * 페이지네이션은 preflight(numOfRows=1)로 totalCount 확인 후 처리.
 */
export async function fetchBids(
  config: BidClientConfig,
  startDt: string,
  endDt: string,
): Promise<BidItem[]> {
  // preflight: totalCount 확인
  const preflight = await fetchPage(config, startDt, endDt, 1, 1);
  const totalCount = preflight.response.body.totalCount;

  if (totalCount === 0) return [];

  const totalPages = Math.ceil(totalCount / MAX_ROWS_PER_PAGE);
  const results: BidItem[] = [];

  for (let page = 1; page <= totalPages; page++) {
    const data = await fetchPage(config, startDt, endDt, page, MAX_ROWS_PER_PAGE);
    const items = data.response.body.items;

    if (!items || typeof items === "string") continue;

    results.push(...items);
  }

  return results;
}

/**
 * 직전 N일 날짜 목록 반환 (YYYYMMDD 형식).
 * cron이 매일 UTC 00:00 실행이므로 직전 2일 조회로 갱신/누락 보정.
 */
export function getQueryDates(daysBack = 2): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 1; i <= daysBack; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${y}${m}${day}`);
  }
  return dates;
}
