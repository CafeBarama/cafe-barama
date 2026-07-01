-- ============================================================
--  برگرداندن: سفارش‌گیری فقط مدیر + حسابدار (نیرو دیگر دسترسی ندارد)
--  یک‌بار در Supabase > SQL Editor اجرا کنید.
-- ============================================================
drop policy if exists "products_rw" on products;
create policy "products_rw" on products for all
  using (public.cafe_role() in ('admin','accountant'))
  with check (public.cafe_role() in ('admin','accountant'));

drop policy if exists "orders_rw" on orders;
create policy "orders_rw" on orders for all
  using (public.cafe_role() in ('admin','accountant'))
  with check (public.cafe_role() in ('admin','accountant'));

-- خواندن اقلام برای همهٔ کاربران واردشده باقی می‌ماند (برای دکمهٔ «لیست خرید» چت)،
-- ولی تغییر اقلام فقط مدیر + حسابدار
drop policy if exists "inventory_write"  on inventory;
drop policy if exists "inventory_update" on inventory;
drop policy if exists "inventory_delete" on inventory;
create policy "inventory_write"  on inventory for insert with check (public.cafe_role() in ('admin','accountant'));
create policy "inventory_update" on inventory for update using (public.cafe_role() in ('admin','accountant'));
create policy "inventory_delete" on inventory for delete using (public.cafe_role() in ('admin','accountant'));
