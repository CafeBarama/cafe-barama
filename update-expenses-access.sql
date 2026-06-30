-- ============================================================
--  دسترسی هزینه‌ها: مدیر + حسابدار (نیرو خیر)
--  حسابدار از سفارش‌گیری هزینه ثبت می‌کند؛ مدیر در حسابداری iPro می‌بیند.
--  یک‌بار در Supabase > SQL Editor اجرا کنید.
-- ============================================================
drop policy if exists "expenses_admin" on expenses;
drop policy if exists "expenses_rw"    on expenses;
create policy "expenses_rw" on expenses for all
  using (public.cafe_role() in ('admin','accountant'))
  with check (public.cafe_role() in ('admin','accountant'));
