import { today } from "../core/dates.js";
import { connectFirebase, type ProgramIndex, type PublishedCampaign } from "./firestoreService.js";

/*
 * YENİ KAMPANYA BİLDİRİMİ — kullanıcı başına günde TEK bildirim
 *
 * Ne zaman: kullanıcı uygulamada saatini seçer → öğle 12:30 ya da akşam 19:30.
 *           GitHub Actions bu saatlerde `npm run notify -- --slot 1230|1930` çalıştırır.
 * Nasıl:    Her saat için TEK bir FCM konusu var: yeni_1230, yeni_1930.
 *           Scraper o konuya tek bir sessiz (data) mesaj gönderir: hangi kartta kaç yeni kampanya var
 *              { type: "yeni", counts: '{"axess":3,"world":1,"bonus":2}' }
 *           Telefon mesajı alınca kullanıcının KENDİ kartlarını süzer ve tek bildirim gösterir:
 *              "KartRadar — Yeni kampanyalar radarımıza takıldı! Axess: 3 · World: 1"
 *           Kullanıcının kartlarında yeni yoksa bildirim gösterilmez.
 *           Firestore'da kullanıcı / cihaz kaydı YOK: kullanıcı sayısı artsa da okuma artmaz.
 *
 * Yayınlanan veriye HİÇBİR alan eklenmez (scraper'ın yazımları değişmez). Yeni kampanyayı bulmak için
 * bildirim adımı kendi kaydını tutar: meta/notifyState = { "1930": { axess: { hash, ids: [...] } } }
 *
 * Maliyet (çalışma başına):
 *   meta/programIndex     1 okuma
 *   meta/notifyState      1 okuma
 *   programCampaigns/{id} 1 okuma — SADECE son bildirimden beri hash'i değişen kart için
 *   meta/notifyState      1 yazma — sadece değişiklik varsa
 *   → en kötü gün: 2 çalışma × (2 + 14) = 32 okuma, 2 yazma. Kullanıcı sayısından bağımsız.
 *
 * İlk çalışma: bir kart o saat için ilk kez görülüyorsa mevcut kampanyaları kaydedilir, sayılmaz.
 */

export const SLOTS = ["1230", "1930"] as const;
export type Slot = (typeof SLOTS)[number];

export const STATE_DOC = "notifyState";

export interface ProgramMemory {
  hash: string;
  ids: string[];
}

/** saat → kart → son bildirimde bilinen kampanyalar */
export type NotifyState = Partial<Record<Slot, Record<string, ProgramMemory>>>;

export const topicFor = (slot: Slot) => `yeni_${slot}`;

/** Hangi kartların belgesi okunmalı: hash'i son bildirimden beri değişenler */
export function programsToCheck(index: ProgramIndex, state: NotifyState, slot: Slot): string[] {
  const memory = state[slot] ?? {};
  return Object.entries(index.programs)
    .filter(([id, entry]) => memory[id]?.hash !== entry.hash)
    .map(([id]) => id)
    .sort();
}

/**
 * Saf karar fonksiyonu (test edilebilir).
 * @param docs okunan kart belgeleri: kart → { hash, kampanyalar }
 */
export function planNotifications(
  index: ProgramIndex,
  state: NotifyState,
  slot: Slot,
  docs: Record<string, { hash: string; campaigns: Pick<PublishedCampaign, "id" | "title" | "endDate">[] }>,
  day: string
) {
  const memory = state[slot] ?? {};
  const nextMemory: Record<string, ProgramMemory> = {};
  const sends: Array<{ programId: string; programName: string; campaigns: Pick<PublishedCampaign, "id" | "title">[] }> = [];

  for (const [programId, entry] of Object.entries(index.programs)) {
    const doc = docs[programId];
    if (!doc) {
      if (memory[programId]) nextMemory[programId] = memory[programId]; // değişmedi
      continue;
    }
    const known = memory[programId] ? new Set(memory[programId].ids) : null;
    const fresh = known
      ? doc.campaigns.filter((c) => !known.has(c.id) && (!c.endDate || c.endDate >= day))
      : []; // ilk kez görülen kart: sessizce kaydet
    if (fresh.length) {
      sends.push({ programId, programName: entry.name, campaigns: fresh.map(({ id, title }) => ({ id, title })) });
    }
    nextMemory[programId] = { hash: doc.hash, ids: doc.campaigns.map((c) => c.id).sort() };
  }
  // Config'ten kalkan kartlar kayıttan düşer (index'te yoksa nextMemory'ye girmez)

  const changed = JSON.stringify(memory) !== JSON.stringify(nextMemory);
  return { sends, nextState: { ...state, [slot]: nextMemory } as NotifyState, changed };
}

/**
 * Bildirim metni. Telefon da aynı metni kendi kartlarıyla kurar (app/lib/push/push_service.dart).
 * Burada sadece deneme çıktısı için.
 */
export function messageFor(counts: Array<{ name: string; count: number }>) {
  const parts = [...counts].sort((a, b) => b.count - a.count).map((c) => `${c.name}: ${c.count}`);
  return { title: "KartRadar", body: `Yeni kampanyalar radarımıza takıldı! ${parts.join(" · ")}` };
}

export interface NotifyResult {
  ok: boolean;
  message: string;
  reads: number;
  writes: number;
  sent: Array<{ topic: string; count: number; title: string; body: string }>; // en fazla 1 mesaj
}

export async function runNotifications(slot: Slot, opts: { dryRun?: boolean } = {}): Promise<NotifyResult> {
  const result: NotifyResult = { ok: true, message: "", reads: 0, writes: 0, sent: [] };
  const { db, app, reason } = await connectFirebase();
  if (!db || !app) return { ...result, ok: false, message: `Firebase kapalı: ${reason}` };

  const day = today();
  const indexSnap = await db.indexDoc().get();
  const stateSnap = await db.metaDoc(STATE_DOC).get();
  result.reads += 2;

  const index: ProgramIndex = { programs: indexSnap.get("programs") ?? {} };
  const state: NotifyState = (stateSnap.exists ? stateSnap.data() : {}) as NotifyState;

  const docs: Parameters<typeof planNotifications>[3] = {};
  for (const programId of programsToCheck(index, state, slot)) {
    const snap = await db.programDoc(programId).get();
    result.reads++;
    if (!snap.exists) continue;
    docs[programId] = {
      hash: snap.get("hash") ?? index.programs[programId].hash,
      campaigns: (snap.get("campaigns") as PublishedCampaign[] | undefined) ?? []
    };
  }

  const plan = planNotifications(index, state, slot, docs, day);

  const counts = Object.fromEntries(plan.sends.map((p) => [p.programId, p.campaigns.length]));
  if (plan.sends.length) {
    const topic = topicFor(slot);
    const preview = messageFor(plan.sends.map((p) => ({ name: p.programName, count: p.campaigns.length })));
    const total = plan.sends.reduce((n, p) => n + p.campaigns.length, 0);
    result.sent.push({ topic, count: total, ...preview });

    if (!opts.dryRun) {
      const { getMessaging } = await import("firebase-admin/messaging");
      // Sessiz (data) mesaj: telefon kendi kartlarını süzüp tek bildirim gösterir
      await getMessaging(app).send({
        topic,
        data: { type: "yeni", slot, day, counts: JSON.stringify(counts) },
        android: { priority: "high", ttl: 6 * 60 * 60 * 1000 }, // 6 saat içinde ulaşmazsa boşver
        apns: {
          headers: { "apns-priority": "5", "apns-push-type": "background" },
          payload: { aps: { contentAvailable: true } }
        }
      });
    }
  }

  if (plan.changed && !opts.dryRun) {
    await db.metaDoc(STATE_DOC).set(plan.nextState);
    result.writes++;
  }
  result.message = result.sent.length
    ? `${Object.keys(counts).length} kartta yeni kampanya, tek mesaj${opts.dryRun ? " (deneme, gönderilmedi)" : " gönderildi"}`
    : "yeni kampanya yok, bildirim gönderilmedi";
  return result;
}

/**
 * Deneme bildirimi: o saatin konusuna, index'teki her kart için "2 yeni" diyen tek mesaj.
 * Kayda (notifyState) dokunmaz. Sadece geliştirirken kendi telefonunda denemek için.
 */
export async function sendTestNotification(slot: Slot): Promise<NotifyResult> {
  const result: NotifyResult = { ok: true, message: "", reads: 0, writes: 0, sent: [] };
  const { db, app, reason } = await connectFirebase();
  if (!db || !app) return { ...result, ok: false, message: `Firebase kapalı: ${reason}` };
  const indexSnap = await db.indexDoc().get();
  result.reads++;
  const programs = Object.keys(indexSnap.get("programs") ?? {});
  const counts = Object.fromEntries(programs.map((id) => [id, 2]));
  const topic = topicFor(slot);
  const { getMessaging } = await import("firebase-admin/messaging");
  await getMessaging(app).send({
    topic,
    data: { type: "yeni", slot, day: `test-${Date.now()}`, counts: JSON.stringify(counts) },
    android: { priority: "high", ttl: 60 * 60 * 1000 }
  });
  result.sent.push({ topic, count: programs.length * 2, title: "KartRadar", body: "(deneme) her kartta 2 yeni" });
  result.message = "deneme mesajı gönderildi";
  return result;
}
