CREATE TABLE IF NOT EXISTS filter_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (rule_type, pattern)
);

CREATE INDEX IF NOT EXISTS idx_filter_rules_type ON filter_rules(rule_type, enabled);

-- 시드: src/collector/filter.ts DEFAULT_RULES 와 동기 유지
INSERT INTO filter_rules (rule_type, pattern, enabled, created_at) VALUES
  ('dmnd_include', '대학', 1, datetime('now')),
  ('dmnd_exclude', '병원', 1, datetime('now')),
  ('bsns_div_equals', '용역', 1, datetime('now')),
  ('name_exclude', '유지보수', 1, datetime('now')),
  ('industry_include', '소프트웨어', 1, datetime('now')),
  ('industry_include', '컴퓨터', 1, datetime('now')),
  ('industry_include', '정보보호', 1, datetime('now')),
  ('industry_include', '이러닝서비스업', 1, datetime('now')),
  ('industry_include', '정보통신', 1, datetime('now')),
  ('industry_exclude', '디지털콘텐츠개발서비스사업', 1, datetime('now'));
