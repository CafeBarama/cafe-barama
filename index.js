/* ============================================================
   کافه باراما — ورود و داشبورد
   ============================================================ */
const $ = (id) => document.getElementById(id);
let TT;
function toast(m){ const t=$("toast"); t.textContent=m; t.classList.add("show");
  clearTimeout(TT); TT=setTimeout(()=>t.classList.remove("show"),2400); }

if (!sb) $("configBanner").style.display = "block";

// ماژول‌ها و نقش‌های مجاز
const MODULES = [
  { title:"حسابداری iPro", emoji:"💰", href:"https://cafebarama.github.io/ipro-accounting/", roles:["admin"], desc:"حقوق و دستمزد، حضور، مرخصی کارمندان" },
  { title:"سفارش‌گیری",  emoji:"🧾", href:"orders.html",     roles:["admin","accountant","staff"], desc:"ثبت سفارش، محصولات، اقلام" },
  { title:"حضور و غیاب", emoji:"🕒", href:"attendance.html", roles:["admin","staff"],     desc:"ثبت ورود و خروج" },
  { title:"چت تیم",      emoji:"💬", href:"chat.html",       roles:["admin","staff"],     desc:"گفتگوی نیروها" },
];

let ME = null;

/* ---------- ورود ---------- */
$("loginBtn").onclick = doLogin;
$("password").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
$("username").addEventListener("keydown", e => { if (e.key === "Enter") $("password").focus(); });

async function doLogin(){
  $("loginErr").textContent = "";
  const u = $("username").value.trim();
  const p = $("password").value;
  if (!u || !p) return ($("loginErr").textContent = "نام کاربری و رمز را وارد کنید");
  const { error } = await sb.auth.signInWithPassword({ email: uname2email(u), password: p });
  if (error){ console.error(error); return ($("loginErr").textContent = "نام کاربری یا رمز اشتباه است"); }
  showApp();
}

/* ---------- ساخت اولین مدیر ---------- */
$("toggleSignup").onclick = () => { $("signupBox").hidden = !$("signupBox").hidden; };
$("signupBtn").onclick = async () => {
  $("suErr").textContent = "";
  const name = $("suName").value.trim(), u = $("suUser").value.trim(), p = $("suPass").value;
  if (!u || p.length < 6) return ($("suErr").textContent = "نام کاربری و رمز حداقل ۶ نویسه لازم است");
  const { data, error } = await sb.auth.signUp({ email: uname2email(u), password: p });
  if (error){ console.error(error); return ($("suErr").textContent = "خطا: " + (error.message||"")); }
  // پروفایل با تریگر ساخته می‌شود؛ نام کامل را تنظیم کن (اولین کاربر = مدیر)
  if (data.user && name) {
    await sb.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  }
  if (data.session) { toast("✓ حساب ساخته شد"); showApp(); }
  else { $("suErr").textContent = "حساب ساخته شد ولی ورود نشد — مطمئن شو «Confirm email» در Supabase خاموش است."; }
};

/* ---------- داشبورد ---------- */
async function showApp(){
  ME = await getProfile();
  if (!ME){ return; }     // هنوز نشست نیست
  if (ME.active === false){ await logout(); return; }
  $("login").style.display = "none";
  $("app").hidden = false;
  paintUserChip(ME, "userChip");
  $("hello").innerHTML = `سلام ${ME.full_name || ME.username} 👋
    <small>${ROLE_FA[ME.role]||ME.role} — بخش‌های در دسترس شما:</small>`;
  renderCards();
}

function renderCards(){
  const allowed = MODULES.filter(m => m.roles.includes(ME.role));
  let html = allowed.map(m => `
    <a class="mod" href="${m.href}">
      <div class="ic">${m.emoji}</div>
      <div><b>${m.title}</b><div class="d">${m.desc}</div></div>
    </a>`).join("");
  if (ME.role === "admin"){
    html += `<a class="mod" id="manageUsers" href="javascript:void(0)">
      <div class="ic">👥</div>
      <div><b>مدیریت کاربران</b><div class="d">افزودن نیرو و تعیین نقش‌ها</div></div></a>`;
  }
  $("cards").innerHTML = html;
  const mu = $("manageUsers"); if (mu) mu.onclick = openUsers;
}

$("logoutBtn").onclick = logout;

/* ---------- مدیریت کاربران (مدیر) ---------- */
const usersDlg = $("usersDlg");
$("usersClose").onclick = () => usersDlg.close();

async function openUsers(){
  usersDlg.showModal();
  await loadUsers();
}
let USERS = [];
async function loadUsers(){
  const { data, error } = await sb.from("profiles").select("*").order("created_at");
  if (error){ console.error(error); return toast("خطا در بارگذاری کاربران"); }
  USERS = data || [];
  const tb = $("usersTable").querySelector("tbody");
  tb.innerHTML = USERS.map(u => `<tr>
    <td>${u.full_name || "—"}${u.active===false?' <span class="muted" style="font-size:11px">(غیرفعال)</span>':""}</td>
    <td><span class="pill">${u.username || "—"}</span></td>
    <td>${ROLE_FA[u.role] || u.role}</td>
    <td>
      <button class="btn sm gray" onclick="window.editUser('${u.id}')">ویرایش</button>
      <button class="btn danger" onclick="window.delUser('${u.id}')" ${u.id===ME.id?"disabled":""}>حذف</button>
    </td>
  </tr>`).join("");
}

// ---- ویرایش ----
const editDlg = $("editUserDlg");
window.editUser = (id) => {
  const u = USERS.find(x => x.id === id); if (!u) return;
  $("eu_id").value = u.id;
  $("eu_name").value = u.full_name || "";
  $("eu_role").value = u.role || "staff";
  $("eu_active").value = u.active === false ? "0" : "1";
  editDlg.showModal();
};
$("eu_cancel").onclick = () => editDlg.close();
$("eu_save").onclick = async () => {
  const id = $("eu_id").value;
  const rec = {
    full_name: $("eu_name").value.trim() || null,
    role: $("eu_role").value,
    active: $("eu_active").value === "1"
  };
  const { error } = await sb.from("profiles").update(rec).eq("id", id);
  if (error){ console.error(error); return toast("خطا در ذخیره"); }
  toast("✓ ذخیره شد"); editDlg.close(); loadUsers();
};

// ---- حذف کامل (Auth + پروفایل) ----
window.delUser = async (id) => {
  const u = USERS.find(x => x.id === id);
  if (!confirm(`کاربر «${u ? (u.full_name || u.username) : ""}» کامل حذف شود؟ (قابل بازگشت نیست)`)) return;
  const { error } = await sb.rpc("cafe_delete_user", { uid: id });
  if (error){ console.error(error); return toast("خطا در حذف (تابع user-admin.sql اجرا شده؟)"); }
  toast("✓ حذف شد"); loadUsers();
};

$("nuAdd").onclick = async () => {
  $("nuErr").textContent = "";
  const name = $("nuName").value.trim(), u = $("nuUser").value.trim(),
        p = $("nuPass").value, role = $("nuRole").value;
  if (!u || p.length < 6) return ($("nuErr").textContent = "نام کاربری و رمز حداقل ۶ نویسه لازم است");
  // کلاینت موقت تا نشستِ مدیر جابه‌جا نشود
  const tmp = supabase.createClient(SUPABASE_URL, SUPABASE_KEY,
    { auth:{ persistSession:false, autoRefreshToken:false, storageKey:"barama-signup-tmp" } });
  const { data, error } = await tmp.auth.signUp({ email: uname2email(u), password: p });
  if (error){ console.error(error); return ($("nuErr").textContent = "خطا: " + (error.message||"")); }
  if (data.user){
    // پروفایل با تریگر ساخته شده؛ نقش و نام را تنظیم کن (مدیر دسترسی دارد)
    const { error: e2 } = await sb.from("profiles").update({ full_name: name || u, role }).eq("id", data.user.id);
    if (e2) console.error(e2);
  }
  $("nuName").value = $("nuUser").value = $("nuPass").value = "";
  toast("✓ کاربر ساخته شد");
  loadUsers();
};

/* ---------- شروع: اگر نشست هست مستقیم داشبورد ---------- */
(async function init(){
  if (!sb) return;
  if (await getSession()) showApp();
})();
