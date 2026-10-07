import { youthVariant } from "../core/youth.js";
import bonus from "./bonus.js";

/*
 * Bonus Genç (Garanti BBVA) — gençlere özel Bonus kartı.
 * Bonus listesinde başlıkları "Bonus Genç'le ..." ya da "Bonus'tan gençlere özel ..." olan
 * kampanyalar + koşullarında Bonus Genç'in açıkça dahil olduğu kampanyalar.
 */
export default youthVariant(bonus, { id: "bonus-genc", name: "Bonus Genç", card: "bonus genc" });
