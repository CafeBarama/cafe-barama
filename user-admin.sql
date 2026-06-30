-- ============================================================
--  تابع حذف کامل کاربرِ کافه (فقط مدیر) — برای مدیریت کاربران
--  حساب Auth و پروفایل را با هم پاک می‌کند تا نام‌کاربری آزاد شود.
--  فقط حساب‌های «@barama.local» و فقط توسط مدیر.
--  یک‌بار در Supabase > SQL Editor اجرا کنید.
-- ============================================================
create or replace function public.cafe_delete_user(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.cafe_role() <> 'admin' then
    raise exception 'فقط مدیر می‌تواند کاربر حذف کند';
  end if;
  if uid = auth.uid() then
    raise exception 'حذف حساب خودتان ممکن نیست';
  end if;
  -- فقط حساب‌های کافه؛ پروفایل با cascade پاک می‌شود
  delete from auth.users
  where id = uid and email like '%@barama.local';
end $$;

grant execute on function public.cafe_delete_user(uuid) to authenticated;
