// Betriebe aus dem Umgebungs-Guide der Villa Samalas, die man anschreiben kann (ohne Strände, Sehenswürdigkeiten, Läden).
// Alle Angaben sind Vorbelegung und werden vom Betrieb beim Upload überschrieben.
// Instagram-Namen stammen aus Verzeichnissen und Magazinen und sind NICHT bestätigt; der Betrieb korrigiert sie beim Upload.
// phoneSource: "google" = aus Google Maps, "public" = Website oder Verzeichnis. Google-Nummern vor dem ersten Versand prüfen.

export type Spot = {
  name: string;
  instagram?: string;
  phone?: string;
  phoneSource?: "google" | "public";
  website?: string;
  placeId?: string;
};

export const VENUE_SPOTS: Spot[] = [
  { name: "Shortcut Cafe Canggu" },
  { name: "Day by Day Coffee & Eatery" },
  { name: "Solace Spa Pererenan", phone: "+6282342521469", phoneSource: "google", placeId: "ChIJS_NwKQA50i0R0d6TGrUJFwg" },
  { name: "NOAH cafe" },
  { name: "TheHub Pererenan" },
  { name: "The Hula" },
  { name: "Warung Yess" },
  { name: "Warung Local" },
  { name: "Cinta Pererenan" },
  { name: "Suchata Bali Massage" },
  { name: "Gather brunch cafe" },
  { name: "Canggu Yoga Centre", phone: "+628121020389", phoneSource: "google", placeId: "ChIJhfSXckw50i0RMxcsFO6sUwU" },
  { name: "LOOP cafe" },
  { name: "Warung Apa?" },
  { name: "Mission Flow Studio" },
  { name: "The Path Wellness Center", phone: "+6287753863795", phoneSource: "google", placeId: "ChIJea5Fadc50i0R3Eo8wjij-EE" },
  { name: "Warung Sika" },
  { name: "Brunch Club Pererenan" },
  { name: "Hippie Fish", instagram: "hippiefishbali", phone: "+6281337596236", phoneSource: "public", website: "https://tavologroup.com/hippiefish/", placeId: "ChIJ5Wex6mc50i0RNSHWdVKVoPo" },
  { name: "Papi Chulo Beachfront", instagram: "papichulo.beachfront", phone: "+6282261567430", phoneSource: "google", placeId: "ChIJdzyeB9Y50i0RdVPG7hAp4QU" },
  { name: "La Brisa Bali", instagram: "labrisabali", phone: "+628113946666", phoneSource: "google", placeId: "ChIJrfg6aXY40i0RKbzqxLedkoY" },
  { name: "COMO Beach Club Canggu", instagram: "comobeachclub.canggu", phone: "+6281138209418", phoneSource: "public", website: "https://www.comohotels.com/como-beach-club-canggu", placeId: "ChIJAaAOMnY40i0R2im42qhNbIw" },
  { name: "FINNS Beach Club", instagram: "finnsbeachclub", phone: "+628113946666", phoneSource: "public", placeId: "ChIJSRrSTuNH0i0RX7GpKfK5k0k" },
  { name: "ZALI Pererenan" },
  { name: "Riviera Trattoria Pererenan" },
  { name: "Kilo Kitchen Pererenan" },
  { name: "HOME by Chef Wayan" },
  { name: "Shelter Restaurant Pererenan", phone: "+6282340040199", phoneSource: "google", placeId: "ChIJcfxIJo850i0RsrveoncQeBs" },
  { name: "WOODS Pererenan", phone: "+6285333935558", phoneSource: "google", placeId: "ChIJtTgayDI50i0RYmWmWkh-as8" },
  { name: "Bar Vera Bistro & Wine Bar" }
];
