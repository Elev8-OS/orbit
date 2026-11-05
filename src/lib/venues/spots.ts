// Betriebe aus den Umgebungs-Guides der Villen, die man anschreiben kann (ohne Strände, Sehenswürdigkeiten, Läden).
// Quelle: Wissensbasis der Villa Patuha in Elev8, Datei "Greater Canggu: Restaurants, Cafés, Bars & Nachtleben" (45 Betriebe),
// ergänzt um die früheren Einträge aus dem Guide der Villa Samalas, die dort nicht mehr vorkommen. Nichts wird gelöscht.
// Alle Angaben sind Vorbelegung und werden vom Betrieb beim Upload überschrieben.
// Instagram-Namen stammen aus Verzeichnissen und Magazinen und sind NICHT bestätigt; der Betrieb korrigiert sie beim Upload.
// phoneSource: "google" = aus Google Maps, "public" = Website oder Verzeichnis. Google-Nummern vor dem ersten Versand prüfen.
// area, price, fit: Ort, Preisklasse und Einstufung ("Top-Empfehlung", "Nur mit Hinweis empfehlen" ...) laut Guide.
// aliases: andere Schreibweisen, unter denen der Betrieb schon angelegt sein kann; so entsteht kein Duplikat.

export type Spot = {
  name: string;
  aliases?: string[];
  instagram?: string;
  phone?: string;
  phoneSource?: "google" | "public";
  website?: string;
  placeId?: string;
  area?: string;
  price?: string;
  fit?: string;
};

export const VENUE_SPOTS: Spot[] = [
  // Restaurants
  { name: "HOME by Chef Wayan", area: "Pererenan", price: "gehoben", fit: "Top-Empfehlung" },
  { name: "Santanera", area: "Canggu (Batu Bolong)", price: "gehoben", fit: "Top-Empfehlung" },
  { name: "Shelter Restaurant Pererenan", phone: "+6282340040199", phoneSource: "google", placeId: "ChIJcfxIJo850i0RsrveoncQeBs", area: "Pererenan", price: "gehoben", fit: "Top-Empfehlung" },
  { name: "IWA Restaurant at Hotel Tugu Bali", area: "Canggu (Batu Bolong)", price: "gehoben", fit: "Top-Empfehlung für indonesische Küche" },
  { name: "WOODS Pererenan", phone: "+6285333935558", phoneSource: "google", placeId: "ChIJtTgayDI50i0RYmWmWkh-as8", area: "Pererenan", price: "gehoben", fit: "Top-Empfehlung" },
  { name: "Ulekan Bali", area: "Berawa", price: "mittel bis gehoben", fit: "Top-Empfehlung für regionale Küche" },
  { name: "Muda By/Suka", area: "Canggu", price: "mittel bis gehoben", fit: "Top-Empfehlung" },
  { name: "Sa'Mesa Canggu", area: "Canggu (Batu Bolong)", price: "gehoben", fit: "Top-Empfehlung" },
  { name: "Hippie Fish Pererenan Beach", aliases: ["Hippie Fish"], instagram: "hippiefishbali", phone: "+6281337596236", phoneSource: "public", website: "https://tavologroup.com/hippiefish/", placeId: "ChIJ5Wex6mc50i0RNSHWdVKVoPo", area: "Pererenan", price: "gehoben", fit: "Top-Empfehlung" },
  { name: "Organic Ocean Restaurant", area: "Seseh", price: "mittel bis gehoben", fit: "Top-Empfehlung" },
  { name: "Nook Umalas", area: "Umalas", price: "mittel", fit: "Sehr gut für Ambiente" },
  { name: "Riviera Cafe Cemagi", area: "Cemagi", price: "mittel bis gehoben", fit: "Top-Empfehlung" },
  { name: "Seseh St Cafe", area: "Seseh", price: "mittel", fit: "Top-Empfehlung" },
  { name: "Warung Yess", area: "Pererenan", price: "günstig", fit: "Top-Empfehlung" },
  { name: "Ji Restaurant Bali", area: "Canggu (Batu Bolong)", price: "gehoben", fit: "Top-Empfehlung" },

  // Cafés, Frühstück, Bäckereien
  { name: "Sensorium Bali", area: "Canggu (Batu Bolong)", price: "mittel", fit: "Top-Empfehlung" },
  { name: "Crate Cafe Gallery Store", area: "Canggu", price: "günstig bis mittel", fit: "Sehr gut" },
  { name: "BAKED. Berawa", area: "Berawa", price: "mittel", fit: "Sehr gut, mit Konsistenzhinweis" },
  { name: "The Avocado Factory", area: "Canggu (Echo Beach)", price: "mittel", fit: "Top-Empfehlung für gesundes Frühstück" },
  { name: "Satu-Satu Coffee Company", area: "Berawa", price: "günstig bis mittel", fit: "Top-Empfehlung für Preis-Leistung" },
  { name: "Brunch Club Pererenan", area: "Pererenan", price: "mittel", fit: "Top-Empfehlung" },
  { name: "Gather | brunch café", aliases: ["Gather brunch cafe"], area: "Pererenan", price: "mittel", fit: "Sehr gut" },
  { name: "Touché Café & Restaurant", area: "Pererenan", price: "mittel bis gehoben", fit: "Nur mit Hinweis empfehlen" },
  { name: "ST. ALi Bali", area: "Pererenan", price: "mittel", fit: "Gut für bestimmte Gäste" },
  { name: "Natari Cafe Bali", area: "Seseh", price: "günstig bis mittel", fit: "Top-Empfehlung" },
  { name: "FLOWERBOY", area: "Seseh/Cemagi", price: "günstig", fit: "Top-Empfehlung" },
  { name: "Seseh General Store", area: "Seseh", price: "günstig bis mittel", fit: "Sehr gut" },
  { name: "TMO Coffee Kedungu", area: "Kedungu", price: "günstig", fit: "Sehr gut" },
  { name: "Bumbak Coffee", area: "Umalas", price: "günstig bis mittel", fit: "Top-Empfehlung für Kaffee" },
  { name: "7AM Bakers Umalas", area: "Umalas", price: "mittel", fit: "Sehr gut, mit Servicehinweis" },

  // Bars, Beach Clubs, Nachtleben
  { name: "La Brisa Bali", instagram: "labrisabali", phone: "+628113946666", phoneSource: "google", placeId: "ChIJrfg6aXY40i0RKbzqxLedkoY", area: "Canggu (Echo Beach)", price: "gehoben", fit: "Top-Empfehlung für Sunset" },
  { name: "FINNS Beach Club", instagram: "finnsbeachclub", phone: "+628113946666", phoneSource: "public", placeId: "ChIJSRrSTuNH0i0RX7GpKfK5k0k", area: "Berawa", price: "gehoben bis luxuriös", fit: "Top-Empfehlung für Beach-Club-Fans" },
  { name: "The Lawn Canggu", area: "Canggu (Batu Bolong)", price: "gehoben", fit: "Nur mit Hinweis empfehlen" },
  { name: "Black Sand Brewery", area: "Canggu (Batu Bolong)", price: "mittel", fit: "Top-Empfehlung für Craft Beer" },
  { name: "Segno Bali", area: "Canggu", price: "gehoben", fit: "Top-Empfehlung für Cocktails" },
  { name: "Old Man's Bali", area: "Canggu (Batu Bolong)", price: "günstig bis mittel", fit: "Sehr gut für bestimmte Gäste" },
  { name: "Motel Mexicola Canggu", area: "Canggu (Batu Bolong)", price: "mittel bis gehoben", fit: "Sehr gut für Party-Dinner" },
  { name: "Vault Nightclub Bali", area: "Berawa", price: "mittel bis gehoben", fit: "Top-Empfehlung für Clubnächte" },
  { name: "Atlas Beach Club", area: "Berawa", price: "gehoben bis luxuriös", fit: "Nur mit Hinweis empfehlen" },
  { name: "Bar Vera Bistro & Wine Bar", area: "Pererenan", price: "gehoben", fit: "Top-Empfehlung" },
  { name: "Papi Chulo Beachfront", instagram: "papichulo.beachfront", phone: "+6282261567430", phoneSource: "google", placeId: "ChIJdzyeB9Y50i0RdVPG7hAp4QU", area: "Pererenan", price: "mittel", fit: "Sehr gut" },
  { name: "Luna Beach Club", area: "Nyanyi/Nuanu", price: "luxuriös", fit: "Top-Empfehlung für Beach-Club-Gäste" },
  { name: "Pigstone Taphouse", area: "Kedungu", price: "mittel", fit: "Top-Empfehlung" },
  { name: "The Forge Bali", area: "Umalas/Petitenget", price: "mittel", fit: "Top-Empfehlung für Live-Sport" },
  { name: "The Plumbers Arms", area: "Umalas/Kerobokan", price: "mittel", fit: "Sehr gut für bestimmte Gäste" },

  // Frühere Einträge aus dem Samalas-Guide, die im Patuha-Guide nicht vorkommen (bleiben erhalten)
  { name: "Shortcut Cafe Canggu" },
  { name: "Day by Day Coffee & Eatery" },
  { name: "Solace Spa Pererenan", phone: "+6282342521469", phoneSource: "google", placeId: "ChIJS_NwKQA50i0R0d6TGrUJFwg" },
  { name: "NOAH cafe" },
  { name: "TheHub Pererenan" },
  { name: "The Hula" },
  { name: "Warung Local" },
  { name: "Cinta Pererenan" },
  { name: "Suchata Bali Massage" },
  { name: "Canggu Yoga Centre", phone: "+628121020389", phoneSource: "google", placeId: "ChIJhfSXckw50i0RMxcsFO6sUwU" },
  { name: "LOOP cafe" },
  { name: "Warung Apa?" },
  { name: "Mission Flow Studio" },
  { name: "The Path Wellness Center", phone: "+6287753863795", phoneSource: "google", placeId: "ChIJea5Fadc50i0R3Eo8wjij-EE" },
  { name: "Warung Sika" },
  { name: "COMO Beach Club Canggu", instagram: "comobeachclub.canggu", phone: "+6281138209418", phoneSource: "public", website: "https://www.comohotels.com/como-beach-club-canggu", placeId: "ChIJAaAOMnY40i0R2im42qhNbIw" },
  { name: "ZALI Pererenan" },
  { name: "Riviera Trattoria Pererenan" },
  { name: "Kilo Kitchen Pererenan" }
];
