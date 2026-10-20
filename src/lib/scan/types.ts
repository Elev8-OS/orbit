/** Gemeinsame Typen des Scan-Moduls (Server und Browser). */

import type { CrmField, CrmValues } from "./crm";

export type ExtractedContact = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company: string | null;
  title: string | null;
  website: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  timezone: string | null;
  linkedin: string | null;
  industry: string | null;
  /** ISO 639-1, z. B. "de" */
  language: string | null;
  roleTags: string[];
  notes: string | null;
  sourceType: "business_card" | "linkedin_profile" | "other";
  /** Ganz oder teilweise handschriftlich */
  handwritten: boolean;
  /** Felder, bei denen Claude sich beim Lesen nicht sicher ist (z. B. 0/o, 1/l in der E-Mail) */
  uncertain: string[];
  /** Anzahl Units/Objekte, nur wenn auf der Karte oder in einer Handnotiz ersichtlich */
  units: number | null;
  /** Genutztes PMS / Channel Manager, wie gelesen (z. B. "Guesty", "Excel") */
  pms: string | null;
  /** Werte für GHL-Kontaktfelder nach Feld-ID (abgeleitet aus units/pms oder von Claude gewählt) */
  crm: CrmValues;
};

export type ScanContact = Omit<ExtractedContact, "roleTags" | "sourceType" | "handwritten" | "uncertain" | "units" | "pms" | "crm"> & {
  units?: number | null;
  pms?: string | null;
  crm?: CrmValues;
  roleTags?: string[];
  sourceType?: ExtractedContact["sourceType"];
  handwritten?: boolean;
  uncertain?: string[];
};

export type SendRequest = {
  contact: ScanContact;
  tags: string[];
  /** Messe aus /messen, deren Tags und Quelle übernommen werden (optional) */
  eventId: string | null;
  /** Fotos als JPEG-Data-URLs; werden in die GHL-Mediathek geladen und als Notiz verlinkt */
  photos: { front?: string | null; back?: string | null };
  /** Vorhandenen Kontakt bewusst aktualisieren (nach Dublettenhinweis) */
  confirmUpdate?: boolean;
};

export type SendResult = {
  ok: true;
  contactId: string;
  isNew: boolean;
  contactUrl: string;
  photos: number;
  warnings: string[];
};

export type DuplicateHit = {
  found: boolean;
  contact?: { id: string; name: string; company: string; email: string; phone: string; url: string };
};

export type ScanHistoryEntry = {
  id: string;
  userName: string;
  eventId: string | null;
  contactId: string | null;
  isNew: boolean;
  name: string;
  company: string;
  tags: string[];
  createdAt: string;
};

export type ScanContext = {
  user: { id: string; name: string; email: string; ghlUserId: string | null };
  ghlConfigured: boolean;
  claudeConfigured: boolean;
  enrichConfigured: boolean;
  events: { id: string; name: string; slug: string; tags: string[] }[];
  tags: string[];
  history: ScanHistoryEntry[];
  /** GHL-Kontaktfelder, die der Scanner füllt (SCAN_CRM_FIELDS) */
  crmFields: CrmField[];
};
