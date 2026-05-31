-- FTS5 가상 테이블 생성 (기본 unicode61 토크나이저 사용)
CREATE VIRTUAL TABLE IF NOT EXISTS bids_fts USING fts5(
  bid_ntce_no,
  bid_ntce_ord,
  bid_ntce_nm,
  dmnd_instt_nm,
  tokenize='unicode61'
);

-- 기존 데이터 일괄 이관
INSERT INTO bids_fts (bid_ntce_no, bid_ntce_ord, bid_ntce_nm, dmnd_instt_nm)
SELECT bid_ntce_no, bid_ntce_ord, bid_ntce_nm, dmnd_instt_nm FROM bids;

-- 자동 동기화를 위한 Trigger 추가
CREATE TRIGGER IF NOT EXISTS bids_ai AFTER INSERT ON bids BEGIN
  INSERT INTO bids_fts (bid_ntce_no, bid_ntce_ord, bid_ntce_nm, dmnd_instt_nm)
  VALUES (new.bid_ntce_no, new.bid_ntce_ord, new.bid_ntce_nm, new.dmnd_instt_nm);
END;

CREATE TRIGGER IF NOT EXISTS bids_ad AFTER DELETE ON bids BEGIN
  DELETE FROM bids_fts 
  WHERE bid_ntce_no = old.bid_ntce_no AND bid_ntce_ord = old.bid_ntce_ord;
END;

CREATE TRIGGER IF NOT EXISTS bids_au AFTER UPDATE ON bids BEGIN
  UPDATE bids_fts SET
    bid_ntce_nm = new.bid_ntce_nm,
    dmnd_instt_nm = new.dmnd_instt_nm
  WHERE bid_ntce_no = old.bid_ntce_no AND bid_ntce_ord = old.bid_ntce_ord;
END;
