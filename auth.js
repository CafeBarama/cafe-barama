/* ============================================================
   کافه باراما — احراز هویت و دسترسی مشترک
   نیازمند: config.js و کتابخانهٔ supabase پیش از این فایل
   ============================================================ */

const EMAIL_DOMAIN = "barama.local";
const uname2email = (u) => `${String(u || "").trim().toLowerCase()}@${EMAIL_DOMAIN}`;

// کلاینت مشترک — نشست در localStorage ذخیره می‌شود و بین همهٔ صفحات یکی است
const sb = (typeof SUPABASE_KEY !== "undefined" && SUPABASE_KEY && !SUPABASE_KEY.startsWith("PASTE_"))
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// نام فارسی نقش‌ها
const ROLE_FA = { admin: "مدیر", accountant: "حسابدار", staff: "نیرو" };

async function getSession() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session || null;
}

async function getProfile() {
  const s = await getSession();
  if (!s) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", s.user.id).single();
  if (error) { console.error(error); return null; }
  return data;
}

// محافظ صفحه: اگر نشست/نقش مجاز نبود به صفحهٔ ورود برمی‌گرداند.
// خروجی: پروفایل (در صورت مجاز بودن) یا null.
async function guard(allowedRoles) {
  if (!sb) { location.replace("index.html"); return null; }
  const p = await getProfile();
  if (!p || p.active === false) { location.replace("index.html"); return null; }
  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(p.role)) {
    alert("شما به این بخش دسترسی ندارید.");
    location.replace("index.html");
    return null;
  }
  return p;
}

async function logout() {
  if (sb) await sb.auth.signOut();
  location.replace("index.html");
}

// نمایش نام کاربر در گوشهٔ صفحه (اختیاری)
function paintUserChip(profile, elId) {
  const el = document.getElementById(elId);
  if (!el || !profile) return;
  el.textContent = `${profile.full_name || profile.username} · ${ROLE_FA[profile.role] || profile.role}`;
}
