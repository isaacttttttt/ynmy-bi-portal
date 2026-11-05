-- Apply to the supplied source tables after importing them; no business rows are changed.
CREATE INDEX IF NOT EXISTS idx_portal_user_username ON dim_bi_user (username);
CREATE INDEX IF NOT EXISTS idx_portal_dept_job ON dim_dept_mapping (dept_job_id);
CREATE INDEX IF NOT EXISTS idx_portal_report_id ON dim_bi_report_info_dtl (report_id);
CREATE INDEX IF NOT EXISTS idx_portal_visit_report_day ON dim_bi_visit_log (report_id, day_id);
CREATE INDEX IF NOT EXISTS idx_portal_visit_day ON dim_bi_visit_log (day_id DESC);
