import type { ConnectionWithToken } from "../store";
import type { RawMessage } from "../types";
import { collectSlack } from "./slack";

/**
 * Quellen anbinden: Es gibt zwei Arten.
 *
 * 1. Abrufen (pull): Der Connector holt im täglichen Lauf neue Nachrichten seit einem Zeitpunkt. Hier eintragen.
 *    Beispiel Slack.
 * 2. Zustellen (push): Die Quelle meldet Nachrichten selbst per Webhook (z.B. WhatsApp über Meta Cloud API oder GHL).
 *    Dafür gibt es keinen Eintrag hier. Der Webhook speichert mit insertMessages() aus store.ts in radar_messages,
 *    der tägliche Lauf bewertet sie wie alle anderen (siehe docs/RADAR.md).
 *
 * Neue Quelle = Typ in types.ts (SOURCE_KINDS), Connector hier, Verbindungsformular in der Oberfläche.
 */
export type Collector = (conn: ConnectionWithToken, sinceIso: string) => Promise<RawMessage[]>;

export const collectors: Record<string, Collector> = {
  slack: collectSlack
};
