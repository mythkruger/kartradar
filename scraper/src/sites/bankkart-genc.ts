import { youthStatus, youthVariant } from "../core/youth.js";
import bankkart from "./bankkart.js";

/*
 * Bankkart Genç (Ziraat Bankası) — KYK burs/kredi alan öğrencilerin kartı.
 * Bankkart'ın listesi + koşullarında Genç'in açıkça dahil olduğu kampanyalar.
 * Mantık: core/youth.ts
 */
export const gencStatus = (title: string | null | undefined, detail: string | null | undefined) =>
  youthStatus("bankkart genc", title, detail);

export default youthVariant(bankkart, { id: "bankkart-genc", name: "Bankkart Genç", card: "bankkart genc" });
