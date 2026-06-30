-- ============================================================
--  اجازهٔ دسترسی iPro به حساب مدیرِ کافه (barama@barama.local)
--  افزایشی است: مالک قبلی (habib@ldora.org) همچنان دسترسی دارد.
--  هیچ داده‌ای پاک نمی‌شود — فقط سیاست دسترسی به‌روز می‌شود.
--  یک‌بار در Supabase > SQL Editor اجرا کنید.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'employees','payments','fines','food_usage','insurance',
    'employee_files','salary_changes','attendance','leave_requests'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_all on %I', t);
    execute format($f$create policy owner_all on %I for all to authenticated
       using ((auth.jwt()->>'email') in ('habib@ldora.org','barama@barama.local'))
       with check ((auth.jwt()->>'email') in ('habib@ldora.org','barama@barama.local'))$f$, t);
  end loop;
end $$;

-- باکت فایل‌های HR
drop policy if exists owner_hr_files on storage.objects;
create policy owner_hr_files on storage.objects for all to authenticated
  using (bucket_id = 'hr-files' and (auth.jwt()->>'email') in ('habib@ldora.org','barama@barama.local'))
  with check (bucket_id = 'hr-files' and (auth.jwt()->>'email') in ('habib@ldora.org','barama@barama.local'));
