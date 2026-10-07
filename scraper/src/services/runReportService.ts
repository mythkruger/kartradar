import { connectFirebase } from "./firestoreService.js";

/*
 * ÇALIŞMA RAPORLARI → admin panel
 *
 * Her tarama ve bildirim çalışması bitince Firestore'a tek bir küçük belge yazılır:
 *   adminRuns/{tarih-saat_tür}  { kind, trigger, startedAt, ok, summary, sites[], firestore, notify }
 * Panel son ~40 raporu okur. Uygulama bu koleksiyonu okuyamaz (kurallar: sadece admin).
 * Maliyet: çalışma başına 1 yazma (günde ~6).
 * expireAt: 45 gün sonrası. Firestore'da TTL politikası açılırsa eski raporlar kendiliğinden silinir.
 */

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
    const expireAt = new Date(started.getTime() + 45 * 24 * 60 * 60 * 1000);
    // Firestore undefined kabul etmez: JSON'dan geçirip temizle
    const clean = JSON.parse(JSON.stringify({ ...report, startedAt: undefined, finishedAt: undefined }));
    await db.runDoc(id).set({
      ...clean,
      startedAt: started,
      finishedAt: report.finishedAt ?? new Date(),
      expireAt,
      trigger: trigger(),
      runUrl: runUrl()
    });
    return id;
  } catch (error) {
    console.warn(`Çalışma raporu yazılamadı: ${(error as Error).message.split("\n")[0]}`);
    return null;
  }
}
