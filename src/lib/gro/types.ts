export type GroRole = "viewer" | "editor" | "admin";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  isTemplate: boolean;
  active: boolean;
  elev8Url: string | null;
  hasToken: boolean;
  listingTags: string[];
  baseGuests: number;
};

export type Constant = { key: string; label: string; value: string; num: number | null; unit: string; note: string };

export type Process = {
  id: string;
  key: string;
  grp: string;
  title: string;
  region: string;
  role: string;
  trigger: string;
  goal: string;
  steps: string[];
  rules: string[];
  escalation: string;
  openPoints: string[];
  origin: string;
  status: "entwurf" | "freigegeben";
  version: number;
  owner: string;
  reviewedAt: string | null;
  sort: number;
  updatedAt: string;
  updatedBy: string | null;
};

export type MessageTemplate = { id: string; key: string; title: string; lang: string; when: string; body: string; sort: number };
export type Shortcut = { id: string; phrase: string; processKey: string };
export type Escalation = { id: string; topic: string; target: string };
export type OpenItem = { id: string; key: string; title: string; question: string; proposal: string; status: "offen" | "entschieden"; decision: string; decidedBy: string | null; decidedAt: string | null };
export type ObjectOverlay = { listingId: string; citytaxPortal: string; notes: string; hasCodes: boolean };

export const GROUPS: Record<string, string> = {
  zugang: "Zugang und Schlösser",
  checkin: "Check-in und Verifizierung",
  citytax: "Citytax",
  zahlung: "Zahlungen",
  gaeste: "Gäste und Zusatzleistungen",
  buchung: "Buchungen und Anfragen",
  neu: "Neu im Entwurf"
};
