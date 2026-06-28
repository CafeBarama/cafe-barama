/* ============================================================
   کافه باراما — چت تیم
   ============================================================ */

// ---------- اتصال به Supabase ----------
let db = null;
const configured = SUPABASE_KEY && !SUPABASE_KEY.startsWith("PASTE_");
if (configured) db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
else document.getElementById("configBanner").style.display = "block";

// ---------- ابزارها ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
let TOAST_T;
function toast(msg){
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(TOAST_T); TOAST_T = setTimeout(()=>t.classList.remove("show"), 2200);
}
function timeFa(iso){
  try { return new Intl.DateTimeFormat("fa-IR",{hour:"2-digit",minute:"2-digit"}).format(new Date(iso)); }
  catch(e){ return ""; }
}
function dayLabel(iso){
  const d = new Date(iso), now = new Date();
  const sameDay = (a,b)=> a.toDateString()===b.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate()-1);
  if (sameDay(d,now)) return "امروز";
  if (sameDay(d,yest)) return "دیروز";
  try { return new Intl.DateTimeFormat("fa-IR-u-ca-persian",{weekday:"long",day:"2-digit",month:"long"}).format(d); }
  catch(e){ return d.toLocaleDateString("fa-IR"); }
}
function dayKey(iso){ return new Date(iso).toDateString(); }

// ---------- وضعیت ----------
let ME = null;            // {id, name}
let STAFF = [];
let CHANNELS = [];
let CUR = null;           // کانال جاری
let SEEN = new Set();     // id پیام‌های نمایش‌داده‌شده (جلوگیری از تکرار)
let LAST_TS = null;       // زمان آخرین پیام برای واکشی افزایشی
let POLL_T = null;
const UNREAD = {};        // {channel_id: count}

const ME_KEY = "barama_chat_me";

/* ============================================================
   صدا و نوتیفیکیشن
   ============================================================ */
let audioCtx = null;
let soundOn = localStorage.getItem("barama_chat_sound") !== "off";
let lastSound = 0;

function unlockAudio(){
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch(e){}
}

// صدای «دینگ» دو‌نتی بدون فایل (Web Audio) — فقط در صورت نبودِ گفتار
function playDing(){
  try {
    unlockAudio();
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    [[880, 0], [1320, 0.13]].forEach(([f, dt]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f;
      o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.22);
      o.start(t0 + dt); o.stop(t0 + dt + 0.25);
    });
  } catch(e){}
}

// گفتنِ «کافه باراما» با صدای دستگاه (TTS) — اگر نشد، دینگ پخش می‌شود
function speakName(){
  try {
    if (!("speechSynthesis" in window)){ playDing(); return; }
    const u = new SpeechSynthesisUtterance("کافه باراما");
    u.lang = "fa-IR"; u.rate = 1; u.pitch = 1; u.volume = 1;
    const v = (window.speechSynthesis.getVoices() || [])
      .find(x => /^fa/i.test(x.lang) || /persian|farsi|فارسی/i.test(x.name));
    if (v) u.voice = v;
    window.speechSynthesis.cancel();      // جلوگیری از صف شدن
    window.speechSynthesis.speak(u);
  } catch(e){ playDing(); }
}

// آماده‌سازی گفتار با یک تعامل کاربر (لازم برای بعضی مرورگرها)
function warmupSpeech(){
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(" "); u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// هشدار صوتی پیام جدید (با رعایت روشن/خاموش و فاصلهٔ زمانی)
function alertSound(){
  if (!soundOn) return;
  const now = Date.now();
  if (now - lastSound < 1500) return;     // جلوگیری از تکرار سریع
  lastSound = now;
  speakName();
}

function msgPreview(m){
  if (m.type === "image") return "📷 عکس";
  if (m.type === "voice") return "🎤 پیام صوتی";
  if (m.type === "list")  return "🛒 لیست خرید";
  return m.text || "";
}

// نوتیفیکیشن سیستمی با عنوان «کافه باراما»
function notify(m, channelName){
  if (!m) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = "کافه باراما";
  const body  = `${m.staff_name || ""}${channelName ? " · " + channelName : ""}: ${msgPreview(m)}`;
  const opts  = { body, icon:"icon-192.png", badge:"icon-192.png", tag:"barama-chat", renotify:true, dir:"rtl", lang:"fa" };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification(title, opts))
        .catch(() => { new Notification(title, opts); });
    } else {
      new Notification(title, opts);
    }
  } catch(e){}
}

function askNotifyPermission(){
  if ("Notification" in window && Notification.permission === "default"){
    try { Notification.requestPermission().catch(()=>{}); } catch(e){}
  }
}

/* ============================================================
   ورود
   ============================================================ */
async function loadStaff(){
  if (!db) return;
  const { data, error } = await db.from("staff").select("*").eq("active", true).order("name");
  if (error){ console.error(error); return; }
  STAFF = data || [];
  $("loginName").innerHTML = `<option value="">— انتخاب —</option>` +
    STAFF.map(s => `<option value="${s.id}">${esc(s.name)}${s.role?` (${esc(s.role)})`:""}</option>`).join("");
}

$("loginBtn").onclick = () => {
  unlockAudio(); warmupSpeech(); // قفل‌گشایی صدا/گفتار با تعامل کاربر
  askNotifyPermission();         // درخواست اجازهٔ نوتیفیکیشن
  const id = +$("loginName").value;
  const pin = $("loginPin").value.trim();
  const s = STAFF.find(x => x.id === id);
  if (!s) return ($("loginErr").textContent = "نام خود را انتخاب کنید");
  if ((s.pin || "") !== pin) return ($("loginErr").textContent = "رمز اشتباه است");
  ME = { id: s.id, name: s.name };
  localStorage.setItem(ME_KEY, JSON.stringify(ME));
  startApp();
};

// دکمهٔ روشن/خاموش صدا
function refreshSoundBtn(){ $("soundBtn").textContent = soundOn ? "🔔" : "🔕"; }
$("soundBtn").onclick = () => {
  soundOn = !soundOn;
  localStorage.setItem("barama_chat_sound", soundOn ? "on" : "off");
  refreshSoundBtn();
  if (soundOn){ unlockAudio(); warmupSpeech(); speakName(); toast("صدا روشن شد"); }
  else { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch(e){} toast("صدا خاموش شد"); }
};
refreshSoundBtn();
$("loginPin").addEventListener("keydown", e => { if (e.key === "Enter") $("loginBtn").click(); });

// افزودن نیرو
$("toggleAdd").onclick = () => { $("addBox").hidden = !$("addBox").hidden; };
$("saveStaffBtn").onclick = async () => {
  if (!db) return toast("کلید دیتابیس تنظیم نشده");
  const name = $("newName").value.trim();
  const pin  = $("newPin").value.trim();
  if (!name) return toast("نام را وارد کنید");
  if (!pin)  return toast("یک رمز کوتاه بگذارید");
  const { error } = await db.from("staff").insert({ name, pin, role: $("newRole").value.trim() || null });
  if (error){ console.error(error); return toast("خطا — جدول staff ساخته شده؟"); }
  toast("✓ نیرو اضافه شد");
  $("newName").value = $("newPin").value = $("newRole").value = "";
  $("addBox").hidden = true;
  await loadStaff();
  $("loginName").value = String([...STAFF].reverse().find(s=>s.name===name)?.id || "");
};

$("logoutBtn").onclick = () => {
  localStorage.removeItem(ME_KEY);
  if (POLL_T) clearInterval(POLL_T);
  location.reload();
};

/* ============================================================
   شروع برنامه (بعد از ورود)
   ============================================================ */
async function startApp(){
  $("login").style.display = "none";
  $("app").hidden = false;
  $("hWho").textContent = ME.name;
  askNotifyPermission();
  await loadChannels();
  if (CHANNELS.length) selectChannel(CHANNELS[0].id);
  if (POLL_T) clearInterval(POLL_T);
  POLL_T = setInterval(poll, 3000);
}

async function loadChannels(){
  const { data, error } = await db.from("channels").select("*").order("sort").order("id");
  if (error){ console.error(error); return toast("خطا در بارگذاری کانال‌ها"); }
  CHANNELS = data || [];
  renderChannels();
}

function renderChannels(){
  $("channels").innerHTML = CHANNELS.map(c =>
    `<button class="chan ${CUR&&CUR.id===c.id?"active":""}" onclick="window.pickChannel(${c.id})">
       ${c.emoji?c.emoji+" ":""}${esc(c.name)}
       <span class="dot" id="dot-${c.id}">${UNREAD[c.id]||""}</span>
     </button>`).join("");
  // به‌روزرسانی نقطه‌های خوانده‌نشده
  CHANNELS.forEach(c => {
    const d = $("dot-"+c.id); if (!d) return;
    d.style.display = UNREAD[c.id] ? "flex" : "none";
    d.textContent = UNREAD[c.id] || "";
  });
}

window.pickChannel = (id) => selectChannel(id);

async function selectChannel(id){
  CUR = CHANNELS.find(c => c.id === id);
  if (!CUR) return;
  UNREAD[id] = 0;
  SEEN = new Set(); LAST_TS = null;
  $("hTitle").textContent = (CUR.emoji?CUR.emoji+" ":"") + CUR.name;
  $("messages").innerHTML = `<div class="empty">در حال بارگذاری…</div>`;
  renderChannels();
  await loadMessages();
}

/* ============================================================
   پیام‌ها
   ============================================================ */
async function loadMessages(){
  const { data, error } = await db.from("messages").select("*")
    .eq("channel_id", CUR.id).order("created_at").limit(300);
  if (error){ console.error(error); return; }
  const msgs = data || [];
  $("messages").innerHTML = "";
  if (!msgs.length){ $("messages").innerHTML = `<div class="empty">هنوز پیامی نیست. اولین نفر باش 🙂</div>`; }
  let lastDay = null;
  msgs.forEach(m => { appendMessage(m, lastDay); lastDay = dayKey(m.created_at); });
  scrollDown();
}

function appendMessage(m, prevDayKey){
  if (SEEN.has(m.id)) return;
  SEEN.add(m.id);
  LAST_TS = m.created_at;

  const box = $("messages");
  const emptyEl = box.querySelector(".empty"); if (emptyEl) emptyEl.remove();

  // جداکنندهٔ تاریخ
  const lastSep = box.dataset.lastday;
  if (lastSep !== dayKey(m.created_at)){
    const sep = document.createElement("div");
    sep.className = "day";
    sep.innerHTML = `<span>${dayLabel(m.created_at)}</span>`;
    box.appendChild(sep);
    box.dataset.lastday = dayKey(m.created_at);
  }

  const mine = ME && m.staff_id === ME.id;
  const el = document.createElement("div");
  el.className = "msg " + (mine ? "mine" : "theirs");

  let inner = "";
  if (!mine) inner += `<div class="name">${esc(m.staff_name || "نامشخص")}</div>`;
  if (m.type === "image" && m.media_url){
    inner += `<img src="${esc(m.media_url)}" onclick="window.showImg('${esc(m.media_url)}')">`;
    if (m.text) inner += `<div class="body">${esc(m.text)}</div>`;
  } else if (m.type === "voice" && m.media_url){
    inner += `<audio controls src="${esc(m.media_url)}"></audio>`;
  } else if (m.type === "list"){
    inner += `<div class="body list">${esc(m.text)}</div>`;
  } else {
    inner += `<div class="body">${esc(m.text)}</div>`;
  }
  inner += `<div class="time">${timeFa(m.created_at)}</div>`;
  if (mine) inner += `<button class="del" onclick="window.delMsg(${m.id})">✕</button>`;
  el.innerHTML = inner;
  box.appendChild(el);
}

function scrollDown(){
  const box = $("messages");
  box.scrollTop = box.scrollHeight;
}
function nearBottom(){
  const box = $("messages");
  return box.scrollHeight - box.scrollTop - box.clientHeight < 120;
}

// واکشی افزایشی هر ۳ ثانیه (پیام‌های جدید همهٔ کانال‌ها)
async function poll(){
  if (!db || !CUR) return;
  // پیام‌های جدید کانال جاری
  let q = db.from("messages").select("*").eq("channel_id", CUR.id).order("created_at");
  if (LAST_TS) q = q.gt("created_at", LAST_TS);
  const { data, error } = await q;
  if (error){ console.error(error); return; }
  const stick = nearBottom();
  // پیام‌های واقعاً جدیدِ دیگران (قبل از افزودن به SEEN)
  const incoming = (data || []).filter(m => !SEEN.has(m.id) && !(ME && m.staff_id === ME.id));
  (data || []).forEach(m => appendMessage(m));
  if ((data||[]).length && stick) scrollDown();
  if (incoming.length){
    alertSound();
    if (document.hidden) notify(incoming[incoming.length-1], CUR.name);  // وقتی اپ پنهان است
  }

  // شمارش خوانده‌نشدهٔ کانال‌های دیگر
  pollUnread();
}

let UNREAD_TS = null;
async function pollUnread(){
  if (UNREAD_TS === null){ UNREAD_TS = new Date().toISOString(); return; }
  const { data } = await db.from("messages").select("*").gt("created_at", UNREAD_TS);
  let changed = false, lastOther = null;
  (data || []).forEach(m => {
    if (m.created_at > UNREAD_TS) UNREAD_TS = m.created_at;
    if (CUR && m.channel_id === CUR.id) return;     // کانال باز
    if (ME && m.staff_id === ME.id) return;         // پیام خودم
    UNREAD[m.channel_id] = (UNREAD[m.channel_id] || 0) + 1;
    lastOther = m;
    changed = true;
  });
  if (changed){
    renderChannels();
    alertSound();                                   // پیام کانال دیگر هم صدا بدهد
    const ch = CHANNELS.find(c => lastOther && c.id === lastOther.channel_id);
    notify(lastOther, ch ? ch.name : "");           // نوتیفیکیشن با نام کانال
  }
}

/* ============================================================
   ارسال پیام
   ============================================================ */
async function send(payload){
  const rec = { channel_id: CUR.id, staff_id: ME.id, staff_name: ME.name, ...payload };
  const { data, error } = await db.from("messages").insert(rec).select().single();
  if (error){ console.error(error); return toast("خطا در ارسال پیام"); }
  appendMessage(data);   // نمایش فوری (poll با SEEN تکرارش نمی‌کند)
  scrollDown();
}

$("composer").addEventListener("submit", e => {
  e.preventDefault();
  unlockAudio(); warmupSpeech();
  const text = $("msgInput").value.trim();
  if (!text) return;
  $("msgInput").value = "";
  send({ type:"text", text });
});

// ---------- ارسال لیست خرید از اپ ----------
$("listBtn").onclick = async () => {
  const { data, error } = await db.from("inventory").select("*").order("name");
  if (error){ console.error(error); return toast("خطا — جدول inventory ساخته شده؟"); }
  const low = (data || []).filter(i => i.status && i.status !== "موجود");
  let text;
  if (!low.length) text = "🛒 لیست تهیه:\nهمهٔ اقلام موجود است ✅";
  else text = "🛒 لیست تهیه:\n" + low.map(i => `• ${i.name} — ${i.status}`).join("\n");
  send({ type:"list", text });
};

// ---------- ارسال عکس ----------
$("imgBtn").onclick = () => $("imgFile").click();
$("imgFile").onchange = async () => {
  const f = $("imgFile").files[0];
  $("imgFile").value = "";
  if (!f) return;
  if (f.size > 8 * 1024 * 1024) return toast("عکس خیلی بزرگ است (حداکثر ۸ مگابایت)");
  toast("در حال ارسال عکس…");
  const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
  const url = await uploadMedia(f, ext);
  if (url) send({ type:"image", media_url:url });
};

// ---------- پیام صوتی ----------
let mediaRec = null, chunks = [], recTimer = null, recStart = 0;
$("micBtn").onclick = async () => {
  if (mediaRec && mediaRec.state === "recording"){ stopRecording(); return; }
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast("مرورگر ضبط صدا را پشتیبانی نمی‌کند");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    chunks = [];
    mediaRec = new MediaRecorder(stream);
    mediaRec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    mediaRec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: mediaRec.mimeType || "audio/webm" });
      if (blob.size < 800) return;   // خیلی کوتاه
      toast("در حال ارسال صدا…");
      const url = await uploadMedia(blob, "webm");
      if (url) send({ type:"voice", media_url:url });
    };
    mediaRec.start();
    recStart = Date.now();
    showRecUI();
  } catch(e){ console.error(e); toast("اجازهٔ میکروفون داده نشد"); }
};
function stopRecording(){
  if (mediaRec && mediaRec.state === "recording") mediaRec.stop();
  hideRecUI();
}
function showRecUI(){
  $("micBtn").classList.add("rec");
  $("msgInput").style.display = "none";
  const bar = document.createElement("div");
  bar.className = "rec-bar"; bar.id = "recBar";
  bar.innerHTML = `<span>● در حال ضبط</span> <span id="recTime">۰:۰۰</span>`;
  $("composer").insertBefore(bar, $("micBtn"));
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    const m = Math.floor(s/60), ss = String(s%60).padStart(2,"0");
    const t = `${m}:${ss}`.replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
    if ($("recTime")) $("recTime").textContent = t;
    if (s >= 120) stopRecording();   // سقف ۲ دقیقه
  }, 250);
}
function hideRecUI(){
  $("micBtn").classList.remove("rec");
  $("msgInput").style.display = "";
  clearInterval(recTimer);
  const bar = $("recBar"); if (bar) bar.remove();
}

// ---------- آپلود فایل به Storage ----------
async function uploadMedia(fileOrBlob, ext){
  const rnd = Math.random().toString(36).slice(2, 8);
  const path = `${CUR.id}/${Date.now()}-${rnd}.${ext}`;
  const { error } = await db.storage.from("chat-media").upload(path, fileOrBlob, {
    upsert:false, contentType: fileOrBlob.type || undefined
  });
  if (error){ console.error(error); toast("خطا در آپلود فایل (باکت chat-media ساخته شده؟)"); return null; }
  const { data } = db.storage.from("chat-media").getPublicUrl(path);
  return data.publicUrl;
}

// ---------- حذف پیام (فقط مال خودم) ----------
window.delMsg = async (id) => {
  if (!confirm("این پیام حذف شود؟")) return;
  const { error } = await db.from("messages").delete().eq("id", id).eq("staff_id", ME.id);
  if (error){ console.error(error); return toast("خطا در حذف"); }
  SEEN.delete(id);
  await loadMessages();
};

// ---------- نمایش بزرگ عکس ----------
window.showImg = (url) => { $("lightboxImg").src = url; $("lightbox").style.display = "flex"; };
$("lightbox").onclick = () => { $("lightbox").style.display = "none"; $("lightboxImg").src = ""; };

/* ============================================================
   شروع
   ============================================================ */
(async function init(){
  if (!db) return;
  await loadStaff();
  const saved = localStorage.getItem(ME_KEY);
  if (saved){
    try {
      const me = JSON.parse(saved);
      if (STAFF.some(s => s.id === me.id)){ ME = me; startApp(); return; }
    } catch(e){}
  }
})();
