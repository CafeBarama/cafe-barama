-- ============================================================
--  حضور و غیاب کافه: محدودیت مکانی شعاع ۵۰ متری (سمت سرور)
--  ثبت ورود/خروج فقط داخل ۵۰ متری مختصات کافه مجاز است.
--  یک‌بار در Supabase > SQL Editor اجرا کنید.
-- ============================================================

-- ستون‌های مختصات
alter table cafe_attendance add column if not exists in_lat  double precision;
alter table cafe_attendance add column if not exists in_lng  double precision;
alter table cafe_attendance add column if not exists out_lat double precision;
alter table cafe_attendance add column if not exists out_lng double precision;

-- ثبت ورود با بررسی موقعیت (SECURITY DEFINER تا قابل دور زدن نباشد)
create or replace function public.cafe_att_check_in(p_lat double precision, p_lng double precision)
returns json language plpgsql security definer set search_path = public as $$
declare
  c_lat    constant double precision := 29.633853437124454;
  c_lng    constant double precision := 52.47678888090585;
  c_radius constant double precision := 50;
  dist double precision; nm text;
begin
  if coalesce(public.cafe_role(),'') not in ('admin','staff') then raise exception 'دسترسی ندارید'; end if;
  if p_lat is null or p_lng is null then raise exception 'NO_LOCATION'; end if;
  dist := 2*6371000*asin(sqrt(
     power(sin(radians(p_lat - c_lat)/2),2) +
     cos(radians(c_lat))*cos(radians(p_lat))*power(sin(radians(p_lng - c_lng)/2),2)));
  if dist > c_radius then raise exception 'OUT_OF_RANGE:%', round(dist); end if;
  if exists (select 1 from cafe_attendance where staff_uid = auth.uid() and clock_out is null) then
    raise exception 'ALREADY_IN';
  end if;
  select full_name into nm from profiles where id = auth.uid();
  insert into cafe_attendance(staff_uid, staff_name, work_date, clock_in, in_lat, in_lng)
    values(auth.uid(), coalesce(nm,''), (now() at time zone 'Asia/Tehran')::date, now(), p_lat, p_lng);
  return json_build_object('ok', true, 'distance', round(dist));
end $$;

-- ثبت خروج با بررسی موقعیت
create or replace function public.cafe_att_check_out(p_lat double precision, p_lng double precision)
returns json language plpgsql security definer set search_path = public as $$
declare
  c_lat    constant double precision := 29.633853437124454;
  c_lng    constant double precision := 52.47678888090585;
  c_radius constant double precision := 50;
  dist double precision; rec record;
begin
  if coalesce(public.cafe_role(),'') not in ('admin','staff') then raise exception 'دسترسی ندارید'; end if;
  if p_lat is null or p_lng is null then raise exception 'NO_LOCATION'; end if;
  dist := 2*6371000*asin(sqrt(
     power(sin(radians(p_lat - c_lat)/2),2) +
     cos(radians(c_lat))*cos(radians(p_lat))*power(sin(radians(p_lng - c_lng)/2),2)));
  if dist > c_radius then raise exception 'OUT_OF_RANGE:%', round(dist); end if;
  select * into rec from cafe_attendance where staff_uid = auth.uid() and clock_out is null order by id desc limit 1;
  if not found then raise exception 'NO_OPEN'; end if;
  update cafe_attendance set clock_out = now(), out_lat = p_lat, out_lng = p_lng where id = rec.id;
  return json_build_object('ok', true, 'distance', round(dist));
end $$;

grant execute on function public.cafe_att_check_in(double precision,double precision)  to authenticated;
grant execute on function public.cafe_att_check_out(double precision,double precision) to authenticated;

-- ثبت مستقیم (بدون تابع) فقط برای مدیر؛ نیرو باید از تابع (با موقعیت) استفاده کند
drop policy if exists "cafe_att_insert" on cafe_attendance;
drop policy if exists "cafe_att_update" on cafe_attendance;
create policy "cafe_att_insert" on cafe_attendance for insert with check (public.cafe_role() = 'admin');
create policy "cafe_att_update" on cafe_attendance for update using (public.cafe_role() = 'admin');
