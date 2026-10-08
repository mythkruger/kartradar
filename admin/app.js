/*
 * KartRadar admin paneli (tarayıcı tarafı)
 *
 * Veri doğrudan Firestore'dan okunur (Firebase web SDK, Google girişi).
 * Firestore kuralları adminRuns ve meta/notifyState'i sadece admin e-postasına açar;
 * kampanyalar zaten girişli herkese açık (uygulama da okuyor).
 *
 * Panel açılışı ≈ 1 (index) + kart sayısı (≈14) okuma. Rapor sekmesi ≈ 40 okuma (açınca).
 * "Şimdi tara" → /api/scan (Vercel fonksiyonu) → GitHub Actions.
 */
const SDK = "https://www.gstatic.com/firebasejs/11.10.0";
const { initializeApp } = await import(`${SDK}/firebase-app.js`);
const { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } = await import(`${SDK}/firebase-auth.js`);
const { getFirestore, collection, doc, getDoc, getDocs, limit, orderBy, query, where } = await import(`${SDK}/firebase-firestore.js`);

const SECTORS = {
  market: "Market", akaryakit: "Akaryakıt", giyim: "Giyim", elektronik: "Elektronik", "beyaz-esya": "Beyaz Eşya",
  mobilya: "Mobilya & Ev", "e-ticaret": "Online", seyahat: "Seyahat", "yeme-icme": "Yeme & İçme", egitim: "Eğitim",
  saglik: "Sağlık & Kozmetik", eglence: "Eğlence", otomotiv: "Otomotiv", fatura: "Fatura & Vergi", telekom: "Telekom",
  spor: "Spor", genel: "Tüm Harcamalar", diger: "Diğer"
};
const JOIN = { app: "Uygulamadan", sms: "SMS", auto: "Otomatik" };
const PAGE = 60;

/*
 * Zamanlanmış işler (Türkiye saati). .github/workflows/scrape.yml ve notify.yml ile aynı olmalı.
 *   cron: workflow dosyasındaki satır (UTC). Rapor bunu taşır → gecikse bile doğru hücreye düşer.
 *   publish: o taramada Firestore'a yayın yapılır
 */
const SCHEDULE = [
  { time: "00:17", cron: "17 21 * * *", kind: "scrape", publish: false, label: "Tarama" },
  { time: "08:43", cron: "43 5 * * *", kind: "scrape", publish: true, label: "Tarama" },
  { time: "12:21", cron: "21 9 * * *", kind: "notify", label: "Bildirim" },
  { time: "15:13", cron: "13 12 * * *", kind: "scrape", publish: false, label: "Tarama" },
  { time: "19:21", cron: "21 16 * * *", kind: "notify", label: "Bildirim" },
  { time: "20:43", cron: "43 17 * * *", kind: "scrape", publish: true, label: "Tarama" }
];
const TR_OFFSET = 3 * 60 * 60 * 1000; // Türkiye UTC+3 (yaz saati yok)
const SLOT_BEFORE = 10 * 60 * 1000; // en erken 10 dk önce
const SLOT_AFTER = 150 * 60 * 1000; // cron bilgisi olmayan eski raporlar için: 2,5 saat içinde
const SLOT_GIVEUP = 6 * 60 * 60 * 1000; // 6 saatte rapor gelmezse "çalışmadı"
const MAX_DOC = 1024 * 1024;

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fold = (s) => String(s ?? "").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
const tl = (n) => Number(n).toLocaleString("tr-TR");
const fmtTime = (d) => (d ? d.toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-");
const fmtDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "?");
const toDate = (v) => (v?.toDate ? v.toDate() : typeof v === "number" ? new Date(v) : v ? new Date(v) : null);
const todayStr = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD

let auth, db, config;
const state = {
  index: {}, // programId → { name, bank, count, hash, updatedAt, nextExpiry }
  docs: {}, // programId → { bytes, updatedAt }
  campaigns: [],
  program: "",
  shown: PAGE,
  runs: null,
  ghTimer: null
};

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3500);
}

/* =========================
   BAŞLANGIÇ + GİRİŞ
========================= */

async function boot() {
  config = await fetch("/api/config").then((r) => r.json()).catch(() => null);
  if (!config?.firebase) {
    showLogin("Firebase ayarı yok: FIREBASE_WEB_CONFIG ortam değişkenini ekle (admin/.env.local ya da Vercel).");
    $("loginButton").disabled = true;
    return;
  }
  const app = initializeApp(config.firebase);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, async (user) => {
    if (!user) return showLogin();
    const admin = (config.adminEmail || "").toLowerCase();
    if (!admin || user.email?.toLowerCase() !== admin) {
      await signOut(auth);
      return showLogin(`${user.email} bu panele giremez.`);
    }
    showApp(user);
  });
}

function showLogin(error) {
  $("app").hidden = true;
  $("login").hidden = false;
  $("loginError").hidden = !error;
  $("loginError").textContent = error || "";
}

$("loginButton").onclick = async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") showLogin(e.message);
  }
};
$("logoutButton").onclick = () => signOut(auth);

async function showApp(user) {
  $("login").hidden = true;
  $("app").hidden = false;
  $("userEmail").textContent = user.email;
  $("scanButton").disabled = !config.scanEnabled;
  $("scanButton").title = config.scanEnabled ? "" : "GitHub bağlantısı henüz ayarlı değil (GITHUB_TOKEN / GITHUB_REPO)";
  await loadCampaigns();
  loadRuns(); // zamanlanmış işlerin özeti için (arka planda)
}

/* =========================
   SEKMELER
========================= */

$("tabs").onclick = (e) => {
  const tab = e.target.closest(".tab")?.dataset.tab;
  if (!tab) return;
  for (const b of document.querySelectorAll(".tab")) b.classList.toggle("active", b.dataset.tab === tab);
  for (const p of document.querySelectorAll(".tab-panel")) p.hidden = p.id !== `tab-${tab}`;
  if ((tab === "runs" || tab === "notify") && !state.runs) loadRuns();
  if (tab === "runs") loadGithubRuns();
};

/* =========================
   KAMPANYALAR
========================= */

async function loadCampaigns() {
  $("campaigns").innerHTML = `<div class="empty">Yükleniyor…</div>`;
  try {
    const [indexSnap, programsSnap] = await Promise.all([
      getDoc(doc(db, "meta", "programIndex")),
      getDocs(collection(db, "programCampaigns"))
    ]);
    state.index = indexSnap.data()?.programs ?? {};
    state.campaigns = [];
    state.docs = {};
    for (const d of programsSnap.docs) {
      const data = d.data();
      state.docs[d.id] = { bytes: new Blob([JSON.stringify(data)]).size, updatedAt: toDate(data.updatedAt) };
      for (const c of data.campaigns ?? []) state.campaigns.push({ ...c, programId: d.id });
    }
  } catch (e) {
    $("campaigns").innerHTML = `<div class="error">Firestore okunamadı: ${esc(e.message)}</div>`;
    return;
  }
  fillSectors();
  renderStats();
  renderPrograms();
  render(true);
}

function programName(id) {
  return state.index[id]?.name ?? id;
}

function renderStats() {
  const ids = Object.keys(state.index);
  const updated = Object.values(state.docs).map((d) => d.updatedAt).filter(Boolean).sort((a, b) => b - a)[0];
  const biggest = Object.entries(state.docs).sort((a, b) => b[1].bytes - a[1].bytes)[0];
  const ending = state.campaigns.filter((c) => c.endDate && c.endDate < todayStr()).length;
  const noBenefit = state.campaigns.filter((c) => !c.benefit?.types?.length).length;
  $("stats").innerHTML = [
    ["Yayındaki kampanya", tl(state.campaigns.length), `${ids.length} kart`],
    ["Son yayın", fmtTime(updated), "Firestore'a son yazım"],
    ["En büyük belge", biggest ? `${Math.round(biggest[1].bytes / 1024)} KB` : "-", biggest ? programName(biggest[0]) : ""],
    ["Kazancı bulunamayan", tl(noBenefit), `%${state.campaigns.length ? Math.round((noBenefit / state.campaigns.length) * 100) : 0}`],
    ["Süresi geçmiş (yayında)", tl(ending), "bir sonraki yayında düşer"]
  ]
    .map(([label, value, sub]) => `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(sub)}</em></div>`)
    .join("");

  // Bugünkü zamanlanmış işler: tıklayınca Taramalar sekmesi
  if (state.runs) {
    const today = scheduleDays(1)[0];
    const cells = SCHEDULE.map((s) => slotStatus(today, s));
    const due = cells.filter((c) => c.state !== "future" && c.state !== "none");
    const done = due.filter((c) => c.state === "ok").length;
    const problem = due.filter((c) => c.state === "bad" || c.state === "miss").length;
    const next = SCHEDULE.find((s, i) => cells[i].state === "future");
    $("stats").insertAdjacentHTML(
      "afterbegin",
      `<div class="stat clickable" id="todayStat"><span>Bugünkü zamanlanmış işler</span>
        <strong style="color:${problem ? "var(--bad)" : "var(--gain)"}">${done}/${due.length}${problem ? " ⚠️" : " ✓"}</strong>
        <em>${next ? `sıradaki: ${next.time} ${next.label.toLowerCase()}` : "bugünkü işler bitti"}</em></div>`
    );
    $("todayStat").onclick = () => document.querySelector('.tab[data-tab="runs"]').click();
  }
}

function renderPrograms() {
  const ids = Object.keys(state.index).sort((a, b) => (state.index[b].count ?? 0) - (state.index[a].count ?? 0));
  $("programs").innerHTML = ids
    .map((id) => {
      const p = state.index[id];
      const bytes = state.docs[id]?.bytes ?? 0;
      const pct = Math.min(100, Math.round((bytes / MAX_DOC) * 100));
      const level = pct > 80 ? "bad" : pct > 50 ? "warn" : "";
      return `<button class="program ${state.program === id ? "active" : ""}" data-id="${esc(id)}">
        <div class="name"><span>${esc(p.name)}</span><span>${tl(p.count ?? 0)}</span></div>
        <div class="meta">${esc(p.bank)} · ${Math.round(bytes / 1024)} KB · ${fmtTime(toDate(p.updatedAt))}</div>
        <div class="bar"><i class="${level}" style="width:${Math.max(pct, 1)}%"></i></div>
      </button>`;
    })
    .join("");
}

$("programs").onclick = (e) => {
  const id = e.target.closest(".program")?.dataset.id;
  if (!id) return;
  state.program = state.program === id ? "" : id;
  renderPrograms();
  render(true);
};

function fillSectors() {
  const counts = {};
  for (const c of state.campaigns) for (const s of c.sectors ?? []) counts[s] = (counts[s] ?? 0) + 1;
  const sel = $("sectorFilter");
  const current = sel.value;
  sel.innerHTML =
    `<option value="">Tüm sektörler</option>` +
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `<option value="${esc(k)}">${esc(SECTORS[k] ?? k)} (${n})</option>`)
      .join("");
  sel.value = current;
}

function filtered() {
  const q = fold($("search").value.trim());
  const sector = $("sectorFilter").value;
  const benefit = $("benefitFilter").value;
  const join = $("joinFilter").value;
  const quality = $("qualityFilter").value;

  const list = state.campaigns.filter((c) => {
    if (state.program && c.programId !== state.program) return false;
    if (sector && !(c.sectors ?? []).includes(sector)) return false;
    const types = c.benefit?.types ?? [];
    if (benefit === "none" ? types.length : benefit && !types.includes(benefit)) return false;
    if (join === "none" ? c.join : join && c.join !== join) return false;
    if (quality === "nodate" && c.endDate) return false;
    if (quality === "nosector" && !(c.sectors ?? []).includes("diger")) return false;
    if (quality === "noimage" && c.imageUrl) return false;
    if (q && !fold(`${c.title} ${c.merchant ?? ""} ${programName(c.programId)}`).includes(q)) return false;
    return true;
  });

  const sort = $("sortSelect").value;
  list.sort((a, b) => {
    if (sort === "amount") return (b.benefit?.amount ?? 0) - (a.benefit?.amount ?? 0);
    if (sort === "title") return a.title.localeCompare(b.title, "tr");
    return (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999");
  });
  return list;
}

function benefitText(b) {
  if (!b) return "";
  const parts = [];
  const t = b.types ?? [];
  if (b.amount) parts.push(`${tl(b.amount)} TL ${t.includes("puan") ? "puan" : t.includes("nakit") ? "iade" : t.includes("indirim") ? "indirim" : ""}`.trim());
  if (b.percent) parts.push(`%${b.percent} ${t.includes("nakit") ? "iade" : "indirim"}`);
  if (b.installments) parts.push(`${b.installments} taksit`);
  if (!parts.length && t.length) parts.push(t.join(" + "));
  return parts.join(" + ");
}

function daysLeft(end) {
  if (!end) return null;
  return Math.round((new Date(`${end}T00:00:00`) - new Date(`${todayStr()}T00:00:00`)) / 86400000);
}

function campaignCard(c) {
  const gain = benefitText(c.benefit);
  const left = daysLeft(c.endDate);
  const leftPill =
    left == null ? `<span class="pill warn">bitiş yok</span>`
    : left < 0 ? `<span class="pill bad">bitti</span>`
    : left <= 3 ? `<span class="pill bad">${left === 0 ? "bugün bitiyor" : `${left} gün`}</span>`
    : `<span class="pill">${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}</span>`;
  const img = c.imageUrl ? `<img src="${esc(c.imageUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<div class="noimg"></div>`;
  return `<article class="campaign" data-id="${esc(c.id)}">
    ${img}
    <div class="body">
      <div class="top"><span class="pill brand">${esc(programName(c.programId))}</span>${c.merchant ? `<span>${esc(c.merchant)}</span>` : ""}</div>
      <div class="title">${esc(c.title)}</div>
      <div class="gain ${gain ? "" : "none"}">${esc(gain || "Kazanç bulunamadı")}${c.benefit?.minSpend ? ` <span class="muted small">· min ${tl(c.benefit.minSpend)} TL</span>` : ""}</div>
      <div class="row">
        ${leftPill}
        <span class="pill">${esc(JOIN[c.join] ?? "katılım ?")}</span>
        ${(c.sectors ?? []).map((s) => `<span class="pill">${esc(SECTORS[s] ?? s)}</span>`).join("")}
      </div>
      <div class="summary" hidden></div>
    </div>
  </article>`;
}

function render(reset) {
  if (reset) state.shown = PAGE;
  const list = filtered();
  $("resultInfo").textContent = `${tl(list.length)} kampanya${list.length > state.shown ? ` · ilk ${state.shown} gösteriliyor` : ""}`;
  $("campaigns").innerHTML = list.length ? list.slice(0, state.shown).map(campaignCard).join("") : `<div class="empty">Bu filtrelerle kampanya yok.</div>`;
  $("moreButton").hidden = list.length <= state.shown;
}

for (const id of ["search", "sectorFilter", "benefitFilter", "joinFilter", "qualityFilter", "sortSelect"]) {
  $(id).addEventListener(id === "search" ? "input" : "change", () => render(true));
}
$("moreButton").onclick = () => {
  state.shown += PAGE;
  render(false);
};

// Kampanyaya tıklayınca: özeti göster (1 okuma), ikinci tıklamada bankanın sayfası
$("campaigns").onclick = async (e) => {
  const card = e.target.closest(".campaign");
  if (!card) return;
  const box = card.querySelector(".summary");
  const c = state.campaigns.find((x) => x.id === card.dataset.id);
  if (!box.hidden) {
    window.open(c.url, "_blank", "noopener");
    return;
  }
  box.hidden = false;
  box.textContent = "Özet yükleniyor…";
  try {
    const snap = await getDoc(doc(db, "campaignDetails", c.id));
    const summary = snap.data()?.summary;
    box.innerHTML = `${summary ? esc(summary) : '<span class="muted">Özet yok.</span>'}<br><a href="${esc(c.url)}" target="_blank" rel="noopener">Bankanın sayfası ↗</a> <span class="muted small">· ${esc(c.id)}</span>`;
  } catch (err) {
    box.textContent = `Özet okunamadı: ${err.message}`;
  }
};

/* =========================
   RAPORLAR (adminRuns)
========================= */

async function loadRuns() {
  $("runs").innerHTML = $("notifyRuns").innerHTML = $("schedule").innerHTML = `<div class="empty">Yükleniyor…</div>`;
  try {
    // Son 8 gün (zamanlanmış iş tablosu 7 gün gösterir); günde ~6 rapor
    const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const snap = await getDocs(
      query(collection(db, "adminRuns"), where("startedAt", ">=", since), orderBy("startedAt", "desc"), limit(120))
    );
    state.runs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const msg = e.code === "permission-denied" ? "Erişim yok: Firestore kurallarını yükledin mi? (firebase deploy --only firestore:rules)" : e.message;
    $("runs").innerHTML = $("notifyRuns").innerHTML = $("schedule").innerHTML = `<div class="error">${esc(msg)}</div>`;
    state.runs = null;
    return;
  }
  renderRuns();
  renderSchedule();
  renderStats();
}

/* =========================
   ZAMANLANMIŞ İŞLER TABLOSU
========================= */

/** Son n gün, Türkiye takvimine göre: [{ key: "2026-10-07", startUtc: ms (TR gece yarısı) }] — bugün ilk sırada */
function scheduleDays(n) {
  const trNow = new Date(Date.now() + TR_OFFSET);
  const midnightUtc = Date.UTC(trNow.getUTCFullYear(), trNow.getUTCMonth(), trNow.getUTCDate()) - TR_OFFSET;
  return Array.from({ length: n }, (_, i) => {
    const start = midnightUtc - i * 86400000;
    return { key: new Date(start + TR_OFFSET).toISOString().slice(0, 10), startUtc: start };
  });
}

function slotTime(day, slot) {
  const [h, m] = slot.time.split(":").map(Number);
  return day.startUtc + (h * 60 + m) * 60000;
}

/** Bir günün bir saati için durum: ok | bad | miss | wait | future | none (henüz kayıt tutulmuyordu) */
/** Raporun ait olduğu saat: cron biliniyorsa başladığı andan önceki en yakın o saat (gecikme ne olursa olsun) */
function reportSlotTime(r, slot) {
  const t = toDate(r.startedAt)?.getTime() ?? 0;
  if (r.schedule) {
    if (r.schedule !== slot.cron) return null;
    for (const d of scheduleDays(9)) {
      const at = slotTime(d, slot);
      if (at <= t + SLOT_BEFORE) return at; // bugün → geçmiş sırasıyla, ilk uyan en yakını
    }
    return null;
  }
  // Eski raporlar (cron bilgisi yok): saat penceresine göre
  return null;
}

function slotStatus(day, slot) {
  const at = slotTime(day, slot);
  const now = Date.now();
  const candidates = (state.runs ?? [])
    .filter((r) => r.kind === slot.kind && r.trigger === "zamanlanmış")
    .map((r) => ({ r, t: toDate(r.startedAt)?.getTime() ?? 0 }));
  const report =
    candidates.filter(({ r }) => r.schedule && reportSlotTime(r, slot) === at).sort((a, b) => a.t - b.t)[0] ??
    candidates
      .filter(({ r, t }) => !r.schedule && t >= at - SLOT_BEFORE && t <= at + SLOT_AFTER)
      .sort((a, b) => a.t - b.t)[0];

  if (report) return { state: report.r.ok ? "ok" : "bad", report: report.r, at };
  if (at > now) return { state: "future", at };
  if (now < at + SLOT_GIVEUP) return { state: "wait", at };
  // İlk zamanlanmış rapordan önceki saatler: sistem henüz kurulmamıştı
  const first = (state.runs ?? [])
    .filter((r) => r.trigger === "zamanlanmış")
    .map((r) => toDate(r.startedAt)?.getTime() ?? Infinity)
    .reduce((a, b) => Math.min(a, b), Infinity);
  if (at < first - SLOT_BEFORE) return { state: "none", at };
  return { state: "miss", at };
}

const hhmm = (ms) => new Date(ms + TR_OFFSET).toISOString().slice(11, 16);

function slotCell(day, slot) {
  const s = slotStatus(day, slot);
  const r = s.report;
  if (s.state === "future") return `<span class="slot none" title="Henüz zamanı gelmedi">—</span>`;
  if (s.state === "none") return `<span class="slot none" title="Bu tarihte henüz kayıt tutulmuyordu">·</span>`;
  if (s.state === "wait") return `<span class="slot wait" title="Zamanı geldi, rapor bekleniyor (GitHub gecikmesi ya da tarama sürüyor)"><b>⏳</b><small>bekleniyor</small></span>`;
  if (s.state === "miss") return `<span class="slot miss" title="Bu saatte zamanlanmış çalışma raporu yok"><b>✖</b><small>çalışmadı</small></span>`;

  const started = toDate(r.startedAt).getTime();
  const late = Math.round((started - s.at) / 60000);
  const extra =
    slot.kind === "notify"
      ? (r.notify?.sent?.length ? "🔔 gönderildi" : "yeni yok")
      : slot.publish
        ? (r.firestore?.published ? "📢 yayın" : "yayın yok!")
        : "ısınma";
  const lateText = late >= 60 ? `${Math.floor(late / 60)} sa ${late % 60} dk geç` : late > 5 ? `${late} dk geç` : "";
  const title = `${r.summary}${lateText ? ` · ${lateText} başladı` : ""}`;
  return `<span class="slot ${s.state} clickable" data-run="${esc(r.id)}" title="${esc(title)}">
    <b>${s.state === "ok" ? "✓" : "✖"} ${hhmm(started)}</b><small>${esc(extra)}</small>${
      late > 30 ? `<small class="late">⏱ ${esc(lateText)}</small>` : ""
    }</span>`;
}

function renderSchedule() {
  const days = scheduleDays(7);
  const head = SCHEDULE.map(
    (s) => `<th><b>${s.time}</b>${s.kind === "notify" ? "🔔 bildirim" : s.publish ? "📢 tarama + yayın" : "tarama"}</th>`
  ).join("");
  const rows = days
    .map((d, i) => {
      const label = i === 0 ? "Bugün" : i === 1 ? "Dün" : new Date(d.startUtc + TR_OFFSET).toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
      return `<tr class="${i === 0 ? "today" : ""}"><td><b>${esc(label)}</b></td>${SCHEDULE.map((s) => `<td>${slotCell(d, s)}</td>`).join("")}</tr>`;
    })
    .join("");
  $("schedule").innerHTML = `<table class="schedule"><thead><tr><th>Gün</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

// Hücreye tıklayınca o raporu aşağıda aç
$("schedule").onclick = (e) => {
  const id = e.target.closest("[data-run]")?.dataset.run;
  if (!id) return;
  const run = state.runs.find((r) => r.id === id);
  const target = document.querySelector(`#${run.kind === "notify" ? "notifyRuns" : "runs"} details[data-id="${CSS.escape(id)}"]`);
  if (run.kind === "notify") document.querySelector('.tab[data-tab="notify"]').click();
  if (target) {
    target.open = true;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

function okPill(r) {
  return r.ok ? `<span class="pill ok">başarılı</span>` : `<span class="pill bad">sorunlu</span>`;
}

function renderRuns() {
  const scrapes = state.runs.filter((r) => r.kind === "scrape");
  const notifies = state.runs.filter((r) => r.kind === "notify");

  $("runs").innerHTML = scrapes.length
    ? scrapes.map((r) => {
        const fs = r.firestore;
        const fsText = !fs ? "" : fs.published ? `${fs.writes} yazma · ${fs.reads} okuma` : "yayın yok";
        const sites = (r.sites ?? [])
          .map((s) => `<tr>
            <td>${s.ok ? "✅" : "❌"} ${esc(s.name)}</td>
            <td>${tl(s.count)}</td>
            <td>${(s.durationMs / 1000).toFixed(1)} sn</td>
            <td>${s.error ? `<span class="pill bad">${esc(s.error)}</span>` : ""}${s.warnings?.length ? `<ul class="warnings">${s.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}</td>
          </tr>`)
          .join("");
        const outcomes = (fs?.outcomes ?? []).map((o) => `<tr><td>${esc(o.name)}</td><td>${esc(o.action)}</td><td colspan="2">${esc(o.message)}</td></tr>`).join("");
        return `<details class="run" data-id="${esc(r.id)}">
          <summary>
            <span>${fmtTime(toDate(r.startedAt))}</span>
            <span class="hide-sm"><span class="pill">${esc(r.trigger ?? "")}</span></span>
            <span>${esc(r.summary)}</span>
            <span>${okPill(r)} <span class="muted small hide-sm">${esc(fsText)}</span></span>
          </summary>
          <div class="detail">
            <table><tr><th>Kart</th><th>Kampanya</th><th>Süre</th><th>Not</th></tr>${sites}</table>
            ${fs ? `<p class="small"><b>Firestore:</b> ${esc(fs.published ? fsText : fs.message ?? "yayın yapılmadı")}${fs.deletes ? ` · ${fs.deletes} silme` : ""}</p>` : ""}
            ${outcomes ? `<table><tr><th>Kart</th><th>Sonuç</th><th colspan="2">Açıklama</th></tr>${outcomes}</table>` : ""}
            ${r.runUrl ? `<p class="small"><a href="${esc(r.runUrl)}" target="_blank" rel="noopener">GitHub'da aç ↗</a></p>` : ""}
          </div>
        </details>`;
      }).join("")
    : `<div class="empty">Henüz rapor yok. Bir tarama "--save" ile bittiğinde burada görünür.</div>`;

  $("notifyRuns").innerHTML = notifies.length
    ? notifies.map((r) => {
        const n = r.notify ?? {};
        const slot = n.slot ? `${n.slot.slice(0, 2)}:${n.slot.slice(2)}` : "";
        const sent = (n.sent ?? []).map((s) => `<p class="small">📣 <b>${esc(s.topic)}</b> — ${esc(s.body)}</p>`).join("");
        return `<details class="run" data-id="${esc(r.id)}">
          <summary>
            <span>${fmtTime(toDate(r.startedAt))}</span>
            <span class="hide-sm"><span class="pill">${esc(slot)}</span></span>
            <span>${esc(r.summary)}</span>
            <span>${okPill(r)}</span>
          </summary>
          <div class="detail">${sent || '<p class="muted small">Bildirim gönderilmedi.</p>'}
            ${r.runUrl ? `<p class="small"><a href="${esc(r.runUrl)}" target="_blank" rel="noopener">GitHub'da aç ↗</a></p>` : ""}</div>
        </details>`;
      }).join("")
    : `<div class="empty">Henüz bildirim çalışması yok.</div>`;
}

$("runsRefresh").onclick = loadRuns;

/* =========================
   GITHUB + ŞİMDİ TARA
========================= */

async function api(path, init = {}) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const GH_STATUS = {
  queued: ["sırada", "warn"],
  in_progress: ["çalışıyor", "warn"],
  success: ["başarılı", "ok"],
  failure: ["hata", "bad"],
  cancelled: ["iptal", ""]
};

async function loadGithubRuns() {
  if (!config.scanEnabled) {
    $("ghRuns").innerHTML = `<div class="empty">GitHub bağlantısı henüz ayarlı değil. Repo kurulunca GITHUB_TOKEN ve GITHUB_REPO eklenecek.</div>`;
    return;
  }
  try {
    const { runs } = await api("/api/scan");
    $("ghRuns").innerHTML = runs.length
      ? runs.map((r) => {
          const [label, cls] = GH_STATUS[r.status === "completed" ? r.conclusion : r.status] ?? [r.conclusion ?? r.status, ""];
          return `<div class="gh-run">
            <span class="pill ${cls}">${esc(label)}</span>
            <span>${fmtTime(new Date(r.createdAt))}</span>
            <span class="muted small">${r.event === "schedule" ? "zamanlanmış" : "elle"}</span>
            <a class="small" href="${esc(r.url)}" target="_blank" rel="noopener">aç ↗</a>
          </div>`;
        }).join("")
      : `<div class="empty">Henüz çalışma yok.</div>`;
    // Çalışan iş varsa 20 sn'de bir yenile
    clearTimeout(state.ghTimer);
    if (runs.some((r) => r.status !== "completed")) state.ghTimer = setTimeout(loadGithubRuns, 20000);
  } catch (e) {
    $("ghRuns").innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}
$("ghRefresh").onclick = loadGithubRuns;

$("scanButton").onclick = () => {
  const ids = Object.keys(state.index).sort();
  $("scanSites").innerHTML =
    `<label><input type="checkbox" value="" checked /> Tümü</label>` +
    ids.map((id) => `<label><input type="checkbox" value="${esc(id)}" /> ${esc(programName(id))}</label>`).join("");
  $("scanError").hidden = true;
  $("scanDialog").showModal();
};

// "Tümü" ile tek tek seçim birbirini dışlar
$("scanSites").onchange = (e) => {
  const boxes = [...$("scanSites").querySelectorAll("input")];
  if (e.target.value === "") boxes.slice(1).forEach((b) => (b.checked = false));
  else boxes[0].checked = !boxes.slice(1).some((b) => b.checked);
};

$("scanForm").onsubmit = async (e) => {
  if (e.submitter?.value !== "ok") return;
  e.preventDefault();
  const sites = [...$("scanSites").querySelectorAll("input:checked")].map((b) => b.value).filter(Boolean);
  $("scanSubmit").disabled = true;
  try {
    await api("/api/scan", {
      method: "POST",
      body: JSON.stringify({ sites, publish: $("scanPublish").checked, detailMax: Number($("scanDetailMax").value) })
    });
    $("scanDialog").close();
    toast("Tarama başlatıldı. Durumu Taramalar sekmesinde.");
    setTimeout(loadGithubRuns, 4000);
  } catch (err) {
    $("scanError").textContent = err.message;
    $("scanError").hidden = false;
  } finally {
    $("scanSubmit").disabled = false;
  }
};

boot();
