import { connectFirebase } from "./firestoreService.js";

/*
 * ÇALIŞMA RAPORLARI → admin panel
 *
 * Her tarama ve bildirim çalışması bitince Firestore'a tek bir küçük belge yazılır:
 *   adminRuns/{tarih-saat_tür}  { kind, trigger, startedAt, ok, summary, sites[], firestore, notify }
 * Panel son ~40 raporu okur. Uygulama bu koleksiyonu okuyamaz (kurallar: sadece admin).
 * Maliyet: çalışma başına 1 yazma (günde ~6).
 * Eski raporlar: 45 günden eskiler her raporda temizlenir (Firestore TTL ücretli planda; biz kendimiz siliyoruz).
 *   Tipik gün: 1 okuma + 6 silme. Sorgu boş dönerse okuma sayılmaz sayılır (en fazla 1).
 */
const KEEP_DAYS = 45;

export interface SiteReport {
  id: string;
  name: string;
  ok: boolean;
  count: number;
  durationMs: number;
  warnings: string[];
  error?: string;
}

export interface RunReport {
  kind: "scrape" | "notify";
  ok: boolean;
  summary: string;
  startedAt: Date;
  finishedAt?: Date;
  sites?: SiteReport[];
  firestore?: {
    published: boolean;
    message?: string;
    reads: number;
    writes: number;
    deletes: number;
    outcomes: Array<{ name: string; action: string; message: string }>;
  };
  notify?: { slot: string; message: string; sent: Array<{ topic: string; count: number; body: string }> };
}

/** Kim başlattı: GitHub zamanlayıcı, elle (panel / GitHub), ya da bilgisayardan */
function trigger() {
  if (process.env.KR_TRIGGER) return process.env.KR_TRIGGER; // workflow söyler (cron-job.org → "zamanlanmış")
  const e = process.env.GITHUB_EVENT_NAME;
  if (e === "schedule") return "zamanlanmış";
  if (e === "workflow_dispatch") return "elle";
  return e ? e : "bilgisayar";
}

function runUrl() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  return GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : null;
}

/** Firestore'a yaz. Hata olursa sessizce geçer: rapor yazılamadı diye tarama başarısız sayılmasın. */
export async function saveRunReport(report: RunReport): Promise<string | null> {
  if (process.env.FIRESTORE_DRY_RUN === "1") return null;
  try {
    const { db } = await connectFirebase();
    if (!db) return null;
    const started = report.startedAt;
    const id = `${started.toISOString().replace(/[:.]/g, "-")}_${report.kind}`;
    const expireAt = new Date(started.getTime() + KEEP_DAYS * 24 * 60 * 60 * 1000);
    // Firestore undefined kabul etmez: JSON'dan geçirip temizle
    const clean = JSON.parse(JSON.stringify({ ...report, startedAt: undefined, finishedAt: undefined }));
    await db.runDoc(id).set({
      ...clean,
      startedAt: started,
      finishedAt: report.finishedAt ?? new Date(),
      expireAt,
      trigger: trigger(),
      // Hangi zamanlanmış saat ("scrape-0843", "notify-1930"). Panel raporu gecikse bile doğru hücreye koyar.
      schedule: process.env.KR_SCHEDULE || null,
      runUrl: runUrl()
    });

    // 45 günden eski raporları sil (her seferinde en fazla 20)
    const old = await db
      .runsCollection()
      .where("startedAt", "<", new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000))
      .limit(20)
      .get();
    if (!old.empty) {
      const batch = db.batch();
      old.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return id;
  } catch (error) {
    console.warn(`Çalışma raporu yazılamadı: ${(error as Error).message.split("\n")[0]}`);
    return null;
  }
}
