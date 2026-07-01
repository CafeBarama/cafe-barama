-- ============================================================
--  چت تیم: آنلاین بودن + خوانده‌شدن پیام
--  یک‌بار در Supabase > SQL Editor اجرا کنید.
-- ============================================================

-- حضور آنلاین: هر کاربر last_seen خودش را به‌روز می‌کند
create table if not exists chat_presence (
  uid        uuid primary key,
  name       text,
  username   text,
  last_seen  timestamptz default now()
);
alter table chat_presence enable row level security;
drop policy if exists chat_presence_read on chat_presence;
drop policy if exists chat_presence_ins  on chat_presence;
drop policy if exists chat_presence_upd  on chat_presence;
create policy chat_presence_read on chat_presence for select
  using (public.cafe_role() in ('admin','staff'));
create policy chat_presence_ins  on chat_presence for insert
  with check (uid = auth.uid());
create policy chat_presence_upd  on chat_presence for update
  using (uid = auth.uid());

-- خوانده‌شدن: آخرین زمان مطالعهٔ هر کاربر در هر کانال
create table if not exists chat_reads (
  uid          uuid,
  channel_id   bigint,
  last_read_at timestamptz default now(),
  primary key (uid, channel_id)
);
alter table chat_reads enable row level security;
drop policy if exists chat_reads_read on chat_reads;
drop policy if exists chat_reads_ins  on chat_reads;
drop policy if exists chat_reads_upd  on chat_reads;
create policy chat_reads_read on chat_reads for select
  using (public.cafe_role() in ('admin','staff'));
create policy chat_reads_ins  on chat_reads for insert
  with check (uid = auth.uid());
create policy chat_reads_upd  on chat_reads for update
  using (uid = auth.uid());
