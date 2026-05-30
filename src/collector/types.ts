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
  proposalRequestFileNm?: string;
  proposalRequestUrl?: string;
}

export interface ProposalRequestAttachment {
  fileName: string;
  url: string;
}

export interface BidAttachmentItem {
  bidNtceNo: string;
  bidNtceOrd: string;
  [key: string]: string | undefined;
}

export interface BidApiResponseHeader {
  resultCode: string;
  resultMsg: string;
}

export interface BidApiResponseBody<TItem = BidItem> {
  items: TItem[] | string | null;
  numOfRows: number;
  pageNo: number;
  totalCount: number;
}

export interface BidApiResponse<TItem = BidItem> {
  response: {
    header: BidApiResponseHeader;
    body: BidApiResponseBody<TItem>;
  };
}
