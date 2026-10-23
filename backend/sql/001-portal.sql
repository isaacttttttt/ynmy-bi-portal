CREATE TABLE IF NOT EXISTS portal_data_batch (
  batch_id TINYINT PRIMARY KEY, data_as_of DATE NOT NULL, seeded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS icon_repository (
  icon_id BIGINT UNSIGNED PRIMARY KEY, icon_name VARCHAR(100) NOT NULL, icon_url VARCHAR(1024) NOT NULL
);
CREATE TABLE IF NOT EXISTS report_metadata (
  report_id BIGINT UNSIGNED PRIMARY KEY,
  fine_entry_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL UNIQUE,
  report_name VARCHAR(200) NOT NULL, icon_id BIGINT UNSIGNED,
  fine_report_path VARCHAR(512) NOT NULL, report_desc VARCHAR(1000), use_scene VARCHAR(1000),
  business_module VARCHAR(100) NOT NULL, report_owner_name VARCHAR(100) NOT NULL,
  report_owner_dept VARCHAR(100), dev_owner_name VARCHAR(100), dev_owner_dept VARCHAR(100),
  source_system VARCHAR(500), core_metrics JSON NOT NULL, calc_logic TEXT,
  update_frequency ENUM('实时','T+1','周更新','月更新') NOT NULL DEFAULT 'T+1',
  report_status TINYINT NOT NULL DEFAULT 1, last_updated_at DATETIME,
  total_views BIGINT UNSIGNED NOT NULL DEFAULT 0, sort_no INT NOT NULL DEFAULT 0,
  is_deleted TINYINT NOT NULL DEFAULT 0,
  KEY idx_status_sort (is_deleted, report_status, sort_no),
  CHECK (report_status IN (0,1)), CHECK (is_deleted IN (0,1)),
  CHECK (JSON_TYPE(core_metrics) = 'ARRAY')
);
-- MySQL serving-layer copy of the Hive daily aggregate; ETL retains at least 30 days.
CREATE TABLE IF NOT EXISTS dim_bi_visit_log (
  day_id DATE NOT NULL, report_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  user_code VARCHAR(128) COLLATE utf8mb4_bin NOT NULL, visit_type VARCHAR(32) NOT NULL DEFAULT 'view',
  visit_num BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (user_code, report_id, day_id, visit_type), KEY idx_day (day_id)
);
CREATE TABLE IF NOT EXISTS fr_index_noticement (
  notice_uuid VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY, notice_title VARCHAR(256) NOT NULL,
  notice_category VARCHAR(256), notice_is_top TINYINT NOT NULL DEFAULT 0,
  notice_last_day_id DATE, notice_start_day_id DATE NOT NULL,
  notice_content TEXT, notice_is_hyperlink TINYINT NOT NULL DEFAULT 0, notice_hyperlink VARCHAR(2048),
  notice_register_user_id VARCHAR(128), notice_register_day_id DATE NOT NULL,
  notice_region_id VARCHAR(1024), notice_region_desc VARCHAR(1024),
  KEY idx_notice_dates (notice_start_day_id, notice_last_day_id),
  CHECK (notice_is_top IN (0,1)), CHECK (notice_is_hyperlink IN (0,1))
);
CREATE TABLE IF NOT EXISTS fr_quick_entry_app (
  app_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, app_key VARCHAR(64) COLLATE utf8mb4_bin NOT NULL UNIQUE,
  app_name VARCHAR(100) NOT NULL, app_desc VARCHAR(500), jump_url VARCHAR(2048), icon_url VARCHAR(1024),
  sort_no INT NOT NULL DEFAULT 0, status TINYINT NOT NULL DEFAULT 1, is_deleted TINYINT NOT NULL DEFAULT 0,
  KEY idx_status_sort (status, is_deleted, sort_no)
);
