-- Older test imports lack the dictionary row ID supplied by current customer tables.
ALTER TABLE public.dim_bi_report_dictionary
  ADD COLUMN IF NOT EXISTS id varchar(2048) NOT NULL DEFAULT gen_random_uuid()::text;
