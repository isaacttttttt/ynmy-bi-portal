-- Personal portal writes are separate from the read-only business tables.
CREATE TABLE IF NOT EXISTS portal_search_history (
  user_code VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  category ENUM('report', 'tag', 'metric') NOT NULL,
  query_key VARCHAR(200) COLLATE utf8mb4_bin NOT NULL,
  query_text VARCHAR(200) NOT NULL,
  searched_at DATETIME(6) NOT NULL,
  PRIMARY KEY (user_code, category, query_key),
  INDEX idx_search_history_recent (user_code, category, searched_at DESC, query_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
