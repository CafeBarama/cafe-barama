-- ============================================================
--  دادن دسترسی «سفارش‌گیری» به نقش نیرو
--  این را یک‌بار در Supabase > SQL Editor اجرا کنید.
-- ============================================================
drop policy if exists "products_rw" on products;
create policy "products_rw" on products for all
  using (public.cafe_role() in ('admin','accountant','staff'))
  with check (public.cafe_role() in ('admin','accountant','staff'));

drop policy if exists "orders_rw" on orders;
create policy "orders_rw" on orders for all
  using (public.cafe_role() in ('admin','accountant','staff'))
  with check (public.cafe_role() in ('admin','accountant','staff'));

drop policy if exists "inventory_write"  on inventory;
drop policy if exists "inventory_update" on inventory;
drop policy if exists "inventory_delete" on inventory;
create policy "inventory_write"  on inventory for insert with check (public.cafe_role() in ('admin','accountant','staff'));
create policy "inventory_update" on inventory for update using (public.cafe_role() in ('admin','accountant','staff'));
create policy "inventory_delete" on inventory for delete using (public.cafe_role() in ('admin','accountant','staff'));
