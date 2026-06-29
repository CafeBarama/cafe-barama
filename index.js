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
  { title:"حسابداری",    emoji:"💰", href:"accounting.html", roles:["admin"],            desc:"هزینه‌ها، درآمد و سود" },
  { title:"سفارش‌گیری",  emoji:"🧾", href:"orders.html",     roles:["admin","accountant"], desc:"ثبت سفارش، محصولات، اقلام" },
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
async function loadUsers(){
  const { data, error } = await sb.from("profiles").select("*").order("created_at");
  if (error){ console.error(error); return toast("خطا در بارگذاری کاربران"); }
  const tb = $("usersTable").querySelector("tbody");
  tb.innerHTML = (data||[]).map(u => `<tr>
    <td>${u.full_name || "—"}</td>
    <td class="pill">${u.username || "—"}</td>
    <td>
      <select onchange="window.setRole('${u.id}', this.value)" ${u.id===ME.id?"disabled":""}>
        <option value="staff"      ${u.role==="staff"?"selected":""}>نیرو</option>
        <option value="accountant" ${u.role==="accountant"?"selected":""}>حسابدار</option>
        <option value="admin"      ${u.role==="admin"?"selected":""}>مدیر</option>
      </select>
    </td>
    <td><input type="checkbox" ${u.active!==false?"checked":""} onchange="window.setActive('${u.id}', this.checked)" ${u.id===ME.id?"disabled":""}></td>
    <td></td>
  </tr>`).join("");
}
window.setRole = async (id, role) => {
  const { error } = await sb.from("profiles").update({ role }).eq("id", id);
  toast(error ? "خطا" : "✓ نقش به‌روز شد");
};
window.setActive = async (id, active) => {
  const { error } = await sb.from("profiles").update({ active }).eq("id", id);
  toast(error ? "خطا" : (active ? "✓ فعال شد" : "غیرفعال شد"));
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
