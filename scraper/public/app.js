const campaignContainer = document.getElementById("campaignContainer");

const brandSearch = document.getElementById("brandSearch");

const scrapeButton = document.getElementById("scrapeButton");

const systemStatus = document.getElementById("systemStatus");

const campaignCount = document.getElementById("campaignCount");

const lastResult = document.getElementById("lastResult");

const nextRun = document.getElementById("nextRun");

const logsContainer = document.getElementById("logsContainer");

const refreshLogsButton = document.getElementById("refreshLogsButton");

const logsFilterLabel = document.getElementById("logsFilterLabel");

const logsLive = document.getElementById("logsLive");

/* Sunucudan gelen tüm loglar; ekranda seçili markaya göre süzülür */
let allLogs = [];

/* Scraper çalışırken logları canlı çekmek için */
let logPollTimer = null;

const brandButtonsContainer = document.getElementById("brandButtons");

/* siteId → marka adı (/api/sites üzerinden dolar) */
let siteNames = {};

let campaigns = [];

let selectedBrand = "all";

/* =========================
   KAMPANYALARI GETİR
========================= */

async function loadCampaigns() {
  try {
    campaignContainer.innerHTML = `
      <div class="loading">
        Kampanyalar yükleniyor...
      </div>
    `;

    const response = await fetch("/api/campaigns");

    if (!response.ok) {
      throw new Error("Kampanyalar alınamadı.");
    }

    campaigns = await response.json();

    updateCampaignCount();

    await loadOverview();

    renderCampaigns();
  } catch (error) {
    console.error(error);

    campaignContainer.innerHTML = `
      <div class="empty">
        Kampanyalar yüklenirken hata oluştu.
      </div>
    `;
  }
}

/* =========================
   KAMPANYA SAYISI
========================= */

function updateCampaignCount() {
  campaignCount.textContent = campaigns.length;
}

/* =========================
   FİLTRE + SAYFALAMA
   Yüzlerce kartı tek seferde çizmek tarayıcıyı kilitliyor;
   filtrelenmiş listeden 60'ar 60'ar gösteriyoruz.
========================= */

const PAGE_SIZE = 60;
let visibleCount = PAGE_SIZE;

const sectorFilter = document.getElementById("sectorFilter");
const benefitFilter = document.getElementById("benefitFilter");
const joinFilter = document.getElementById("joinFilter");
const qualityFilter = document.getElementById("qualityFilter");
const sortSelect = document.getElementById("sortSelect");
const clearFilters = document.getElementById("clearFilters");
const moreButton = document.getElementById("moreButton");
const resultInfo = document.getElementById("resultInfo");
const sizeContainer = document.getElementById("sizeContainer");

/* sektör anahtarı → etiket (/api/overview üzerinden dolar) */
let sectorNames = {};

function hasBenefit(c) {
  const b = c.benefit || {};
  return Boolean((b.types && b.types.length) || b.amount || b.percent || b.installments);
}

function filterCampaigns() {
  const q = brandSearch.value.trim().toLocaleLowerCase("tr");
  const sector = sectorFilter.value;
  const benefit = benefitFilter.value;
  const join = joinFilter.value;
  const quality = qualityFilter.value;

  return campaigns.filter((c) => {
    if (selectedBrand !== "all" && c.programId !== selectedBrand) return false;

    if (q) {
      const hay = `${c.title || ""} ${c.merchant || ""} ${c.programName || ""} ${c.summary || ""}`.toLocaleLowerCase("tr");
      if (!hay.includes(q)) return false;
    }

    if (sector && !(c.sectors || []).includes(sector)) return false;
    if (benefit && !(c.benefit?.types || []).includes(benefit)) return false;
    if (join === "none" ? c.join : join && c.join !== join) return false;

    if (quality === "noBenefit" && hasBenefit(c)) return false;
    if (quality === "noDate" && c.endDate) return false;
    if (quality === "noSector" && !(c.sectors || []).includes("diger")) return false;
    if (quality === "noJoin" && c.join) return false;

    return true;
  });
}

function sortCampaigns(list) {
  const mode = sortSelect.value;
  const copy = [...list];
  if (mode === "endSoon") copy.sort((a, b) => (a.endDate || "9999").localeCompare(b.endDate || "9999"));
  if (mode === "newest") copy.sort((a, b) => (b.firstSeenAt || "").localeCompare(a.firstSeenAt || ""));
  if (mode === "amount") copy.sort((a, b) => (b.benefit?.amount || 0) - (a.benefit?.amount || 0));
  return copy;
}

/* Filtre değişince baştan 60 kart */
function resetAndRender() {
  visibleCount = PAGE_SIZE;
  renderCampaigns();
}

function renderCampaigns() {
  const filtered = sortCampaigns(filterCampaigns());
  const shown = filtered.slice(0, visibleCount);

  resultInfo.textContent =
    filtered.length === campaigns.length
      ? `(${campaigns.length})`
      : `(${filtered.length} / ${campaigns.length})`;

  if (!filtered.length) {
    campaignContainer.innerHTML = `<div class="empty">Bu filtreye uyan kampanya yok.</div>`;
    moreButton.hidden = true;
    return;
  }

  const list = document.createElement("div");
  list.className = "campaign-list";
  shown.forEach((c) => list.appendChild(createCampaignCard(c)));

  campaignContainer.innerHTML = "";
  campaignContainer.appendChild(list);

  const remaining = filtered.length - shown.length;
  moreButton.hidden = remaining <= 0;
  moreButton.textContent = `Daha fazla göster (${remaining} kaldı)`;
}

moreButton.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderCampaigns();
});

[sectorFilter, benefitFilter, joinFilter, qualityFilter, sortSelect].forEach((el) =>
  el.addEventListener("change", resetAndRender)
);

clearFilters.addEventListener("click", () => {
  brandSearch.value = "";
  [sectorFilter, benefitFilter, joinFilter, qualityFilter].forEach((el) => (el.value = ""));
  sortSelect.value = "endSoon";
  resetAndRender();
});

/* =========================
   ÖZET: sektör listesi + Firestore boyutu
========================= */

async function loadOverview() {
  try {
    const response = await fetch("/api/overview");
    const data = await response.json();

    if (!Object.keys(sectorNames).length) {
      sectorNames = data.sectors || {};
      Object.entries(sectorNames).forEach(([key, label]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = label;
        sectorFilter.appendChild(opt);
      });
    }

    sizeContainer.innerHTML = data.programs
      .map((p) => {
        const pct = Math.min(100, Math.round((p.bytes / p.limit) * 100));
        const level = pct >= 80 ? "danger" : pct >= 50 ? "warn" : "ok";
        return `
          <div class="size-card">
            <div class="size-head">
              <strong>${escapeHtml(p.name)}</strong>
              <span>${p.count} kampanya · ${Math.round(p.bytes / 1024)} KB</span>
            </div>
            <div class="size-bar"><div class="size-fill ${level}" style="width:${Math.max(pct, 1)}%"></div></div>
            <span class="size-pct">doluluk: %${pct}</span>
          </div>`;
      })
      .join("");
  } catch (error) {
    console.error("Özet alınamadı:", error);
  }
}

/* =========================
   KAMPANYA KARTI
========================= */

function createCampaignCard(campaign) {
  const card = document.createElement("div");

  card.className = "campaign-card";

  const image = campaign.imageUrl || "";

  const date = formatDateRange(campaign.startDate, campaign.endDate);

  const sectors = (campaign.sectors || [])
    .map((s) => `<span class="tag tag-sector">${escapeHtml(sectorNames[s] || s)}</span>`)
    .join("");

  card.innerHTML = `
    <img class="campaign-image" src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async"
      onerror="this.style.visibility='hidden'">

    <div class="campaign-info">
      <div class="campaign-meta">
        <span class="program-chip">${escapeHtml(campaign.programName)}</span>
        ${campaign.merchant ? `<span class="merchant">${escapeHtml(campaign.merchant)}</span>` : ""}
      </div>

      <h3 class="campaign-title">${escapeHtml(campaign.title)}</h3>

      <div class="campaign-date${campaign.endDate ? "" : " missing"}">${escapeHtml(date)}</div>

      <div class="campaign-tags">
        ${benefitTags(campaign)}
        ${sectors}
        ${campaign.join ? `<span class="tag tag-join">katılım: ${escapeHtml(joinLabel(campaign.join))}</span>` : ""}
      </div>
    </div>

    <div class="campaign-action">
      <a href="${escapeHtml(campaign.url)}" target="_blank" rel="noopener noreferrer">İncele</a>
    </div>
  `;

  return card;
}

/* =========================
   KAZANÇ ETİKETLERİ
========================= */

function benefitTags(campaign) {
  const b = campaign.benefit || {};
  const tags = [];
  if (b.amount) tags.push(`${b.amount.toLocaleString("tr-TR")} TL`);
  if (b.percent) tags.push(`%${b.percent}`);
  if (b.installments) tags.push(`${b.installments} taksit`);
  const types = (b.types || []).join(" + ");
  const min = b.minSpend ? ` · min ${b.minSpend.toLocaleString("tr-TR")} TL` : "";
  if (!types && !tags.length) return `<span class="tag tag-warn">kazanç bulunamadı</span>`;
  return `<span class="tag tag-benefit">${escapeHtml(types)} ${escapeHtml(tags.join(", "))}${escapeHtml(min)}</span>`;
}

function joinLabel(join) {
  return { app: "uygulama", sms: "SMS", auto: "otomatik" }[join] || join;
}

/* =========================
   TARİH
========================= */

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) {
    return "Tarih belirtilmemiş";
  }

  if (!endDate) {
    return startDate;
  }

  return `${startDate} → ${endDate}`;
}

/* =========================
   MARKA ADI
========================= */

function getBrandName(brand) {
  return siteNames[brand] || brand;
}
/* =========================
   HTML GÜVENLİĞİ
========================= */

function escapeHtml(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");
}

/* =========================
   ARAMA
========================= */

let searchTimer = null;
brandSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(resetAndRender, 150);
});

/* =========================
   MARKA BUTONLARI
========================= */

function bindBrandButton(button) {
  button.addEventListener("click", async () => {
    const brand = button.dataset.brand;

    selectedBrand = brand;

    brandButtonsContainer.querySelectorAll(".brand-button").forEach((item) => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    resetAndRender();

    renderLogs();

    // Program butonu sadece süzer; taramayı üstteki buton başlatır.
    updateScrapeButton();
  });
}

async function loadSites() {
  try {
    const response = await fetch("/api/sites");
    const sites = await response.json();

    sites
      .filter((site) => site.enabled)
      .forEach((site) => {
        siteNames[site.id] = site.name;

        const button = document.createElement("button");
        button.className = "brand-button";
        button.dataset.brand = site.id;
        button.textContent = site.name;
        brandButtonsContainer.appendChild(button);
      });
  } catch (error) {
    console.error("Site listesi alınamadı:", error);
  }

  brandButtonsContainer.querySelectorAll(".brand-button").forEach(bindBrandButton);
}

loadSites();

/* =========================
   TEK MARKA SCRAPER
========================= */

async function runBrandScraper(brand) {
  try {
    systemStatus.textContent = `🟡 ${getBrandName(brand)} çalışıyor...`;

    lastResult.textContent = "Çalışıyor";

    startLogPolling();

    const response = await fetch(`/api/scrape/${brand}`, {
      method: "POST",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Scraper hatası.");
    }

    await loadCampaigns();

    await loadLogs();

    systemStatus.textContent = "🟢 Hazır";

    lastResult.textContent = `${result.total} kampanya`;
  } catch (error) {
    console.error(error);

    systemStatus.textContent = "🔴 Hata";

    lastResult.textContent = "Scraper hatası";
  } finally {
    stopLogPolling();

    await loadLogs();
  }
}

/* =========================
   TÜM SCRAPERLAR
========================= */

/* Üstteki buton: Tümü seçiliyse hepsini, program seçiliyse sadece onu tarar */
function scrapeButtonLabel() {
  return selectedBrand === "all" ? "Tümünü tara" : `${getBrandName(selectedBrand)} tara`;
}

function updateScrapeButton() {
  if (!scrapeButton.disabled) scrapeButton.textContent = scrapeButtonLabel();
}

scrapeButton.addEventListener("click", async () => {
  if (selectedBrand !== "all") {
    scrapeButton.disabled = true;
    scrapeButton.textContent = "Tarama çalışıyor...";
    try {
      await runBrandScraper(selectedBrand);
    } finally {
      scrapeButton.disabled = false;
      updateScrapeButton();
    }
    return;
  }

  scrapeButton.disabled = true;

  scrapeButton.textContent = "Tarama çalışıyor...";

  systemStatus.textContent = "🟡 Scraper çalışıyor...";

  lastResult.textContent = "Çalışıyor";

  startLogPolling();

  try {
    const response = await fetch("/api/scrape", {
      method: "POST",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Scrape hatası.");
    }

    await loadCampaigns();

    await loadLogs();

    systemStatus.textContent = "🟢 Hazır";

    lastResult.textContent = `${result.total} kampanya`;
  } catch (error) {
    console.error(error);

    systemStatus.textContent = "🔴 Hata";

    lastResult.textContent = "Scraper hatası";

    await loadLogs();

    alert("Scrape sırasında hata oluştu.");
  } finally {
    stopLogPolling();

    await loadLogs();

    scrapeButton.disabled = false;

    updateScrapeButton();
  }
});

/* =========================
   LOGLARI GETİR
========================= */

async function loadLogs() {
  try {
    const response = await fetch("/api/logs");

    if (!response.ok) {
      throw new Error("Loglar alınamadı.");
    }

    allLogs = await response.json();

    renderLogs();
  } catch (error) {
    console.error(error);

    logsContainer.innerHTML = `
      <div class="log-item">
        <span class="log-message">Loglar alınamadı.</span>
      </div>
    `;
  }
}

/* =========================
   CANLI LOG (scraper çalışırken)
========================= */

function startLogPolling() {
  stopLogPolling();

  logsLive.hidden = false;

  logPollTimer = setInterval(loadLogs, 1500);
}

function stopLogPolling() {
  if (logPollTimer) {
    clearInterval(logPollTimer);
    logPollTimer = null;
  }

  logsLive.hidden = true;
}

/* =========================
   LOGLARI GÖSTER
   Tümü → bütün loglar (marka etiketiyle)
   Marka → sadece o markanın logları
========================= */

function renderLogs() {
  const isAll = selectedBrand === "all";

  logsFilterLabel.textContent = isAll ? "Tümü" : getBrandName(selectedBrand);

  const logs = isAll ? allLogs : allLogs.filter((log) => log.siteId === selectedBrand);

  if (!logs.length) {
    logsContainer.innerHTML = `
      <div class="log-item">
        <span class="log-message">
          ${isAll ? "Henüz scraper çalıştırılmadı." : "Bu marka için henüz log yok."}
        </span>
      </div>
    `;

    return;
  }

  logsContainer.innerHTML = logs
    .map((log) => {
      const site =
        isAll && log.siteId
          ? `<span class="log-site">[${escapeHtml(getBrandName(log.siteId))}]</span>`
          : "";

      // Mesajın başındaki "Marka: " tekrarını at (marka zaten etiket/filtre olarak görünüyor)
      let message = log.message;
      if (log.siteId) {
        const prefix = `${getBrandName(log.siteId)}: `;
        if (message.startsWith(prefix)) message = message.slice(prefix.length);
      }

      return `
        <div class="log-item">
          <span class="log-time">${escapeHtml(log.time)}</span>
          <span class="log-level ${escapeHtml(log.level)}">${escapeHtml(log.level.toUpperCase())}</span>
          ${site}
          <span class="log-message">${escapeHtml(message)}</span>
        </div>
      `;
    })
    .join("");
}

/* =========================
   LOG YENİLE
========================= */

refreshLogsButton.addEventListener("click", loadLogs);

/* =========================
   İLK YÜKLEME
========================= */

/* =========================
   DURUM TAKİBİ
   Zamanlayıcı kendi başına tarama başlatabilir; panel bunu fark edip
   logları canlı gösterir, bitince kampanyaları yeniler.
========================= */

let serverWasRunning = false;

async function loadStatus() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();

    nextRun.textContent = status.nextRunText || "-";

    if (status.status === "running" && !serverWasRunning) {
      serverWasRunning = true;
      systemStatus.textContent = "🟡 Tarama çalışıyor...";
      if (!logPollTimer) startLogPolling();
    }

    if (status.status !== "running" && serverWasRunning) {
      serverWasRunning = false;
      systemStatus.textContent = "🟢 Hazır";
      stopLogPolling();
      await loadCampaigns();
      await loadLogs();
    }
  } catch (error) {
    console.error("Durum alınamadı:", error);
  }
}

setInterval(loadStatus, 10000);

loadCampaigns();

loadLogs();

loadStatus();
