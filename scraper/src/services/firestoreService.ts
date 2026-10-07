import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { CollectionReference, DocumentReference, FieldValue, WriteBatch } from "firebase-admin/firestore";
import { today } from "../core/dates.js";
import type { Campaign, SiteConfig } from "../core/types.js";

/*
 * FIRESTORE YAYINI — kendi kendine dönen çark
 *
 * Firestore'da üç tür belge var:
 *
 *   programCampaigns/{programId} → o kart programının GÜNCEL kampanyaları (tek belge, dizi, ÖZETSİZ)
 *   meta/programIndex           → her programın özeti: { name, bank, hash, count, updatedAt, nextExpiry }
 *   campaignDetails/{campaignId} → tek kampanyanın özeti { programId, summary, expireAt }
 *                                  Uygulama sadece kullanıcı kampanyaya dokununca okur.
 *
 * Neden özet ayrı: özet program belgesinin yaklaşık yarısı. Liste küçülünce her kullanıcının
 * indirdiği veri yarıya iner (ücretsiz planda darboğaz okuma değil, indirilen veri miktarı).
 *
 * Kurallar:
 *  1. Eski veri yok. Program belgesi her yazımda tamamen değişir; biten / siteden kalkan
 *     kampanya diziden düşer. Config'ten kaldırılan programın belgesi silinir.
 *  2. Aynı veri tekrar yazılmaz. Scraper çalışma başında sadece meta/programIndex'i okur
 *     (1 okuma). Hash'i değişmeyen programa hiç dokunmaz.
 *  3. Değişen programlar + index tek bir batch'te yazılır (hepsi ya yazılır ya hiçbiri).
 *  4. Uygulama da önce index'i okur, sadece hash'i değişen programı indirir; gerisi
 *     telefonun önbelleğinden gelir (0 okuma).
 *  5. Özet belgeleri de sadece yeni / değişen kampanya için yazılır. Hangi özetin yazıldığı
 *     yerel bir kayıtta (data/published-details.json) tutulur; kampanya kalkınca özeti silinir.
 *     Kayıt kaybolursa bir sonraki yayında özetler yeniden yazılır (en fazla birkaç yüz yazma).
 *     Güvenlik ağı: expireAt alanı (bitiş + 2 gün) için Firestore TTL politikası açılabilir.
 *
 * Ayarlar:
 *  FIREBASE_SERVICE_ACCOUNT        service account JSON dosyasının yolu (ya da GOOGLE_APPLICATION_CREDENTIALS)
 *  FIREBASE_SERVICE_ACCOUNT_JSON   ya da dosyanın içeriği (sunucuda / GitHub secret olarak)
 *  FIRESTORE_COLLECTION       program koleksiyonu (varsayılan: programCampaigns)
 *  FIRESTORE_DRY_RUN=1        Firestore'a bağlanmadan ne yapılacağını loglar
 */

export const COLLECTION = process.env.FIRESTORE_COLLECTION ?? "programCampaigns";
export const INDEX_PATH = { collection: "meta", doc: "programIndex" };
export const RUNS_COLLECTION = "adminRuns";
export const DETAILS_COLLECTION = process.env.FIRESTORE_DETAILS_COLLECTION ?? "campaignDetails";
const ledgerFile = () => path.resolve(process.env.KR_LEDGER_FILE ?? path.join("data", "published-details.json"));
const BATCH_LIMIT = 450; // Firestore batch sınırı 500 işlem
export const MAX_DOC_BYTES = 900_000; // Firestore sınırı 1 MiB; pay bırakıyoruz

/** Firestore'a giden kampanya: sadece listede gereken alanlar (özet ayrı belgede) */
export type PublishedCampaign = Omit<
  Campaign,
  "programId" | "programName" | "bank" | "isActive" | "firstSeenAt" | "lastSeenAt" | "summary"
>;

export interface ProgramIndexEntry {
  name: string;
  bank: string;
  hash: string;
  count: number;
  updatedAt: number; // ms
  /** Dizideki en yakın bitiş tarihi. Bu tarih geçince program yeniden yazılmalı. */
  nextExpiry: string | null;
}

export interface ProgramIndex {
  programs: Record<string, ProgramIndexEntry>;
}

export type ProgramAction = "written" | "unchanged" | "deleted" | "skipped" | "error";

export interface ProgramOutcome {
  siteId: string;
  name: string;
  action: ProgramAction;
  message: string;
}

export interface CycleResult {
  enabled: boolean;
  dryRun: boolean;
  reads: number;
  writes: number;
  deletes: number;
  outcomes: ProgramOutcome[];
  message?: string;
}

/* =========================
   FIRESTORE BAĞLANTISI (tembel)
========================= */

export interface Db {
  programDoc(siteId: string): DocumentReference;
  detailDoc(campaignId: string): DocumentReference;
  indexDoc(): DocumentReference;
  /** meta koleksiyonunda başka bir belge (ör. notifyState). Uygulama okuyamaz (kurallar). */
  metaDoc(id: string): DocumentReference;
  /** Admin panelin okuduğu çalışma raporları (sadece admin okuyabilir, kurallar) */
  runDoc(id: string): DocumentReference;
  runsCollection(): CollectionReference;
  batch(): WriteBatch;
  serverTimestamp(): FieldValue;
}

let dbPromise: Promise<Db | null> | null = null;
let disabledReason = "";
let adminApp: import("firebase-admin/app").App | null = null;

function credentialsPath() {
  return process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
}

async function getDb(): Promise<Db | null> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    // Anahtar iki şekilde verilebilir (kod aynı, sadece çalıştığı makinedeki ayar değişir):
    //  FIREBASE_SERVICE_ACCOUNT       → anahtar dosyasının YOLU (bilgisayar / sunucu)
    //  FIREBASE_SERVICE_ACCOUNT_JSON  → anahtarın İÇERİĞİ (GitHub Actions secret, bulut ortamı)
    let serviceAccount: object;
    const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (inline) {
      try {
        serviceAccount = JSON.parse(inline);
      } catch {
        disabledReason = "FIREBASE_SERVICE_ACCOUNT_JSON geçerli bir JSON değil";
        return null;
      }
    } else {
      const credPath = credentialsPath();
      if (!credPath) {
        disabledReason = "FIREBASE_SERVICE_ACCOUNT ayarlı değil";
        return null;
      }
      try {
        serviceAccount = JSON.parse(fs.readFileSync(path.resolve(credPath), "utf8"));
      } catch {
        disabledReason = `service account dosyası okunamadı: ${credPath}`;
        return null;
      }
    }

    try {
      // Dinamik import: firebase-admin kurulu değilse sistemin geri kalanı çalışmaya devam eder
      const { initializeApp, cert, getApps } = await import("firebase-admin/app");
      const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

      const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount as never) });
      adminApp = app;
      const firestore = getFirestore(app);

      return {
        programDoc: (siteId) => firestore.collection(COLLECTION).doc(siteId),
        detailDoc: (id) => firestore.collection(DETAILS_COLLECTION).doc(id),
        indexDoc: () => firestore.collection(INDEX_PATH.collection).doc(INDEX_PATH.doc),
        metaDoc: (id) => firestore.collection(INDEX_PATH.collection).doc(id),
        runDoc: (id) => firestore.collection(RUNS_COLLECTION).doc(id),
        runsCollection: () => firestore.collection(RUNS_COLLECTION),
        batch: () => firestore.batch(),
        serverTimestamp: () => FieldValue.serverTimestamp()
      };
    } catch (error) {
      disabledReason = `firebase-admin yüklenemedi (npm install yapıldı mı?): ${(error as Error).message}`;
      return null;
    }
  })();

  return dbPromise;
}

/**
 * Firebase bağlantısı (bildirim adımı da aynı anahtarı kullanır).
 * Bağlanamazsa { db: null, reason } döner.
 */
export async function connectFirebase() {
  const db = await getDb();
  return { db, app: adminApp, reason: disabledReason };
}

/** Testler için: gerçek Firestore yerine sahte bir bağlantı ver */
export function setFirestoreForTesting(db: Db | null) {
  dbPromise = Promise.resolve(db);
}

/* =========================
   YARDIMCILAR
========================= */

export function toPublished(c: Campaign): PublishedCampaign {
  return {
    id: c.id,
    title: c.title,
    imageUrl: c.imageUrl,
    url: c.url,
    startDate: c.startDate,
    endDate: c.endDate,
    sectors: c.sectors,
    merchant: c.merchant,
    benefit: c.benefit,
    join: c.join
  };
}

/** Bitmiş kampanyaları at, sırayı sabitle (aynı içerik → aynı hash) */
function activeOnly(items: PublishedCampaign[], todayStr: string) {
  return items
    .filter((c) => !c.endDate || c.endDate >= todayStr)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function hashOf(site: SiteConfig, items: PublishedCampaign[]) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify({ n: site.name, b: site.bank, items }))
    .digest("hex")
    .slice(0, 16);
}

function nextExpiryOf(items: PublishedCampaign[]) {
  const dates = items.map((c) => c.endDate).filter((d): d is string => Boolean(d)).sort();
  return dates[0] ?? null;
}

/* =========================
   ÖZET BELGELERİ: yerel kayıt (hangi özet Firestore'da, hangi hash ile)
========================= */

type Ledger = Record<string, { p: string; h: string }>;

function loadLedger(): Ledger {
  try {
    return JSON.parse(fs.readFileSync(ledgerFile(), "utf8"));
  } catch {
    return {};
  }
}

function saveLedger(ledger: Ledger) {
  fs.mkdirSync(path.dirname(ledgerFile()), { recursive: true });
  fs.writeFileSync(ledgerFile(), JSON.stringify(ledger));
}

/** Testler için: yerel kaydı sıfırla (sadece KR_LEDGER_FILE ayarlıysa; gerçek kayda dokunmaz) */
export function resetLedgerForTesting() {
  if (!process.env.KR_LEDGER_FILE) throw new Error("Testte KR_LEDGER_FILE ayarla");
  try {
    fs.rmSync(ledgerFile());
  } catch {
    /* yok */
  }
}

function summaryHash(summary: string) {
  return crypto.createHash("sha1").update(summary).digest("hex").slice(0, 12);
}

/** Bitişten 2 gün sonra (Firestore TTL politikası açılırsa otomatik silinir) */
function expireAtOf(endDate: string | null) {
  if (!endDate) return null;
  const d = new Date(`${endDate}T00:00:00+03:00`);
  d.setDate(d.getDate() + 2);
  return d;
}

type Op =
  | { kind: "set"; ref: () => DocumentReference; data: object }
  | { kind: "delete"; ref: () => DocumentReference };

/* =========================
   ÇARK: bir çalışmanın sonuçlarını Firestore'a işle
========================= */

export interface SiteRunResult {
  site: SiteConfig;
  ok: boolean;
  campaigns: Campaign[];
}

/**
 * @param runs         Bu çalışmada taranan siteler ve sonuçları
 * @param allSiteIds   Config'te tanımlı TÜM siteler. Verilirse index'te olup burada
 *                     olmayan programlar Firestore'dan silinir. (Sadece tam çalışmada ver.)
 */
export async function publishCycle(
  runs: SiteRunResult[],
  options: { allSiteIds?: string[]; force?: boolean } = {}
): Promise<CycleResult> {
  const dryRun = process.env.FIRESTORE_DRY_RUN === "1";
  const db = dryRun ? null : await getDb();
  const result: CycleResult = { enabled: true, dryRun, reads: 0, writes: 0, deletes: 0, outcomes: [] };

  if (!db && !dryRun) {
    return { ...result, enabled: false, message: `Firestore kapalı: ${disabledReason}` };
  }

  const todayStr = today();

  try {
    // 1) Index: çalışma başına tek okuma
    let index: ProgramIndex = { programs: {} };
    if (db) {
      const snap = await db.indexDoc().get();
      result.reads++;
      if (snap.exists) index = { programs: snap.get("programs") ?? {} };
    }

    const nextPrograms: Record<string, ProgramIndexEntry> = { ...index.programs };
    const writes: Array<{ siteId: string; data: object }> = [];
    const deletes: string[] = [];

    // Özetler: yerel kayda göre sadece yeni / değişen yazılır, kalkan silinir
    const ledger = loadLedger();
    const nextLedger: Ledger = { ...ledger };
    const detailOps: Op[] = [];
    let detailWrites = 0;
    let detailDeletes = 0;

    const syncDetails = (siteId: string, campaigns: Campaign[]) => {
      const keep = new Set<string>();
      for (const c of campaigns) {
        const summary = c.summary?.trim();
        if (!summary) continue;
        keep.add(c.id);
        const h = summaryHash(summary);
        if (ledger[c.id]?.h === h && !options.force) continue;
        const expireAt = expireAtOf(c.endDate);
        detailOps.push({
          kind: "set",
          ref: () => db!.detailDoc(c.id),
          data: { programId: siteId, summary, ...(expireAt ? { expireAt } : {}) }
        });
        nextLedger[c.id] = { p: siteId, h };
        detailWrites++;
      }
      for (const [id, entry] of Object.entries(ledger)) {
        if (entry.p === siteId && !keep.has(id)) {
          detailOps.push({ kind: "delete", ref: () => db!.detailDoc(id) });
          delete nextLedger[id];
          detailDeletes++;
        }
      }
    };

    // 2) Her program için karar
    for (const run of runs) {
      const { site } = run;
      const prev = index.programs[site.id];
      const outcome = (action: ProgramAction, message: string) =>
        result.outcomes.push({ siteId: site.id, name: site.name, action, message });

      let items: PublishedCampaign[];

      if (run.ok && run.campaigns.length > 0) {
        items = activeOnly(run.campaigns.map(toPublished), todayStr);
        syncDetails(
          site.id,
          run.campaigns.filter((c) => !c.endDate || c.endDate >= todayStr)
        );
      } else if (prev && prev.nextExpiry && prev.nextExpiry < todayStr && db) {
        // Site bu sefer veri vermedi ama Firestore'daki listede süresi dolan var → temizle
        const snap = await db.programDoc(site.id).get();
        result.reads++;
        items = activeOnly((snap.get("campaigns") as PublishedCampaign[] | undefined) ?? [], todayStr);
      } else {
        outcome("skipped", run.ok ? "kampanya bulunamadı, mevcut veriye dokunulmadı" : "site hata verdi, mevcut veriye dokunulmadı");
        continue;
      }

      const hash = hashOf(site, items);

      if (!options.force && prev?.hash === hash) {
        outcome("unchanged", `değişiklik yok (${items.length} kampanya)`);
        continue;
      }

      const data = {
        programId: site.id,
        programName: site.name,
        bank: site.bank,
        count: items.length,
        hash,
        campaigns: items
      };

      const bytes = docBytes(data);
      if (bytes > MAX_DOC_BYTES) {
        outcome("error", `belge çok büyük (${Math.round(bytes / 1024)} KB), yazılmadı`);
        continue;
      }

      writes.push({ siteId: site.id, data });
      nextPrograms[site.id] = {
        name: site.name,
        bank: site.bank,
        hash,
        count: items.length,
        updatedAt: Date.now(),
        nextExpiry: nextExpiryOf(items)
      };

      const prevCount = prev?.count ?? 0;
      outcome("written", `${items.length} kampanya (önceki: ${prevCount}), ${Math.round(bytes / 1024)} KB`);
    }

    // 3) Config'ten kaldırılan programlar → sil
    if (options.allSiteIds) {
      for (const siteId of Object.keys(index.programs)) {
        if (!options.allSiteIds.includes(siteId)) {
          deletes.push(siteId);
          delete nextPrograms[siteId];
          syncDetails(siteId, []);
          result.outcomes.push({
            siteId,
            name: index.programs[siteId].name,
            action: "deleted",
            message: "config'te yok, Firestore'dan silindi"
          });
        }
      }
    }

    // 4) Yazım: önce özetler (parça parça), en son programlar + index (tek batch)
    if (writes.length === 0 && deletes.length === 0 && detailOps.length === 0) return result;

    if (dryRun || !db) {
      result.message =
        `[deneme] ${writes.length} program yazılacak, ${deletes.length} silinecek, ` +
        `${detailWrites} özet yazılacak, ${detailDeletes} özet silinecek`;
      return result;
    }

    for (let i = 0; i < detailOps.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const op of detailOps.slice(i, i + BATCH_LIMIT)) {
        if (op.kind === "set") batch.set(op.ref(), op.data);
        else batch.delete(op.ref());
      }
      await batch.commit();
    }
    saveLedger(nextLedger);

    if (writes.length || deletes.length) {
      const batch = db.batch();
      for (const w of writes) batch.set(db.programDoc(w.siteId), { ...w.data, updatedAt: db.serverTimestamp() });
      for (const siteId of deletes) batch.delete(db.programDoc(siteId));
      batch.set(db.indexDoc(), { programs: nextPrograms, updatedAt: db.serverTimestamp() });
      await batch.commit();
      result.writes += writes.length + 1; // +1 index
      result.deletes += deletes.length;
    }

    result.writes += detailWrites;
    result.deletes += detailDeletes;
    if (detailWrites || detailDeletes) {
      result.outcomes.push({
        siteId: "",
        name: "Özetler",
        action: "written",
        message: `${detailWrites} özet yazıldı, ${detailDeletes} özet silindi`
      });
    }
    return result;
  } catch (error) {
    return { ...result, message: `Firestore hatası: ${(error as Error).message.split("\n")[0]}` };
  }
}

/** Program belgesinin yaklaşık boyutu (Firestore sınırı 1 MiB). Admin panel de bunu gösterir. */
export function docBytes(data: unknown) {
  return Buffer.byteLength(JSON.stringify(data));
}
