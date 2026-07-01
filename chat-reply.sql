-- ============================================================
--  چت: ریپلای و فوروارد
--  یک‌بار در Supabase > SQL Editor اجرا کنید.
-- ============================================================
alter table messages add column if not exists reply_to   bigint;
alter table messages add column if not exists reply_name text;
alter table messages add column if not exists reply_text text;
alter table messages add column if not exists fwd        boolean default false;
