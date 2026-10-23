-- These tables belong only to the platform simulator, never to a real FineBI integration.
CREATE TABLE IF NOT EXISTS poc_users (user_code VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY, display_name VARCHAR(100) NOT NULL);
CREATE TABLE IF NOT EXISTS poc_entries (entry_id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY, payload JSON NOT NULL, active TINYINT NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS poc_permissions (
  user_code VARCHAR(128) COLLATE utf8mb4_bin NOT NULL, entry_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (user_code,entry_id)
);
CREATE TABLE IF NOT EXISTS poc_favorites (
  user_code VARCHAR(128) COLLATE utf8mb4_bin NOT NULL, entry_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (user_code,entry_id)
);
CREATE TABLE IF NOT EXISTS poc_sessions (
  token_hash CHAR(64) COLLATE ascii_bin PRIMARY KEY, user_code VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires_at DATETIME NOT NULL, KEY idx_expiry (expires_at)
);
CREATE TABLE IF NOT EXISTS poc_faults (user_code VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY, fault VARCHAR(32) NOT NULL);
