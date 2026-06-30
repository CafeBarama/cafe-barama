-- ============================================================
--  کافه باراما — ورود امن + سطح دسترسی + حسابداری + حضور و غیاب
--  این فایل را یک‌بار در Supabase > SQL Editor اجرا کنید.
--  (بعد از schema.sql و chat-schema.sql)
--
--  ⚠️ مهم: قبل از استفاده، در Supabase به
--     Authentication > Sign In / Providers > Email
--     رفته و گزینهٔ «Confirm email» را خاموش کنید
--     (چون با یوزرنیم/ایمیل داخلی کار می‌کنیم).
-- ============================================================

-- ---------- پروفایل کاربران (نقش‌ها) ----------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique,
  full_name  text,
  role       text not null default 'staff',   -- admin | accountant | staff
  active     boolean default true,
  created_at timestamptz default now()
);

-- نقش کاربر فعلی (SECURITY DEFINER تا RLS را دور بزند و حلقه نسازد)
create or replace function public.my_role()
returns text language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
grant execute on function public.my_role() to authenticated, anon;

-- با ساخت هر کاربر Auth، یک پروفایل بساز.
-- اولین کاربرِ ثبت‌شده به‌صورت خودکار «مدیر» می‌شود؛ بقیه «نیرو».
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if (select count(*) from public.profiles) = 0 then r := 'admin'; else r := 'staff'; end if;
  insert into public.profiles (id, username, full_name, role)
  values (new.id, split_part(new.email, '@', 1), split_part(new.email, '@', 1), r)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

alter table profiles enable row level security;
drop policy if exists "profiles_self"  on profiles;
drop policy if exists "profiles_admin" on profiles;
create policy "profiles_self"  on profiles for select using (id = auth.uid());
create policy "profiles_admin" on profiles for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ============================================================
--  قفل کردن جدول‌های موجود بر اساس نقش
-- ============================================================
-- محصولات و سفارش‌ها: فقط مدیر و حسابدار
drop policy if exists "public_products" on products;
create policy "products_rw" on products for all
  using (public.my_role() in ('admin','accountant'))
  with check (public.my_role() in ('admin','accountant'));

drop policy if exists "public_orders" on orders;
create policy "orders_rw" on orders for all
  using (public.my_role() in ('admin','accountant'))
  with check (public.my_role() in ('admin','accountant'));

-- اقلام: خواندن برای هر کاربر واردشده (برای دکمهٔ «لیست خرید» چت)؛ تغییر فقط مدیر/حسابدار
drop policy if exists "public_inventory" on inventory;
drop policy if exists "inventory_read"   on inventory;
drop policy if exists "inventory_write"  on inventory;
drop policy if exists "inventory_update" on inventory;
drop policy if exists "inventory_delete" on inventory;
create policy "inventory_read"   on inventory for select using (auth.uid() is not null);
create policy "inventory_write"  on inventory for insert with check (public.my_role() in ('admin','accountant'));
create policy "inventory_update" on inventory for update using (public.my_role() in ('admin','accountant'));
create policy "inventory_delete" on inventory for delete using (public.my_role() in ('admin','accountant'));

-- ============================================================
--  چت: فقط مدیر و نیرو (نه حسابدار)
-- ============================================================
alter table messages add column if not exists sender_uid uuid;

drop policy if exists "public_channels" on channels;
create policy "channels_read"  on channels for select using (public.my_role() in ('admin','staff'));
create policy "channels_admin" on channels for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

drop policy if exists "public_messages" on messages;
create policy "messages_read"   on messages for select using (public.my_role() in ('admin','staff'));
create policy "messages_insert" on messages for insert
  with check (sender_uid = auth.uid() and public.my_role() in ('admin','staff'));
create policy "messages_delete" on messages for delete
  using (sender_uid = auth.uid() or public.my_role() = 'admin');

-- باکت رسانهٔ چت: خواندن عمومی، آپلود فقط کاربر واردشده
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
  amount     numeric default 0,     -- تومان
  note       text,
  created_by uuid,
  created_at timestamptz default now()
);
create index if not exists expenses_date_idx on expenses (exp_date);
alter table expenses enable row level security;
drop policy if exists "expenses_admin" on expenses;
create policy "expenses_admin" on expenses for all
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- ============================================================
--  حضور و غیاب (هر نیرو فقط مال خودش؛ مدیر همه)
-- ============================================================
create table if not exists attendance (
  id         bigint generated always as identity primary key,
  staff_uid  uuid,
  staff_name text,
  work_date  date default current_date,
  clock_in   timestamptz,
  clock_out  timestamptz,
  note       text,
  created_at timestamptz default now()
);
create index if not exists attendance_uid_idx on attendance (staff_uid, work_date);
alter table attendance enable row level security;
drop policy if exists "attendance_select" on attendance;
drop policy if exists "attendance_insert" on attendance;
drop policy if exists "attendance_update" on attendance;
drop policy if exists "attendance_delete" on attendance;
create policy "attendance_select" on attendance for select
  using (staff_uid = auth.uid() or public.my_role() = 'admin');
create policy "attendance_insert" on attendance for insert
  with check (staff_uid = auth.uid());
create policy "attendance_update" on attendance for update
  using (staff_uid = auth.uid() or public.my_role() = 'admin');
create policy "attendance_delete" on attendance for delete
  using (public.my_role() = 'admin');

-- ============================================================
--  جبران: کاربرانی که پیش از اجرای این اسکریپت ساخته شده‌اند
--  (پروفایل برایشان بساز، قدیمی‌ترین را مدیر کن، و تأییدشان کن)
-- ============================================================
insert into public.profiles (id, username, full_name, role)
select u.id, split_part(u.email,'@',1), split_part(u.email,'@',1), 'staff'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

update public.profiles set role = 'admin'
where id = (select id from auth.users order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

-- تأیید کاربرانِ تأییدنشده (چون با ایمیل داخلی کار می‌کنیم)
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;
