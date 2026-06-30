-- ============================================================
--  کافه باراما — ورود امن + سطح دسترسی + حسابداری + حضور و غیاب
--  این فایل را یک‌بار در Supabase > SQL Editor اجرا کنید.
--  (بعد از schema.sql و chat-schema.sql)
--
--  نکته: این پروژهٔ Supabase با اپ حقوق و دستمزد (iPro) مشترک است،
--  پس همه چیز اینجا با نام‌های مخصوص کافه و فقط روی حساب‌های
--  «...@barama.local» کار می‌کند تا با آن اپ تداخل نکند.
--
--  ⚠️ قبل از استفاده: در Supabase به
--     Authentication > Sign In / Providers > Email رفته و
--     گزینهٔ «Confirm email» را خاموش کنید.
-- ============================================================

-- ---------- پروفایل کاربران کافه (نقش‌ها) ----------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique,
  full_name  text,
  role       text not null default 'staff',   -- admin | accountant | staff
  active     boolean default true,
  created_at timestamptz default now()
);

-- نقش کاربر فعلی (نام مخصوص کافه تا توابع اپ دیگر را بازنویسی نکند)
create or replace function public.cafe_role()
returns text language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
grant execute on function public.cafe_role() to authenticated, anon;

-- با ساخت کاربرِ «@barama.local»، یک پروفایل بساز.
-- اولین کاربر کافه به‌صورت خودکار «مدیر» می‌شود؛ بقیه «نیرو».
create or replace function public.cafe_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if new.email is null or new.email not like '%@barama.local' then return new; end if;
  if (select count(*) from public.profiles) = 0 then r := 'admin'; else r := 'staff'; end if;
  insert into public.profiles (id, username, full_name, role)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1), r)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created_cafe on auth.users;
create trigger on_auth_user_created_cafe
  after insert on auth.users for each row execute function public.cafe_handle_new_user();

alter table profiles enable row level security;
drop policy if exists "profiles_self"  on profiles;
drop policy if exists "profiles_admin" on profiles;
create policy "profiles_self"  on profiles for select using (id = auth.uid());
create policy "profiles_admin" on profiles for all
  using (public.cafe_role() = 'admin') with check (public.cafe_role() = 'admin');

-- ============================================================
--  قفل کردن جدول‌های کافه بر اساس نقش
-- ============================================================
drop policy if exists "public_products" on products;
create policy "products_rw" on products for all
  using (public.cafe_role() in ('admin','accountant'))
  with check (public.cafe_role() in ('admin','accountant'));

drop policy if exists "public_orders" on orders;
create policy "orders_rw" on orders for all
  using (public.cafe_role() in ('admin','accountant'))
  with check (public.cafe_role() in ('admin','accountant'));

drop policy if exists "public_inventory" on inventory;
drop policy if exists "inventory_read"   on inventory;
drop policy if exists "inventory_write"  on inventory;
drop policy if exists "inventory_update" on inventory;
drop policy if exists "inventory_delete" on inventory;
create policy "inventory_read"   on inventory for select using (auth.uid() is not null);
create policy "inventory_write"  on inventory for insert with check (public.cafe_role() in ('admin','accountant'));
create policy "inventory_update" on inventory for update using (public.cafe_role() in ('admin','accountant'));
create policy "inventory_delete" on inventory for delete using (public.cafe_role() in ('admin','accountant'));

-- ============================================================
--  چت: فقط مدیر و نیرو
-- ============================================================
alter table messages add column if not exists sender_uid uuid;

drop policy if exists "public_channels" on channels;
create policy "channels_read"  on channels for select using (public.cafe_role() in ('admin','staff'));
create policy "channels_admin" on channels for all
  using (public.cafe_role() = 'admin') with check (public.cafe_role() = 'admin');

drop policy if exists "public_messages" on messages;
create policy "messages_read"   on messages for select using (public.cafe_role() in ('admin','staff'));
create policy "messages_insert" on messages for insert
  with check (sender_uid = auth.uid() and public.cafe_role() in ('admin','staff'));
create policy "messages_delete" on messages for delete
  using (sender_uid = auth.uid() or public.cafe_role() = 'admin');

drop policy if exists "chat_media_insert" on storage.objects;
create policy "chat_media_insert" on storage.objects for insert
  with check (bucket_id = 'chat-media' and auth.role() = 'authenticated');

-- ============================================================
--  حسابداری — هزینه‌ها (فقط مدیر)
-- ============================================================
create table if not exists expenses (
  id         bigint generated always as identity primary key,
  exp_date   date default current_date,
  category   text,
  title      text,
  amount     numeric default 0,
  note       text,
  created_by uuid,
  created_at timestamptz default now()
);
create index if not exists expenses_date_idx on expenses (exp_date);
alter table expenses enable row level security;
drop policy if exists "expenses_admin" on expenses;
create policy "expenses_admin" on expenses for all
  using (public.cafe_role() = 'admin') with check (public.cafe_role() = 'admin');

-- ============================================================
--  حضور و غیاب کافه  (نام cafe_attendance تا با اپ حقوق تداخل نکند)
-- ============================================================
create table if not exists cafe_attendance (
  id         bigint generated always as identity primary key,
  staff_uid  uuid,
  staff_name text,
  work_date  date default current_date,
  clock_in   timestamptz,
  clock_out  timestamptz,
  note       text,
  created_at timestamptz default now()
);
create index if not exists cafe_attendance_uid_idx on cafe_attendance (staff_uid, work_date);
alter table cafe_attendance enable row level security;
drop policy if exists "cafe_att_select" on cafe_attendance;
drop policy if exists "cafe_att_insert" on cafe_attendance;
drop policy if exists "cafe_att_update" on cafe_attendance;
drop policy if exists "cafe_att_delete" on cafe_attendance;
create policy "cafe_att_select" on cafe_attendance for select
  using (staff_uid = auth.uid() or public.cafe_role() = 'admin');
create policy "cafe_att_insert" on cafe_attendance for insert
  with check (staff_uid = auth.uid());
create policy "cafe_att_update" on cafe_attendance for update
  using (staff_uid = auth.uid() or public.cafe_role() = 'admin');
create policy "cafe_att_delete" on cafe_attendance for delete
  using (public.cafe_role() = 'admin');

-- ============================================================
--  جبران: کاربرانِ کافه که پیش از این اسکریپت ساخته شده‌اند
-- ============================================================
insert into public.profiles (id, username, full_name, role)
select u.id, split_part(u.email,'@',1), split_part(u.email,'@',1), 'staff'
from auth.users u
where u.email like '%@barama.local'
  and not exists (select 1 from public.profiles p where p.id = u.id);

update public.profiles set role = 'admin'
where id = (select u.id from auth.users u where u.email like '%@barama.local' order by u.created_at asc limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

-- تأیید فقط حساب‌های کافه (با ایمیل داخلی)
update auth.users set email_confirmed_at = now()
where email like '%@barama.local' and email_confirmed_at is null;
