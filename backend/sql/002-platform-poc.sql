CREATE TABLE IF NOT EXISTS poc_users (user_code VARCHAR(128) PRIMARY KEY, display_name VARCHAR(100) NOT NULL);
CREATE TABLE IF NOT EXISTS poc_entries (entry_id VARCHAR(128) PRIMARY KEY, payload JSONB NOT NULL, active SMALLINT NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS poc_permissions (
  user_code VARCHAR(128) NOT NULL, entry_id VARCHAR(128) NOT NULL,
  PRIMARY KEY (user_code,entry_id)
);
CREATE TABLE IF NOT EXISTS poc_favorites (
  user_code VARCHAR(128) NOT NULL, entry_id VARCHAR(128) NOT NULL,
  PRIMARY KEY (user_code,entry_id)
);
CREATE TABLE IF NOT EXISTS poc_sessions (
  token_hash CHAR(64) PRIMARY KEY, user_code VARCHAR(128) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS poc_sessions_idx_expiry ON poc_sessions (expires_at);
CREATE TABLE IF NOT EXISTS poc_faults (user_code VARCHAR(128) PRIMARY KEY, fault VARCHAR(32) NOT NULL);
