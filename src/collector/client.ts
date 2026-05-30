import type {
  BidApiResponse,
  BidAttachmentItem,
  BidItem,
  ProposalRequestAttachment,
} from "./types";

const MAX_ROWS_PER_PAGE = 500;
const MAX_TIMEOUT_RETRIES = 1;
const PROPOSAL_FILE_KEYWORD = "제안";

export interface BidClientConfig {
  proxyUrl: string;
  apiKey: string;
}

export interface FetchBidsProgress {
  page: number;
  totalPages: number;
  fetched: number;
  totalCount: number;
}

async function fetchPage<TItem = BidItem>(
  config: BidClientConfig,
  path: string,
  params: URLSearchParams,
  pageNo: number,
  numOfRows: number,
  retryLeft = MAX_TIMEOUT_RETRIES,
): Promise<BidApiResponse<TItem>> {
  params.set("numOfRows", String(numOfRows));
  params.set("pageNo", String(pageNo));
  params.set("type", "json");
  const url = `${config.proxyUrl}${path}?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-api-key": config.apiKey },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (retryLeft > 0 && err instanceof Error && err.name === "TimeoutError") {
      console.warn(`[bid-client] timeout, retrying (${retryLeft} left)…`);
      return fetchPage<TItem>(config, path, params, pageNo, numOfRows, retryLeft - 1);
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

  const data = JSON.parse(text) as BidApiResponse<TItem>;

  if (data.response.header.resultCode !== "00") {
    throw new Error(
      `[bid-client] API error: ${data.response.header.resultCode} ${data.response.header.resultMsg}`,
    );
  }

  return data;
}

function bidKey(no: string, ord: string): string {
  return `${no}\u0000${ord}`;
}

function standardBidParams(startDt: string, endDt: string): URLSearchParams {
  return new URLSearchParams({
    bidNtceBgnDt: startDt,
    bidNtceEndDt: endDt,
  });
}

function serviceBidParams(startDt: string, endDt: string): URLSearchParams {
  return new URLSearchParams({
    inqryDiv: "1",
    inqryBgnDt: startDt,
    inqryEndDt: endDt,
  });
}

export function extractProposalRequestAttachment(
  item: BidAttachmentItem,
): ProposalRequestAttachment | null {
  for (let i = 1; i <= 10; i++) {
    const fileName = item[`ntceSpecFileNm${i}`]?.trim();
    const url = item[`ntceSpecDocUrl${i}`]?.trim();
    if (fileName?.includes(PROPOSAL_FILE_KEYWORD) && url) {
      return { fileName, url };
    }
  }
  return null;
}

async function fetchProposalRequestAttachments(
  config: BidClientConfig,
  startDt: string,
  endDt: string,
): Promise<Map<string, ProposalRequestAttachment>> {
  const path = "/BidPublicInfoService/getBidPblancListInfoServc";
  const preflight = await fetchPage(config, path, serviceBidParams(startDt, endDt), 1, 1);
  const totalCount = preflight.response.body.totalCount;
  const totalPages = Math.ceil(totalCount / MAX_ROWS_PER_PAGE);
  const attachments = new Map<string, ProposalRequestAttachment>();

  for (let page = 1; page <= totalPages; page++) {
    const data = await fetchPage<BidAttachmentItem>(
      config,
      path,
      serviceBidParams(startDt, endDt),
      page,
      MAX_ROWS_PER_PAGE,
    );
    const items = data.response.body.items;

    if (!items || typeof items === "string") continue;

    for (const item of items) {
      const attachment = extractProposalRequestAttachment(item);
      if (attachment) attachments.set(bidKey(item.bidNtceNo, item.bidNtceOrd), attachment);
    }
  }

  return attachments;
}

/**
 * 날짜창(YYYYMMDDHHmm 형식)의 입찰공고 전량 수집 후 반환.
 * 페이지네이션은 preflight(numOfRows=1)로 totalCount 확인 후 처리.
 */
export async function fetchBids(
  config: BidClientConfig,
  startDt: string,
  endDt: string,
  onProgress?: (progress: FetchBidsProgress) => void | Promise<void>,
): Promise<BidItem[]> {
  // preflight: totalCount 확인
  const path = "/PubDataOpnStdService/getDataSetOpnStdBidPblancInfo";
  const preflight = await fetchPage(config, path, standardBidParams(startDt, endDt), 1, 1);
  const totalCount = preflight.response.body.totalCount;
  const totalPages = Math.ceil(totalCount / MAX_ROWS_PER_PAGE);

  await onProgress?.({ page: 0, totalPages, fetched: 0, totalCount });

  if (totalCount === 0) return [];

  const results: BidItem[] = [];

  for (let page = 1; page <= totalPages; page++) {
    const data = await fetchPage(
      config,
      path,
      standardBidParams(startDt, endDt),
      page,
      MAX_ROWS_PER_PAGE,
    );
    const items = data.response.body.items;

    if (!items || typeof items === "string") {
      await onProgress?.({ page, totalPages, fetched: results.length, totalCount });
      continue;
    }

    results.push(...items);
    await onProgress?.({ page, totalPages, fetched: results.length, totalCount });
  }

  try {
    const attachments = await fetchProposalRequestAttachments(config, startDt, endDt);
    for (const item of results) {
      const attachment = attachments.get(bidKey(item.bidNtceNo, item.bidNtceOrd));
      if (!attachment) continue;
      item.proposalRequestFileNm = attachment.fileName;
      item.proposalRequestUrl = attachment.url;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[bid-client] proposal attachment merge skipped: ${message}`);
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
