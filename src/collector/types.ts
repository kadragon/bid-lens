export interface BidItem {
  bidNtceNo: string;
  bidNtceOrd: string;
  bidNtceNm: string;
  bidNtceSttusNm: string;
  bidNtceDate: string;
  bsnsDivNm: string;
  ntceInsttNm: string;
  dmndInsttNm: string;
  cntrctCnclsMthdNm: string;
  bidClseDate: string;
  bidClseTm: string;
  opengDate: string;
  opengTm: string;
  asignBdgtAmt: string;
  presmptPrce: string;
  bidprcPsblIndstrytyNm: string;
  bidNtceUrl: string;
}

export interface BidApiResponseHeader {
  resultCode: string;
  resultMsg: string;
}

export interface BidApiResponseBody {
  items: BidItem[] | string | null;
  numOfRows: number;
  pageNo: number;
  totalCount: number;
}

export interface BidApiResponse {
  response: {
    header: BidApiResponseHeader;
    body: BidApiResponseBody;
  };
}
