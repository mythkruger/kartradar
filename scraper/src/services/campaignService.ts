import fs from "node:fs";
import path from "node:path";
import { today } from "../core/dates.js";
import type { Campaign } from "../core/types.js";

export type { Campaign } from "../core/types.js";

/*
 * Basit JSON dosyası ile kalıcı depolama (server yeniden başlayınca kaybolmaz).
 * Site sayısı yüzleri bulunca SQLite'a geçmek için sadece bu dosyayı değiştirmek yeterli.
 */
const STORE_FILE = path.resolve("data", "campaigns-store.json");

let campaigns: Campaign[] = load();

function load(): Campaign[] {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch {
    return [];
  }
}

function save() {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(campaigns, null, 2));
}

export function addOrUpdateCampaign(campaign: Campaign, persist = true) {
  const index = campaigns.findIndex((item) => item.id === campaign.id);

  if (index === -1) {
    campaigns.push({ ...campaign, firstSeenAt: campaign.lastSeenAt });
  } else {
    campaigns[index] = { ...campaign, firstSeenAt: campaigns[index].firstSeenAt ?? campaign.lastSeenAt };
  }

  if (persist) save();
}

/**
 * Bir sitenin başarılı taramasından sonra çağrılır.
 * Eski kampanya tutulmaz: sitenin listesi bu taramanın sonucuyla DEĞİŞTİRİLİR,
 * bitiş tarihi geçmiş olanlar da atılır.
 */
export function syncSiteCampaigns(siteId: string, fresh: Campaign[]) {
  const previous = new Map(campaigns.filter((c) => c.programId === siteId).map((c) => [c.id, c]));
  const active = fresh
    .filter((c) => c.isActive)
    .map((c) => ({ ...c, firstSeenAt: previous.get(c.id)?.firstSeenAt ?? c.lastSeenAt }));

  campaigns = [...campaigns.filter((c) => c.programId !== siteId), ...active];
  save();
}

/** Bitiş tarihi geçmiş kampanyaları yerel depodan temizler (sunucu açılışında çağrılır). */
export function pruneEnded() {
  const before = campaigns.length;
  campaigns = campaigns.filter((c) => c.isActive && (!c.endDate || c.endDate >= today()));
  if (campaigns.length !== before) save();
}

export function setCampaigns(newCampaigns: Campaign[]) {
  campaigns = newCampaigns;
  save();
}

export function getCampaigns(_options: { includeInactive?: boolean } = {}): Campaign[] {
  const todayStr = today();
  return campaigns.filter((c) => c.isActive && (!c.endDate || c.endDate >= todayStr));
}
