import { youthVariant } from "../core/youth.js";
import enpara from "./enpara.js";

/*
 * Encard Genç (Enpara) — gençlere özel Encard.
 * Enpara listesinde "Encard Genç ile ..." ve öğrencilere yönelik kampanyalar.
 */
export default youthVariant(enpara, { id: "encard-genc", name: "Encard Genç", card: "encard genc" });
