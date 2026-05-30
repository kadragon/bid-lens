import { afterEach, describe, expect, it, vi } from "vitest";
import { extractProposalRequestAttachment, fetchBids } from "../src/collector/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractProposalRequestAttachment", () => {
  it("returns first proposal file link", () => {
    const result = extractProposalRequestAttachment({
      bidNtceNo: "bid-1",
      bidNtceOrd: "00",
      ntceSpecFileNm1: "공고문.pdf",
      ntceSpecDocUrl1: "https://example.com/notice",
      ntceSpecFileNm2: "기술제안서.hwp",
      ntceSpecDocUrl2: "https://example.com/rfp",
    });

    expect(result).toEqual({
      fileName: "기술제안서.hwp",
      url: "https://example.com/rfp",
    });
  });

  it("ignores proposal files without links", () => {
    const result = extractProposalRequestAttachment({
      bidNtceNo: "bid-1",
      bidNtceOrd: "00",
      ntceSpecFileNm1: "제안서.hwp",
      ntceSpecDocUrl1: "",
    });

    expect(result).toBeNull();
  });
});

describe("fetchBids attachment merge", () => {
  it("merges proposal attachment from service notice API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          response: {
            header: { resultCode: "00", resultMsg: "OK" },
            body: { items: [], numOfRows: 1, pageNo: 1, totalCount: 1 },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          response: {
            header: { resultCode: "00", resultMsg: "OK" },
            body: {
              items: [
                {
                  bidNtceNo: "bid-1",
                  bidNtceOrd: "00",
                  bidNtceNm: "대학 소프트웨어 구축",
                  bidNtceSttusNm: "공고중",
                  bidNtceDate: "2026-05-01",
                  bsnsDivNm: "용역",
                  ntceInsttNm: "발주기관",
                  dmndInsttNm: "테스트대학교",
                  cntrctCnclsMthdNm: "일반경쟁",
                  bidClseDate: "2026-05-02",
                  bidClseTm: "0900",
                  opengDate: "202605031000",
                  opengTm: "1000",
                  asignBdgtAmt: "100000000",
                  presmptPrce: "90000000",
                  bidprcPsblIndstrytyNm: "소프트웨어",
                  bidNtceUrl: "https://example.com/bid-1",
                },
              ],
              numOfRows: 500,
              pageNo: 1,
              totalCount: 1,
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          response: {
            header: { resultCode: "00", resultMsg: "OK" },
            body: { items: [], numOfRows: 1, pageNo: 1, totalCount: 1 },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          response: {
            header: { resultCode: "00", resultMsg: "OK" },
            body: {
              items: [
                {
                  bidNtceNo: "bid-1",
                  bidNtceOrd: "00",
                  ntceSpecFileNm3: "기술제안서.hwp",
                  ntceSpecDocUrl3: "https://example.com/rfp",
                },
              ],
              numOfRows: 500,
              pageNo: 1,
              totalCount: 1,
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBids(
      { proxyUrl: "https://proxy.example", apiKey: "test-key" },
      "202605010000",
      "202605012359",
    );

    expect(result[0]?.proposalRequestFileNm).toBe("기술제안서.hwp");
    expect(result[0]?.proposalRequestUrl).toBe("https://example.com/rfp");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("PubDataOpnStdService");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("BidPublicInfoService");
  });
});
