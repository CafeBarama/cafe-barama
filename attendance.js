/* ============================================================
   کافه باراما — حضور و غیاب (نیرو + مدیر)
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
function timeFa(ts){ if(!ts) return "—";
  try{ return new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(new Date(ts)); }catch(e){return "—";} }
function hoursBetween(a,b){ if(!a||!b) return 0; return (new Date(b)-new Date(a))/3600000; }
function hoursFa(h){ const H=Math.floor(h), M=Math.round((h-H)*60);
  return `${fa(H)}:${String(M).padStart(2,"0").replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[d])}`; }

function shamsiMonthRange(){
  try{
    const d=new Date(); const j=jalaali.toJalaali(d.getFullYear(),d.getMonth()+1,d.getDate());
    const g1=jalaali.toGregorian(j.jy,j.jm,1);
    const dim=j.jm<=6?31:(j.jm<=11?30:(jalaali.isLeapJalaaliYear(j.jy)?30:29));
    const g2=jalaali.toGregorian(j.jy,j.jm,dim);
    const iso=(g)=>`${g.gy}-${String(g.gm).padStart(2,"0")}-${String(g.gd).padStart(2,"0")}`;
    return [iso(g1), iso(g2)];
  }catch(e){ const t=todayISO(); return [t.slice(0,8)+"01", t]; }
}

let ME=null, OPEN=null;

/* ---------- تب‌ها ---------- */
document.querySelectorAll("#nav button").forEach(b=>{
  b.onclick=()=>{ document.querySelectorAll("#nav button").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); $("tab-"+b.dataset.tab).classList.add("active");
    if (b.dataset.tab==="report") loadReport();
  };
});

/* ---------- حضور من ---------- */
async function refreshMe(){
  // رکورد باز (ورود بدون خروج)
  const { data:open } = await sb.from("cafe_attendance").select("*")
    .eq("staff_uid", ME.id).is("clock_out", null).order("id",{ascending:false}).limit(1);
  OPEN = (open && open[0]) || null;
  const st=$("status"), bt=$("clockBtn");
  if (OPEN){
    st.classList.add("on");
    $("statusText").textContent = `داخل شیفت — ورود ${timeFa(OPEN.clock_in)}`;
    bt.textContent="ثبت خروج"; bt.classList.add("out");
  } else {
    st.classList.remove("on");
    $("statusText").textContent = "خارج از شیفت";
    bt.textContent="ثبت ورود"; bt.classList.remove("out");
  }
  loadMyMonth();
}

$("clockBtn").onclick = async () => {
  if (OPEN){
    const { error } = await sb.from("cafe_attendance").update({ clock_out:new Date().toISOString() }).eq("id", OPEN.id);
    if (error){ console.error(error); return toast("خطا در ثبت خروج"); }
    toast("✓ خروج ثبت شد");
  } else {
    const rec = { staff_uid:ME.id, staff_name:ME.full_name||ME.username, work_date:todayISO(), clock_in:new Date().toISOString() };
    const { error } = await sb.from("cafe_attendance").insert(rec);
    if (error){ console.error(error); return toast("خطا در ثبت ورود"); }
    toast("✓ ورود ثبت شد");
  }
  refreshMe();
};

async function loadMyMonth(){
  const [from,to]=shamsiMonthRange();
  const { data, error } = await sb.from("cafe_attendance").select("*")
    .eq("staff_uid", ME.id).gte("work_date",from).lte("work_date",to)
    .order("work_date",{ascending:false}).order("id",{ascending:false});
  if (error){ console.error(error); return; }
  const rows=data||[];
  $("meEmpty").style.display = rows.length?"none":"block";
  let total=0;
  $("meTable").querySelector("tbody").innerHTML = rows.map(r=>{
    const h=hoursBetween(r.clock_in,r.clock_out); total+=h;
    return `<tr><td>${jalali(r.work_date)}</td><td>${timeFa(r.clock_in)}</td>
      <td>${r.clock_out?timeFa(r.clock_out):'<span class="pill">باز</span>'}</td>
      <td>${r.clock_out?hoursFa(h):"—"}</td></tr>`;
  }).join("");
  $("meTotal").textContent = `جمع: ${hoursFa(total)} ساعت`;
}

/* ---------- گزارش مدیر ---------- */
$("r_apply").onclick = loadReport;
$("r_month").onclick = () => { const [a,b]=shamsiMonthRange(); $("r_from").value=a; $("r_to").value=b; loadReport(); };

async function loadReport(){
  let from=$("r_from").value, to=$("r_to").value;
  if (!from||!to){ [from,to]=shamsiMonthRange(); $("r_from").value=from; $("r_to").value=to; }
  const { data, error } = await sb.from("cafe_attendance").select("*")
    .gte("work_date",from).lte("work_date",to).order("work_date");
  if (error){ console.error(error); return toast("خطا در گزارش"); }
  const rows=data||[];
  const g={};
  rows.forEach(r=>{
    const k=r.staff_uid||r.staff_name||"?";
    if(!g[k]) g[k]={name:r.staff_name||"—",hours:0,days:new Set(),recs:[]};
    g[k].recs.push(r);
    if(r.clock_out){ g[k].hours+=hoursBetween(r.clock_in,r.clock_out); g[k].days.add(r.work_date); }
  });
  const list=Object.values(g).sort((a,b)=>b.hours-a.hours);
  $("rTable").querySelector("tbody").innerHTML = list.length
    ? list.map(s=>`<tr><td><b>${s.name}</b></td><td>${fa(s.days.size)}</td><td>${hoursFa(s.hours)}</td></tr>`).join("")
    : `<tr><td colspan="3" class="muted" style="text-align:center;padding:20px">رکوردی نیست.</td></tr>`;
  // جزئیات هر نیرو
  $("rDetail").innerHTML = list.map(s=>`
    <div style="margin-top:14px"><b>${s.name}</b>
      <table style="margin-top:6px"><thead><tr><th>تاریخ</th><th>ورود</th><th>خروج</th><th>مدت</th></tr></thead><tbody>
      ${s.recs.sort((a,b)=>(a.work_date<b.work_date?1:-1)).map(r=>`<tr>
        <td>${jalali(r.work_date)}</td><td>${timeFa(r.clock_in)}</td>
        <td>${r.clock_out?timeFa(r.clock_out):'<span class="pill">باز</span>'}</td>
        <td>${r.clock_out?hoursFa(hoursBetween(r.clock_in,r.clock_out)):"—"}</td></tr>`).join("")}
      </tbody></table></div>`).join("");
}

/* ---------- شروع ---------- */
(async function init(){
  ME = await guard(["admin","staff"]);
  if (!ME) return;
  $("gate").remove();
  $("meName").textContent = `${ME.full_name||ME.username}`;
  if (ME.role==="admin"){ $("reportNav").style.display=""; const [a,b]=shamsiMonthRange(); $("r_from").value=a; $("r_to").value=b; }
  refreshMe();
})();
