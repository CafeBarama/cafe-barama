/* ============================================================
   کافه باراما — منطق برنامه
   ============================================================ */

// ---------- اتصال به Supabase ----------
let db = null;
const configured = SUPABASE_KEY && !SUPABASE_KEY.startsWith("PASTE_");
if (configured) {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  document.getElementById("configBanner").style.display = "block";
}

// ---------- ابزارهای کمکی ----------
const $ = (id) => document.getElementById(id);
const fa = (n) => (n == null || isNaN(n) ? "۰" : Number(n).toLocaleString("fa-IR"));
const toFa = (s) => String(s ?? "").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
let TOAST_T;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(TOAST_T); TOAST_T = setTimeout(() => t.classList.remove("show"), 2200);
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
// تبدیل تاریخ میلادی (ISO) به شمسی
function jalali(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d)) return toFa(iso);
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
  } catch (e) { return toFa(iso); }
}
// امروز به شمسی (مقدار پیش‌فرض کادر تاریخ)
function todayShamsiStr() {
  try { const d=new Date(); const j=jalaali.toJalaali(d.getFullYear(), d.getMonth()+1, d.getDate());
    return `${j.jy}/${String(j.jm).padStart(2,"0")}/${String(j.jd).padStart(2,"0")}`;
  } catch (e) { return todayISO(); }
}
// تاریخ شمسی واردشده → میلادی (ISO) برای ذخیره
function shamsiToISO(s) {
  if (!s) return todayISO();
  s = String(s).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const m = s.match(/(\d{3,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!m || typeof jalaali === "undefined") return todayISO();
  const g = jalaali.toGregorian(+m[1], +m[2], +m[3]);
  return `${g.gy}-${String(g.gm).padStart(2,"0")}-${String(g.gd).padStart(2,"0")}`;
}

let PRODUCTS = [];   // کش محصولات
let CART = [];       // اقلام سفارش جاری

// ---------- تب‌ها ----------
document.querySelectorAll("#nav button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("#nav button").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    $("tab-" + b.dataset.tab).classList.add("active");
    if (b.dataset.tab === "orders") loadOrders();
    if (b.dataset.tab === "menu") renderMenu();
  };
});

/* ============================================================
   محصولات — بارگذاری و کش
   ============================================================ */
async function loadProducts() {
  if (!db) return;
  const { data, error } = await db.from("products").select("*").order("category").order("name");
  if (error) { toast("خطا در بارگذاری محصولات"); console.error(error); return; }
  PRODUCTS = data || [];
  fillProductSelect();
  renderProductsTable();
  fillCategoryList();
}

function fillProductSelect() {
  // لیست پیشنهاد برای جستجو با تایپ کردن نام محصول
  $("productsList").innerHTML = PRODUCTS.filter(p => p.active !== false)
    .map(p => `<option value="${p.name}">${fa(p.price)} تومان</option>`).join("");
}

function fillCategoryList() {
  const cats = [...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];
  $("catList").innerHTML = cats.map(c => `<option value="${c}">`).join("");
}

/* ============================================================
   مشتری‌های قبلی — تکمیل خودکار نام
   ============================================================ */
let CUSTOMERS = [];
async function loadCustomers() {
  if (!db) return;
  const { data, error } = await db.from("orders")
    .select("customer_name, phone, address").order("id", { ascending:false });
  if (error) { console.error(error); return; }
  const map = new Map();
  (data || []).forEach(r => {
    const name = (r.customer_name || "").trim();
    if (!name) return;
    if (!map.has(name)) map.set(name, { name, phone:r.phone||"", address:r.address||"" });
    else {
      const c = map.get(name);                 // قدیمی‌تر؛ فقط فیلدهای خالی را پر کن
      if (!c.phone && r.phone) c.phone = r.phone;
      if (!c.address && r.address) c.address = r.address;
    }
  });
  CUSTOMERS = [...map.values()];
  $("customersList").innerHTML = CUSTOMERS.map(c => `<option value="${c.name}">`).join("");
}

// انتخاب مشتری قبلی → پر کردن خودکار تلفن و آدرس (اگر خالی باشند)
$("o_name").addEventListener("input", () => {
  const c = CUSTOMERS.find(x => x.name === $("o_name").value.trim());
  if (!c) return;
  if (!$("o_phone").value && c.phone) $("o_phone").value = c.phone;
  if (!$("o_address").value && c.address) $("o_address").value = c.address;
});

/* ============================================================
   ثبت سفارش
   ============================================================ */
$("o_date").value = todayShamsiStr();

$("addItemBtn").onclick = () => {
  const name = $("o_product").value.trim();
  const qty = Math.max(1, +$("o_qty").value || 1);
  const p = PRODUCTS.find(x => x.name === name);
  if (!p) return toast("محصول را از لیست انتخاب کنید");
  const existing = CART.find(c => c.id === p.id);
  if (existing) existing.qty += qty;
  else CART.push({ id: p.id, name: p.name, price: +p.price || 0, qty,
                   calories:+p.calories||0, protein:+p.protein||0, carbs:+p.carbs||0, fat:+p.fat||0, fiber:+p.fiber||0 });
  $("o_product").value = ""; $("o_qty").value = 1;
  renderCart();
};

// ارزش غذایی یک پرس (تک‌واحدی)
function itemNut(c) {
  const p = [];
  if (c.calories) p.push(`کالری ${fa(c.calories)}`);
  if (c.protein)  p.push(`پروتئین ${fa(c.protein)}گ`);
  if (c.carbs)    p.push(`کربوهیدرات ${fa(c.carbs)}گ`);
  if (c.fat)      p.push(`چربی ${fa(c.fat)}گ`);
  if (c.fiber)    p.push(`فیبر ${fa(c.fiber)}گ`);
  return p.length ? p.join(" • ") : "بدون اطلاعات ارزش غذایی";
}

function renderCart() {
  const box = $("itemsList");
  if (!CART.length) { box.innerHTML = `<div class="muted" style="padding:6px 0">هنوز محصولی اضافه نشده.</div>`; }
  else {
    // هر واحد یک ردیف جدا (اگر تعداد ۵ باشد، ۵ ردیف)
    const rows = [];
    CART.forEach((c, i) => {
      for (let u = 0; u < c.qty; u++) {
        rows.push(`
        <div class="item-line" style="flex-direction:column;align-items:stretch;gap:6px">
          <div style="display:flex;align-items:center;gap:10px">
            <b style="flex:1">${c.name}</b>
            <span class="muted">${fa(c.price)} ت</span>
            <button class="btn danger sm" onclick="removeUnit(${i})">حذف</button>
          </div>
          <div style="font-size:12px;color:var(--muted)">${itemNut(c)}</div>
        </div>`);
      }
    });
    box.innerHTML = rows.join("");
  }
  const price = CART.reduce((a, c) => a + c.price * c.qty, 0);
  $("t_price").textContent = fa(price) + " تومان";
}
// حذف یک واحد از یک محصول
window.removeUnit = (i) => {
  if (CART[i]) { CART[i].qty--; if (CART[i].qty <= 0) CART.splice(i, 1); }
  renderCart();
};
window.removeItem = (i) => { CART.splice(i, 1); renderCart(); };

function orderTotalPrice() { return CART.reduce((a, c) => a + c.price * c.qty, 0); }

function clearOrderForm() {
  CART = []; renderCart();
  $("o_name").value = ""; $("o_phone").value = ""; $("o_address").value = "";
  $("o_notes").value = ""; $("o_date").value = todayShamsiStr();
  $("o_snapp_rating").value = ""; $("o_snapp_comment").value = "";
}
$("clearOrderBtn").onclick = clearOrderForm;

$("saveOrderBtn").onclick = async () => {
  if (!db) return toast("ابتدا کلید دیتابیس را تنظیم کنید");
  const name = $("o_name").value.trim();
  if (!name) return toast("نام مشتری را وارد کنید");
  if (!CART.length) return toast("حداقل یک محصول اضافه کنید");
  const payload = {
    order_date: shamsiToISO($("o_date").value),
    customer_name: name,
    phone: $("o_phone").value.trim(),
    address: $("o_address").value.trim(),
    items: CART.map(c => ({ name:c.name, qty:c.qty, price:c.price,
            calories:c.calories, protein:c.protein, carbs:c.carbs, fat:c.fat, fiber:c.fiber })),
    total: orderTotalPrice(),
    notes: $("o_notes").value.trim(),
    snapp_rating: $("o_snapp_rating").value ? Number($("o_snapp_rating").value) : null,
    snapp_comment: $("o_snapp_comment").value.trim()
  };
  const { error } = await db.from("orders").insert(payload);
  if (error) { console.error(error); return toast("خطا در ثبت سفارش"); }
  toast("✓ سفارش ثبت شد");
  clearOrderForm();
  loadCustomers();
};

// ---------- ساخت متن سفارش برای واتساپ ----------
function orderText() {
  const name = $("o_name").value.trim();
  let s = `سلام ${name ? name : ""}\nسفارش شما در کافه باراما:\n\n`;
  CART.forEach(c => { s += `• ${c.name} ×${toFa(c.qty)} — ${toFa((c.price*c.qty).toLocaleString())} تومان\n`; });
  s += `\nجمع کل: ${toFa(orderTotalPrice().toLocaleString())} تومان`;
  const cal = CART.reduce((a,c)=>a+c.calories*c.qty,0);
  if (cal) s += `\nکالری کل: ${toFa(cal)} ✦`;
  s += `\n\nبا تشکر ☕`;
  return s;
}
$("waOrderBtn").onclick = () => {
  if (!CART.length) return toast("سفارش خالی است");
  const ph = $("o_phone").value.trim();
  if (!ph) return toast("برای ارسال به مشتری، شمارهٔ مشتری را وارد کنید");
  openWhatsApp(ph, orderText());   // ارسال به شمارهٔ همین مشتری
};

function normalizePhone(phone) {
  let p = (phone || "").replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("00")) p = p.slice(2);            // پیشوند بین‌المللی 00 → حذف
  else if (p.startsWith("0")) p = "98" + p.slice(1); // شماره ایران 09xx → 989xx
  return p;
}

function openWhatsApp(phone, text) {
  // اگر شماره داده نشد، شمارهٔ پیش‌فرض config.js استفاده می‌شود
  let p = normalizePhone(phone) || normalizePhone(typeof DEFAULT_WHATSAPP !== "undefined" ? DEFAULT_WHATSAPP : "");
  const base = p ? `https://wa.me/${p}` : `https://wa.me/`;
  window.open(`${base}?text=${encodeURIComponent(text)}`, "_blank");
}

/* ============================================================
   لیست سفارش‌ها + فیلتر
   ============================================================ */
let LAST_ORDERS = [];
async function loadOrders() {
  if (!db) return;
  let q = db.from("orders").select("*").order("order_date", { ascending:false }).order("id", { ascending:false });
  const from = $("f_from").value, to = $("f_to").value;
  if (from) q = q.gte("order_date", from);
  if (to)   q = q.lte("order_date", to);
  const { data, error } = await q;
  if (error) { console.error(error); return toast("خطا در بارگذاری سفارش‌ها"); }

  let rows = data || [];
  const txt = $("f_text").value.trim().toLowerCase();
  const prod = $("f_product").value.trim().toLowerCase();
  if (txt)  rows = rows.filter(r => (r.customer_name||"").toLowerCase().includes(txt) || (r.phone||"").includes(txt));
  if (prod) rows = rows.filter(r => (r.items||[]).some(it => (it.name||"").toLowerCase().includes(prod)));

  LAST_ORDERS = rows;
  $("ordersEmpty").style.display = rows.length ? "none" : "block";

  // گروه‌بندی بر اساس شماره موبایل (و اگر نبود، نام)
  const groups = {};
  rows.forEach(r => {
    const phoneKey = (r.phone||"").replace(/\D/g,"");
    const key = phoneKey || ("نام:"+(r.customer_name||"").trim());
    if (!groups[key]) groups[key] = { name:r.customer_name||"—", phone:r.phone||"", orders:[], total:0 };
    if ((!groups[key].name || groups[key].name==="—") && r.customer_name) groups[key].name = r.customer_name;
    if (!groups[key].phone && r.phone) groups[key].phone = r.phone;
    groups[key].orders.push(r);
    groups[key].total += (+r.total||0);
  });
  const list = Object.values(groups).sort((a,b)=> b.orders.length - a.orders.length);
  $("ordersCount").textContent = `${fa(list.length)} مشتری • ${fa(rows.length)} سفارش`;

  $("ordersList").innerHTML = list.map((g,gi)=>{
    const last = g.orders[0];
    return `<div style="border:1px solid var(--line);border-radius:14px;margin-bottom:10px;overflow:hidden">
      <div onclick="toggleCust(${gi})" style="display:flex;align-items:center;gap:12px;padding:14px;cursor:pointer">
        <span id="cust-arrow-${gi}" style="color:var(--muted);font-size:12px">◀</span>
        <div style="flex:1">
          <b>${g.name}</b>
          <div class="muted" style="font-size:12.5px">${toFa(g.phone||"—")} • ${fa(g.orders.length)} سفارش • مجموع ${fa(g.total)} ت</div>
        </div>
        <span class="muted" style="font-size:12px">آخرین: ${jalali(last&&last.order_date)}</span>
      </div>
      <div id="cust-body-${gi}" style="display:none;border-top:1px solid var(--line);background:#fafbfd;padding:4px 16px">
        ${g.orders.map(orderRow).join("")}
      </div>
    </div>`;
  }).join("");
}

// یک سفارش داخل لیست بازشدهٔ مشتری
function orderRow(r){
  const items = (r.items||[]).map(it => `${it.name}×${toFa(it.qty)}`).join("، ");
  const cal = (r.items||[]).reduce((a,it)=>a+(+it.calories||0)*(+it.qty||0),0);
  const stars = r.snapp_rating ? "★".repeat(r.snapp_rating)+"☆".repeat(5-r.snapp_rating) : "";
  return `<div style="padding:11px 0;border-bottom:1px dashed var(--line)">
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <span class="muted" style="font-size:12.5px">${jalali(r.order_date)}</span>
      <b style="flex:1;min-width:150px">${items||"—"}</b>
      <span><b>${fa(r.total)}</b> ت</span>
      ${cal?`<span class="badge-cal">${fa(cal)} کالری</span>`:""}
    </div>
    ${r.address?`<div class="muted" style="font-size:12px;margin-top:3px">آدرس: ${r.address}</div>`:""}
    ${r.notes?`<div class="muted" style="font-size:12px;margin-top:3px">یادداشت: ${r.notes}</div>`:""}
    ${(r.snapp_rating||r.snapp_comment)?`<div style="font-size:12px;margin-top:3px;color:var(--accent)">امتیاز اسنپ: ${stars} ${r.snapp_comment||""}</div>`:""}
    <div class="row" style="margin-top:8px;gap:8px">
      <button class="btn ghost sm" onclick="editSnapp(${r.id})">امتیاز اسنپ</button>
      <button class="btn wa sm" onclick="waOrder(${r.id})">واتساپ</button>
      <button class="btn danger sm" onclick="delOrder(${r.id})">حذف</button>
    </div>
  </div>`;
}
window.toggleCust = (gi)=>{
  const b=$("cust-body-"+gi), a=$("cust-arrow-"+gi); if(!b) return;
  const open = b.style.display==="none";
  b.style.display = open ? "block" : "none";
  a.textContent = open ? "▼" : "◀";
};

window.delOrder = async (id) => {
  if (!confirm("این سفارش حذف شود؟")) return;
  const { error } = await db.from("orders").delete().eq("id", id);
  if (error) return toast("خطا در حذف");
  toast("حذف شد"); loadOrders();
};

window.waOrder = (id) => {
  const r = LAST_ORDERS.find(x => x.id === id); if (!r) return;
  if (!r.phone) return toast("این سفارش شمارهٔ مشتری ندارد");
  let s = `سلام ${r.customer_name||""}\nسفارش شما در کافه باراما:\n\n`;
  (r.items||[]).forEach(it => s += `• ${it.name} ×${toFa(it.qty)} — ${toFa(((it.price||0)*(it.qty||0)).toLocaleString())} تومان\n`);
  s += `\nجمع کل: ${toFa((r.total||0).toLocaleString())} تومان\n\nبا تشکر ☕`;
  openWhatsApp(r.phone, s);
};

// ---------- ویرایش امتیاز اسنپ (فقط امتیاز و توضیحات) ----------
const snappDlg = $("snappDialog");
window.editSnapp = (id) => {
  const r = LAST_ORDERS.find(x => x.id === id); if (!r) return;
  $("sd_id").value = r.id;
  $("sd_customer").textContent = `${r.customer_name || ""} — ${jalali(r.order_date)}`;
  $("sd_rating").value = r.snapp_rating != null ? String(r.snapp_rating) : "";
  $("sd_comment").value = r.snapp_comment || "";
  snappDlg.showModal();
};
$("sdCancel").onclick = () => snappDlg.close();
$("sdSave").onclick = async () => {
  const id = $("sd_id").value;
  const rec = {
    snapp_rating: $("sd_rating").value ? Number($("sd_rating").value) : null,
    snapp_comment: $("sd_comment").value.trim()
  };
  const { error } = await db.from("orders").update(rec).eq("id", id);
  if (error) { console.error(error); return toast("خطا در ذخیره امتیاز"); }
  toast("✓ امتیاز ثبت شد"); snappDlg.close(); loadOrders();
};

$("applyFilter").onclick = loadOrders;
$("resetFilter").onclick = () => {
  $("f_text").value=""; $("f_product").value=""; $("f_from").value=""; $("f_to").value="";
  loadOrders();
};
$("exportCsv").onclick = () => {
  if (!LAST_ORDERS.length) return toast("داده‌ای برای خروجی نیست");
  const head = ["تاریخ","نام","تلفن","آدرس","محصولات","جمع(تومان)","یادداشت","امتیاز اسنپ","توضیحات اسنپ"];
  const lines = LAST_ORDERS.map(r => [
    jalali(r.order_date), r.customer_name, r.phone, r.address,
    (r.items||[]).map(it=>`${it.name} x${it.qty}`).join(" | "), r.total, r.notes,
    r.snapp_rating, r.snapp_comment
  ].map(v => `"${String(v??"").replace(/"/g,'""')}"`).join(","));
  const csv = "﻿" + [head.join(","), ...lines].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type:"text/csv" }));
  a.download = "orders.csv"; a.click();
};

/* ============================================================
   مدیریت محصولات (CRUD)
   ============================================================ */
function renderProductsTable() {
  const term = $("p_search").value.trim().toLowerCase();
  const tb = $("productsTable").querySelector("tbody");
  const rows = PRODUCTS.filter(p => !term || (p.name||"").toLowerCase().includes(term)
                                  || (p.name_en||"").toLowerCase().includes(term)
                                  || (p.category||"").toLowerCase().includes(term));
  tb.innerHTML = rows.map(p => `<tr>
    <td><b>${p.name}</b>${p.name_en?`<div class="muted" style="font-size:11px">${p.name_en}</div>`:""}</td>
    <td><span class="pill">${p.category||"-"}</span></td>
    <td>${fa(p.price)}</td>
    <td>${p.calories!=null?fa(p.calories):"-"}</td>
    <td>${p.protein!=null?fa(p.protein):"-"}</td>
    <td>${p.carbs!=null?fa(p.carbs):"-"}</td>
    <td>${p.fat!=null?fa(p.fat):"-"}</td>
    <td>${p.fiber!=null?fa(p.fiber):"-"}</td>
    <td class="right">
      <button class="btn ghost sm" onclick="editProduct(${p.id})">ویرایش</button>
      <button class="btn danger sm" onclick="delProduct(${p.id})">حذف</button>
    </td>
  </tr>`).join("");
}
$("p_search").oninput = renderProductsTable;

const dlg = $("productDialog");
function openProductDialog(p) {
  $("pdTitle").textContent = p ? "ویرایش محصول" : "محصول جدید";
  $("pd_id").value = p?.id || "";
  $("pd_name").value = p?.name || "";
  $("pd_name_en").value = p?.name_en || "";
  $("pd_category").value = p?.category || "";
  $("pd_price").value = p?.price ?? "";
  $("pd_calories").value = p?.calories ?? "";
  $("pd_protein").value = p?.protein ?? "";
  $("pd_carbs").value = p?.carbs ?? "";
  $("pd_fat").value = p?.fat ?? "";
  $("pd_fiber").value = p?.fiber ?? "";
  $("pd_description").value = p?.description || "";
  dlg.showModal();
}
$("newProductBtn").onclick = () => openProductDialog(null);
$("pdCancel").onclick = () => dlg.close();
window.editProduct = (id) => openProductDialog(PRODUCTS.find(p => p.id === id));

$("pdSave").onclick = async () => {
  if (!db) return toast("ابتدا کلید دیتابیس را تنظیم کنید");
  const name = $("pd_name").value.trim();
  if (!name) return toast("نام محصول را وارد کنید");
  const numOrNull = (v) => v === "" ? null : Number(v);
  const rec = {
    name, name_en: $("pd_name_en").value.trim() || null,
    category: $("pd_category").value.trim() || null,
    price: Number($("pd_price").value) || 0,
    calories: numOrNull($("pd_calories").value),
    protein: numOrNull($("pd_protein").value),
    carbs: numOrNull($("pd_carbs").value),
    fat: numOrNull($("pd_fat").value),
    fiber: numOrNull($("pd_fiber").value),
    description: $("pd_description").value.trim() || null
  };
  const id = $("pd_id").value;
  const { error } = id
    ? await db.from("products").update(rec).eq("id", id)
    : await db.from("products").insert(rec);
  if (error) { console.error(error); return toast("خطا در ذخیره محصول"); }
  toast("✓ ذخیره شد"); dlg.close(); loadProducts();
};

window.delProduct = async (id) => {
  if (!confirm("این محصول حذف شود؟")) return;
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) return toast("خطا در حذف");
  toast("حذف شد"); loadProducts();
};

/* ============================================================
   منو + ارسال واتساپ
   ============================================================ */
function renderMenu() {
  const box = $("menuView");
  if (!PRODUCTS.length) { box.innerHTML = `<div class="empty">محصولی موجود نیست.</div>`; return; }
  const cats = [...new Set(PRODUCTS.map(p => p.category || "سایر"))];
  box.innerHTML = cats.map(cat => {
    const items = PRODUCTS.filter(p => (p.category||"سایر") === cat && p.active !== false);
    return `<div class="menu-cat">${cat}</div>` + items.map(p => {
      const nut = [];
      if (p.calories!=null) nut.push(`${fa(p.calories)} کالری`);
      if (p.protein!=null) nut.push(`پروتئین ${fa(p.protein)}گ`);
      if (p.carbs!=null) nut.push(`کربو ${fa(p.carbs)}گ`);
      if (p.fat!=null) nut.push(`چربی ${fa(p.fat)}گ`);
      if (p.fiber!=null) nut.push(`فیبر ${fa(p.fiber)}گ`);
      return `<div class="menu-item">
        <b>${p.name}</b>
        <span class="muted">${fa(p.price)} تومان ${nut.length?` • ${nut.join(" • ")}`:""}</span>
      </div>`;
    }).join("");
  }).join("");
}

function menuText() {
  let s = "☕ منوی کافه باراما\n";
  const cats = [...new Set(PRODUCTS.map(p => p.category || "سایر"))];
  cats.forEach(cat => {
    s += `\n— ${cat} —\n`;
    PRODUCTS.filter(p => (p.category||"سایر") === cat && p.active !== false).forEach(p => {
      let line = `• ${p.name} — ${toFa((+p.price||0).toLocaleString())} تومان`;
      if (p.calories != null) line += ` (${toFa(p.calories)} کالری)`;
      s += line + "\n";
    });
  });
  return s;
}
$("waMenuBtn").onclick = () => openWhatsApp($("wa_to").value.trim(), menuText());

/* ============================================================
   شروع
   ============================================================ */
if (typeof DEFAULT_WHATSAPP !== "undefined" && DEFAULT_WHATSAPP) $("wa_to").value = DEFAULT_WHATSAPP;
if (typeof jalaliDatepicker !== "undefined") jalaliDatepicker.startWatch({ time:false, persianDigit:true, autoHide:true });
renderCart();
loadProducts();
loadCustomers();
