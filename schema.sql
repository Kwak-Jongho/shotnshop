-- Cloudflare D1 스키마
-- Cloudflare 대시보드 > D1 > 데이터베이스 선택 > Console 탭에서 실행

CREATE TABLE IF NOT EXISTS purchases (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand        TEXT DEFAULT '',
  category     TEXT DEFAULT '',
  emoji        TEXT DEFAULT '📦',
  best_price   INTEGER DEFAULT 0,
  best_site    TEXT DEFAULT '',
  best_url     TEXT DEFAULT '',
  purchased_at TEXT NOT NULL,
  repeat_days  INTEGER DEFAULT NULL,
  next_reminder TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_id      ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_next_reminder ON purchases(next_reminder);
