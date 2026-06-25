-- ============================================================
--  کافه باراما — ساختار دیتابیس (Supabase)
--  این فایل را یک‌بار در Supabase > SQL Editor اجرا کنید.
-- ============================================================

-- ---------- جدول محصولات ----------
create table if not exists products (
  id          bigint generated always as identity primary key,
  name        text not null,          -- نام فارسی
  name_en     text,                   -- نام انگلیسی
  category    text,                   -- دسته‌بندی
  price       numeric default 0,      -- قیمت (تومان)
  calories    numeric,                -- کالری
  protein     numeric,                -- پروتئین (گرم)
  carbs       numeric,                -- کربوهیدرات (گرم)
  fat         numeric,                -- چربی (گرم)
  description text,                   -- توضیح کوتاه
  active      boolean default true,   -- فعال/غیرفعال
  created_at  timestamptz default now()
);

-- ---------- جدول سفارش‌ها / مشتری‌ها ----------
create table if not exists orders (
  id            bigint generated always as identity primary key,
  order_date    date default current_date,   -- تاریخ سفارش
  customer_name text not null,               -- نام مشتری
  phone         text,                        -- تلفن
  address       text,                        -- آدرس
  items         jsonb default '[]'::jsonb,   -- محصولات سفارش [{name, qty, price}]
  total         numeric default 0,           -- جمع کل (تومان)
  notes         text,                        -- یادداشت
  snapp_rating  numeric,                     -- امتیاز ثبت‌شده در اسنپ (۱ تا ۵)
  snapp_comment text,                        -- توضیحات امتیاز اسنپ
  created_at    timestamptz default now()
);

-- اگر جدول orders از قبل ساخته شده، این دو ستون را اضافه می‌کند:
alter table orders add column if not exists snapp_rating  numeric;
alter table orders add column if not exists snapp_comment text;

create index if not exists orders_date_idx  on orders (order_date);
create index if not exists orders_phone_idx on orders (phone);
create index if not exists orders_name_idx  on orders (customer_name);

-- ---------- دسترسی عمومی (با کلید publishable) ----------
alter table products enable row level security;
alter table orders   enable row level security;

drop policy if exists "public_products" on products;
drop policy if exists "public_orders"   on orders;

create policy "public_products" on products for all using (true) with check (true);
create policy "public_orders"   on orders   for all using (true) with check (true);

-- ============================================================
--  محصولات کافه باراما (برگرفته از cafebarama.com)
--  قیمت‌ها به تومان. کالری فقط برای مواردی که سایت داشت پر شده.
-- ============================================================
insert into products (name, name_en, category, price, calories, description) values
('ماکا زنجبیل',                  'Maca Ginger Boost',              'نوشیدنی فانکشنال', 195000, 25,  'گرم، سبک و متابولیسم‌محور'),
('پاور ماکا',                    'Power Maca',                     'نوشیدنی فانکشنال', 328000, null,'انرژی پایدار قبل از ورزش'),
('نیترو توت‌فرنگی',              'Strawberry Nitro Cold Brew',     'نوشیدنی فانکشنال', 425000, 12,  'طعم میوه‌ای و انرژی ملایم'),
('نیترو کلدبرو',                 'Nitro Cold Brew',                'نوشیدنی فانکشنال', 368000, 0,   'بدون کالری و مناسب فستینگ'),
('سالاد ماربلین رژیمی',          'Marbelline Healthy Salad',       'سالاد',            395000, null,'کم‌کالری و چربی سالم'),
('پریمر سالاد رژیمی',            'Premier Healthy Salad',          'سالاد',            635000, null,'پروتئینی برای عضله‌سازی'),
('سالاد سزار رژیمی',             'Healthy Caesar Salad',           'سالاد',            615000, null,'پروتئین بالا و کلاسیک'),
('پاستا رژیمی پستو',             'Healthy Pesto Pasta',            'پاستا',            545000, null,'پروتئینی و سیرکننده'),
('لمون چیکن رژیمی',              'Healthy Lemon Chicken',          'وعده پروتئینی',    540000, null,'طعم تازه و کالری کنترل‌شده'),
('چاینیز چیکن رژیمی',            'Healthy Chinese Chicken',        'وعده پروتئینی',    575000, null,'طعم آسیایی و پروتئینی'),
('چیکن رول رژیمی',               'Healthy Chicken Roll',           'رول',              515000, null,'پرپروتئین و سیرکننده'),
('هات‌داگ ایتالیایی رژیمی',      'Italian Healthy Hot Dog',        'ساندویچ و رول',    595000, null,'سالم با طعم ایتالیایی'),
('ساندویچ رژیمی چیکن پستو',      'Pesto Chicken Healthy Sandwich', 'ساندویچ و رول',    540000, null,'مرغ گریل‌شده و پستوی تازه'),
('ساندویچ رژیمی چیکن باربیکیو',  'BBQ Chicken Healthy Sandwich',   'ساندویچ و رول',    625000, null,'پروتئین بالا و خوش‌طعم'),
('تست رژیمی حمص',                'Hummus Healthy Toast',           'تست و پیتا',       238000, null,'گیاهی و سرشار از فیبر'),
('تست رژیمی بادام زمینی و موز',  'Peanut Butter Banana Toast',     'تست و پیتا',       228000, null,'انرژی موز و بادام زمینی'),
('تست رژیمی پرو پروتئین',        'Pro Protein Toast',              'تست و پیتا',       320000, null,'قدرت پروتئین و سیرکننده'),
('اوتمیل سیب و دارچین',          'Apple Cinnamon Oatmeal',         'صبحانه سالم',      248000, null,'عطر کلاسیک سیب و دارچین'),
('اوتمیل رژیمی پسته',            'Pistachio Oatmeal',              'صبحانه سالم',      298000, null,'لطیف و خوش‌طعم'),
('اوتمیل رژیمی بادام زمینی',     'Peanut Oatmeal',                 'صبحانه سالم',      258000, null,'انرژی پایدار'),
('اوتمیل رژیمی بادام',           'Almond Oatmeal',                 'صبحانه سالم',      285000, null,'کامل و کم‌کالری'),
('شیک نوتلا بادام زمینی',        'Nutella Peanut Shake',           'شیک و شکلات',      295000, null,''),
('شیر لوتوس اورجینال',           'Original Lotus Milk',            'شیک و شکلات',      250000, null,'شیرین، لطیف و آرام‌بخش'),
('شیک کره بادام زمینی',          'Peanut Butter Shake',            'شیک و شکلات',      263636, null,'غلیظ و کرمی'),
('وافل بستنی',                   'Ice Cream Waffle',               'وافل',             320000, null,'وافل گرم با دو اسکوپ بستنی وانیل'),
('سوپر وافل',                    'Super Waffle',                   'وافل',             350000, null,'با بستنی، میوه و شکلات'),
('تست لبنانی مرغ پستو و پنیر',   'Lebanese Pesto Chicken Toast',   'تست و پیتا',       575000, null,'تُرد با مرغ پستو'),
('وانیل کافی (بدون شکر)',        'Vanilla Coffee Sugar-Free',      'نوشیدنی اسپرسو',   298000, null,'بدون شکر و سبک'),
('وانیل کافی',                   'Vanilla Coffee',                 'نوشیدنی اسپرسو',   215000, null,'ملایم و کرمی'),
('چاکلیت کافی',                  'Chocolate Coffee',               'نوشیدنی اسپرسو',   288000, null,'کرمی و خنک'),
('پاپ کورن کافی',                'Popcorn Coffee',                 'نوشیدنی اسپرسو',   288000, null,'شیرین ترکیبی'),
('آیریش کافی',                   'Irish Coffee',                   'نوشیدنی اسپرسو',   288000, null,'بالانس، کلاسیک و انرژی‌بخش'),
('تست پنیر گردو زیتون',          'Cheese Walnut Olive Toast',      'تست و پیتا',       288000, null,'سبک و سالم'),
('املت رولی ایرانی',             'Iranian Omelet Roll',            'صبحانه سالم',      298000, null,'تازه و خوش‌رنگ'),
('سوسیس تخم مرغ رولی',           'Sausage Egg Roll',               'رول',              375000, null,'سریع و سیرکننده'),
('آب معدنی چشمه ناز ۳۳۰',        'Cheshmeh Naz Mineral Water',     'نوشیدنی',          20000,  0,   'طبیعی و باکیفیت'),
('پنکیک موز شکلات',              'Banana Chocolate Pancake',       'پنکیک',            335000, null,'نرم با طعمی شیرین'),
('سان برو',                      'Sun Brow',                       'نوشیدنی',          380000, null,''),
('تست لبنانی اسفناج پنیر',       'Lebanese Spinach Cheese Toast',  'تست و پیتا',       265000, null,'گیاهی و گرم'),
('تست چیکن اسفناج',              'Chicken Spinach Toast',          'تست و پیتا',       585000, null,''),
('شیک توت‌فرنگی و نوتلا',        'Strawberry Nutella Shake',       'شیک و شکلات',      295455, null,'ترکیبی دلبر و شیرین'),
('نوشیدنی فرش پاپ',              'Fresh Pop Beverage',             'نوشیدنی',          120000, null,'گازدار سبک و طبیعی'),
('شیک اورئو اورجینال',           'Original Oreo Shake',            'شیک و شکلات',      263636, null,'دسر مورد علاقه'),
('موکتل مارگاریتا توت فرنگی',    'Strawberry Margarita Mocktail',  'موکتل و اسموتی',   228000, null,'ترش‌وشیرین و خنک'),
('اسموتی ملونی ۵۰۰',            'Melon Smoothie',                 'موکتل و اسموتی',   235000, null,'خنک و آبرسان'),
('پیتا چیکن هالوپینو',           'Chicken Jalapeno Pita',          'تست و پیتا',       550000, null,'تند و دودی'),
('پاستا چیکن پستو',              'Chicken Pesto Pasta',            'پاستا',            585000, null,'با قارچ و پارمسان'),
('پاستا چیکن آلفردو تنوری',      'Grilled Chicken Alfredo Pasta',  'پاستا',            595000, null,'سس خامه‌ای و دود'),
('شیر نوتلا',                    'Nutella Milk',                   'شیک و شکلات',      250000, null,'شکلاتی، خامه‌ای و دل‌چسب'),
('پنکیک بادام زمینی و موز',      'Peanut Butter Banana Pancake',   'پنکیک',            395000, null,'مقوی و سیرکننده');
