-- ============================================================
--  حضور و غیاب: خروج خودکار اگر نیرو یادش رفت
--  اگر تا ۱ ساعت بعد از پایان شیفت خروج نزند، خروجش روی
--  ساعت پایان شیفت ثبت می‌شود:  شیفت صبح ۱۶:۰۰ ، شیفت عصر ۲۳:۰۰.
--  (تشخیص شیفت از ساعت ورود: قبل از ۱۵ = صبح، وگرنه عصر — به وقت تهران)
--  یک‌بار در Supabase > SQL Editor اجرا کنید.
-- ============================================================
create or replace function public.cafe_auto_checkout()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record; d date; h int; endt timestamptz; v_note text; n int := 0;
begin
  for r in select * from cafe_attendance where clock_out is null loop
    d := (r.clock_in at time zone 'Asia/Tehran')::date;
    h := extract(hour from (r.clock_in at time zone 'Asia/Tehran'));
    if h < 15 then
      endt   := (d::text || ' 16:00:00')::timestamp at time zone 'Asia/Tehran';
      v_note := 'خروج خودکار (پایان شیفت صبح)';
    else
      endt   := (d::text || ' 23:00:00')::timestamp at time zone 'Asia/Tehran';
      v_note := 'خروج خودکار (پایان شیفت عصر)';
    end if;
    if now() > endt + interval '1 hour' then
      update cafe_attendance
        set clock_out = endt,
            note = case when coalesce(r.note,'')='' then v_note else r.note || ' | ' || v_note end
        where id = r.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

grant execute on function public.cafe_auto_checkout() to authenticated;

-- ---------- زمان‌بند خودکار هر ۳۰ دقیقه (اگر pg_cron در دسترس باشد) ----------
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'cafe-auto-checkout') then
    perform cron.unschedule('cafe-auto-checkout');
  end if;
  perform cron.schedule('cafe-auto-checkout', '*/30 * * * *', 'select public.cafe_auto_checkout();');
exception when others then
  raise notice 'pg_cron فعال نشد (%). تابع ساخته شد و هنگام باز شدن اپ هم اجرا می‌شود.', sqlerrm;
end $$;
