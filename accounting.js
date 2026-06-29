/* ============================================================
   کافه باراما — حسابداری (فقط مدیر)
   ============================================================ */
const $ = (id) => document.getElementById(id);
const fa = (n) => (n == null || isNaN(n) ? "۰" : Number(n).toLocaleString("fa-IR"));
let TT; function toast(m){ const t=$("toast"); t.textContent=m; t.classList.add("show");
  clearTimeout(TT); TT=setTimeout(()=>t.classList.remove("show"),2400); }

function todayISO(){ const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function jalali(iso){ if(!iso) return "";
  const d=new Date(String(iso).length<=10?iso+"T00:00:00":iso); if(isNaN(d)) return iso;
  try{ return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}catch(e){return iso;} }
function todayShamsiStr(){ try{ const d=new Date(); const j=jalaali.toJalaali(d.getFullYear(),d.getMonth()+1,d.getDate());
  return `${j.jy}/${String(j.jm).padStart(2,"0")}/${String(j.jd).padStart(2,"0")}`;}catch(e){return todayISO();} }
function shamsiToISO(s){ if(!s) return todayISO();
  s=String(s).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const m=s.match(/(\d{3,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if(!m||typeof jalaali==="undefined") return todayISO();
  const g=jalaali.toGregorian(+m[1],+m[2],+m[3]);
  return `${g.gy}-${String(g.gm).padStart(2,"0")}-${String(g.gd).padStart(2,"0")}`; }

// اول و آخر ماه شمسی جاری به ISO
function shamsiMonthRange(){
  try{
    const d=new Date(); const j=jalaali.toJalaali(d.getFullYear(),d.getMonth()+1,d.getDate());
    const g1=jalaali.toGregorian(j.jy,j.jm,1);
    const daysInMonth = j.jm<=6?31:(j.jm<=11?30:(jalaali.isLeapJalaaliYear(j.jy)?30:29));
    const g2=jalaali.toGregorian(j.jy,j.jm,daysInMonth);
    const iso=(g)=>`${g.gy}-${String(g.gm).padStart(2,"0")}-${String(g.gd).padStart(2,"0")}`;
    return [iso(g1), iso(g2)];
  }catch(e){ const t=todayISO(); return [t.slice(0,8)+"01", t]; }
}

const CATS = ["مواد اولیه","حقوق و دستمزد","اجاره","قبوض","تنخواه","تجهیزات","بازاریابی","سایر"];

/* ---------- تب‌ها ---------- */
document.querySelectorAll("nav button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); $("tab-"+b.dataset.tab).classList.add("active");
    if (b.dataset.tab==="expenses") loadExpenses();
  };
});

/* ---------- خلاصه ---------- */
$("s_apply").onclick = loadSummary;
$("s_month").onclick = () => { const [a,b]=shamsiMonthRange(); $("s_from").value=a; $("s_to").value=b; loadSummary(); };

async function loadSummary(){
  const from=$("s_from").value, to=$("s_to").value;
  if (!from || !to) return toast("بازهٔ تاریخ را انتخاب کن");
  // درآمد از سفارش‌ها
  let oq = sb.from("orders").select("total,order_date").gte("order_date",from).lte("order_date",to);
  const { data:orders, error:e1 } = await oq;
  if (e1){ console.error(e1); return toast("خطا در خواندن سفارش‌ها"); }
  const income = (orders||[]).reduce((a,o)=>a+(+o.total||0),0);
  // هزینه‌ها
  const { data:exps, error:e2 } = await sb.from("expenses").select("*").gte("exp_date",from).lte("exp_date",to);
  if (e2){ console.error(e2); return toast("خطا در خواندن هزینه‌ها"); }
  const expense = (exps||[]).reduce((a,x)=>a+(+x.amount||0),0);
  $("s_income").textContent  = fa(income)+" ت";
  $("s_expense").textContent = fa(expense)+" ت";
  $("s_profit").textContent  = fa(income-expense)+" ت";
  $("s_meta").textContent = `${fa((orders||[]).length)} سفارش • ${fa((exps||[]).length)} هزینه • از ${jalali(from)} تا ${jalali(to)}`;
  // بر اساس دسته
  const byCat={}; (exps||[]).forEach(x=>{ const c=x.category||"سایر"; byCat[c]=(byCat[c]||0)+(+x.amount||0); });
  const rows=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  $("s_bycat").innerHTML = rows.length
    ? rows.map(([c,v])=>`<div class="row" style="padding:8px 0;border-bottom:1px dashed var(--line)"><b style="flex:1">${c}</b><span>${fa(v)} ت</span></div>`).join("")
    : `<div class="muted">هزینه‌ای در این بازه نیست.</div>`;
}

/* ---------- هزینه‌ها ---------- */
$("catList").innerHTML = CATS.map(c=>`<option value="${c}">`).join("");
$("e_date").value = todayShamsiStr();

$("e_save").onclick = async () => {
  const amount = +$("e_amount").value || 0;
  const title = $("e_title").value.trim();
  if (!amount) return toast("مبلغ را وارد کن");
  if (!title)  return toast("عنوان هزینه را وارد کن");
  const rec = {
    exp_date: shamsiToISO($("e_date").value),
    category: $("e_category").value.trim() || "سایر",
    title, amount, note: $("e_note").value.trim() || null,
    created_by: ME ? ME.id : null
  };
  const { error } = await sb.from("expenses").insert(rec);
  if (error){ console.error(error); return toast("خطا در ثبت هزینه"); }
  toast("✓ هزینه ثبت شد");
  $("e_title").value=""; $("e_amount").value=""; $("e_note").value=""; $("e_date").value=todayShamsiStr();
  loadExpenses();
};

$("f_apply").onclick = loadExpenses;

async function loadExpenses(){
  let q = sb.from("expenses").select("*").order("exp_date",{ascending:false}).order("id",{ascending:false});
  const from=$("f_from").value, to=$("f_to").value;
  if (from) q=q.gte("exp_date",from);
  if (to)   q=q.lte("exp_date",to);
  const { data, error } = await q;
  if (error){ console.error(error); return toast("خطا در بارگذاری"); }
  const rows = data||[];
  $("expEmpty").style.display = rows.length ? "none" : "block";
  const tb = $("expTable").querySelector("tbody");
  tb.innerHTML = rows.map(x=>`<tr>
    <td>${jalali(x.exp_date)}</td>
    <td>${x.category||"—"}</td>
    <td>${x.title||"—"}</td>
    <td><b>${fa(x.amount)}</b> ت</td>
    <td class="muted">${x.note||""}</td>
    <td><button class="btn danger sm" onclick="window.delExp(${x.id})">حذف</button></td>
  </tr>`).join("");
  const total = rows.reduce((a,x)=>a+(+x.amount||0),0);
  $("exp_total").textContent = rows.length ? `جمع: ${fa(total)} تومان` : "";
}

window.delExp = async (id) => {
  if (!confirm("این هزینه حذف شود؟")) return;
  const { error } = await sb.from("expenses").delete().eq("id", id);
  if (error){ console.error(error); return toast("خطا در حذف"); }
  toast("حذف شد"); loadExpenses();
};

/* ---------- شروع (با محافظ دسترسی) ---------- */
let ME = null;
(async function init(){
  ME = await guard(["admin"]);
  if (!ME) return;                       // guard ریدایرکت کرده
  $("gate").remove();
  if (typeof jalaliDatepicker!=="undefined") jalaliDatepicker.startWatch({ time:false, persianDigit:true, autoHide:true });
  const [a,b]=shamsiMonthRange(); $("s_from").value=a; $("s_to").value=b;
  loadSummary();
})();
