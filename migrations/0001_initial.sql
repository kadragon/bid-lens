CREATE TABLE IF NOT EXISTS bids (
  bid_ntce_no TEXT NOT NULL,
  bid_ntce_ord TEXT NOT NULL,
  bid_ntce_nm TEXT,
  bid_ntce_sttus_nm TEXT,
  bid_ntce_date TEXT,
  bsns_div_nm TEXT,
  ntce_instt_nm TEXT,
  dmnd_instt_nm TEXT,
  cntrct_cncls_mthd_nm TEXT,
  bid_clse_date TEXT,
  bid_clse_tm TEXT,
  openg_date TEXT,
  openg_tm TEXT,
  asign_bdgt_amt INTEGER,
  presmpt_prce INTEGER,
  bidprc_psbl_indstryty_nm TEXT,
  bid_ntce_url TEXT,
  collected_at TEXT NOT NULL,
  PRIMARY KEY (bid_ntce_no, bid_ntce_ord)
);

CREATE INDEX IF NOT EXISTS idx_bids_date ON bids(bid_ntce_date);
CREATE INDEX IF NOT EXISTS idx_bids_dmnd ON bids(dmnd_instt_nm);
CREATE INDEX IF NOT EXISTS idx_bids_clse ON bids(bid_clse_date);
