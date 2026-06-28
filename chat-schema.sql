-- ============================================================
--  کافه باراما — چت تیم (Supabase)
--  این فایل را یک‌بار در Supabase > SQL Editor اجرا کنید.
--  (جدا از schema.sql است تا محصولات دوباره وارد نشوند.)
-- ============================================================

-- ---------- نیروها ----------
create table if not exists staff (
  id         bigint generated always as identity primary key,
  name       text not null,            -- نام نیرو
  pin        text,                     -- رمز کوتاه (PIN)
  role       text,                     -- سمت (باریستا، آشپز، مدیر…)
  active     boolean default true,
  created_at timestamptz default now()
);

-- ---------- کانال‌های گفتگو ----------
create table if not exists channels (
  id         bigint generated always as identity primary key,
  name       text not null,            -- نام کانال
  emoji      text,                     -- ایموجی نمایش
  sort       int default 0,            -- ترتیب
  created_at timestamptz default now()
);

-- ---------- پیام‌ها ----------
create table if not exists messages (
  id         bigint generated always as identity primary key,
  channel_id bigint references channels(id) on delete cascade,
  staff_id   bigint,                   -- فرستنده
  staff_name text,                     -- نام فرستنده (برای نمایش سریع)
  type       text default 'text',      -- text | image | voice | list
  text       text,                     -- متن پیام / کپشن / متن لیست
  media_url  text,                     -- آدرس عکس یا صوت
  created_at timestamptz default now()
);
create index if not exists messages_channel_idx on messages (channel_id, created_at);

-- ---------- دسترسی عمومی (با کلید publishable) ----------
alter table staff    enable row level security;
alter table channels enable row level security;
alter table messages enable row level security;

drop policy if exists "public_staff"    on staff;
drop policy if exists "public_channels" on channels;
drop policy if exists "public_messages" on messages;

create policy "public_staff"    on staff    for all using (true) with check (true);
create policy "public_channels" on channels for all using (true) with check (true);
create policy "public_messages" on messages for all using (true) with check (true);

-- ---------- کانال‌های پیش‌فرض (فقط اگر خالی باشد) ----------
insert into channels (name, emoji, sort)
select v.name, v.emoji, v.sort
from (values
  ('عمومی',          '💬', 1),
  ('گزارش‌ها',       '📋', 2),
  ('خرید و تهیه',    '🛒', 3),
  ('اطلاعیه مدیریت', '📢', 4)
) as v(name, emoji, sort)
where not exists (select 1 from channels);

-- ---------- یک نیروی نمونه (فقط اگر خالی باشد) ----------
-- بعد از ورود می‌توانید از داخل برنامه نیرو اضافه/حذف کنید.
insert into staff (name, pin, role)
select 'مدیر', '1234', 'مدیر'
where not exists (select 1 from staff);

-- ============================================================
--  باکت ذخیرهٔ عکس و صوت چت (Storage)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

drop policy if exists "chat_media_read"   on storage.objects;
drop policy if exists "chat_media_insert" on storage.objects;

create policy "chat_media_read"   on storage.objects
  for select using (bucket_id = 'chat-media');
create policy "chat_media_insert" on storage.objects
  for insert with check (bucket_id = 'chat-media');
