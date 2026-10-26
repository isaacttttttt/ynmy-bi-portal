CREATE TABLE IF NOT EXISTS portal_search_history (
  user_code VARCHAR(128) NOT NULL,
  category VARCHAR(10) NOT NULL,
  query_key VARCHAR(200) NOT NULL,
  query_text VARCHAR(200) NOT NULL,
  searched_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_code, category, query_key), CHECK (category IN ('all','report','tag','metric'))
);
CREATE INDEX IF NOT EXISTS idx_search_history_recent ON portal_search_history (user_code, category, searched_at DESC, query_key);
