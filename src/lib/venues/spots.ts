// Betriebe aus den Umgebungs-Guides der Villen, die man anschreiben kann (ohne Strände, Sehenswürdigkeiten, Läden, Kliniken).
// Quellen: Wissensbasis der Villa Patuha in Elev8, Stand November 2026:
//   "Greater Canggu: Restaurants, Cafés, Bars & Nachtleben" (45 Betriebe, ohne Nummern)
//   "Bali-Guide-Patuha", Kapitel 10 Sport, Fitness und Wellness, mit Nummern aus Google Places und den Websites der Betriebe
// ergänzt um die früheren Einträge aus dem Guide der Villa Samalas, die dort nicht mehr vorkommen. Nichts wird gelöscht.
// Alle Angaben sind Vorbelegung und werden vom Betrieb beim Upload überschrieben.
// Instagram-Namen stammen aus Verzeichnissen und Magazinen und sind NICHT bestätigt; der Betrieb korrigiert sie beim Upload.
// phoneSource: "google" = aus Google Maps oder Verzeichnis, vor dem ersten Versand prüfen. "public" = Website.
// area, price, fit: Ort (oder Art und Entfernung zur Villa), Preisklasse und Einstufung ("Top-Empfehlung", "Nur mit Hinweis empfehlen" ...) laut Guide.
// aliases: andere Schreibweisen, unter denen der Betrieb schon angelegt sein kann; so entsteht kein Duplikat.

export type Spot = {
  name: string;
  aliases?: string[];
  instagram?: string;
  phone?: string;
  phoneSource?: "google" | "public";
  email?: string;
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

  // Fitness und Gyms (Bali-Guide-Patuha, Kapitel 10; Entfernung ab Villa Patuha)
  { name: "BODY CRAFT ELEMENTS BALI", phone: "+6282225333306", phoneSource: "google", area: "Gym, 270 m ab Patuha" },
  { name: "THE BLOCK", phone: "+6282188886088", phoneSource: "google", area: "Gym, 280 m ab Patuha" },
  { name: "Surya Gym Bali", phone: "+6282340928751", phoneSource: "google", area: "Gym, 370 m ab Patuha" },
  { name: "Elite Fit Bali", phone: "+6285720221101", phoneSource: "google", area: "Gym, 390 m ab Patuha" },
  { name: "Wellness Gym Canggu", phone: "+6285168940956", phoneSource: "google", area: "Gym, 530 m ab Patuha" },
  { name: "OBSIDIAN GYM BALI", phone: "+6285122662266", phoneSource: "google", email: "hello@obsidian-bali.com", area: "Gym, 610 m ab Patuha" },
  { name: "BYND Fitness Club Bali - Gym", phone: "+6282119993789", phoneSource: "google", area: "Gym, 920 m ab Patuha" },
  { name: "Victory Fitness Club", phone: "+6282147200800", phoneSource: "google", area: "Gym, 1,5 km ab Patuha" },
  { name: "Fitness Plus", phone: "+6281246385939", phoneSource: "google", area: "Gym (24 h), 1,9 km ab Patuha" },
  { name: "POWER + REVIVE STUDIO", phone: "+6281717799990", phoneSource: "google", area: "Gym, 2,3 km ab Patuha" },
  { name: "F45 Training Canggu", phone: "+6285861523013", phoneSource: "google", email: "canggu@f45training.id", area: "Gruppentraining, 2,0 km ab Patuha" },
  { name: "RITE Gym Bali", phone: "+6282236659949", phoneSource: "google", email: "contact@ritebali.com", area: "Gym, 2,2 km ab Patuha" },
  { name: "S2S CrossFit Bali", phone: "+6281917484757", phoneSource: "google", email: "info@s2scrossfit.com", area: "CrossFit, 2,4 km ab Patuha" },

  // Padel
  { name: "Body Craft Padel", phone: "+6282225222380", phoneSource: "google", area: "Padel, 280 m ab Patuha" },
  { name: "Jungle Padel Pererenan", phone: "+6281236664126", phoneSource: "google", email: "info@junglepadel.com", area: "Padel, 330 m ab Patuha" },
  { name: "Pad Thai Padel Bali", phone: "+628213856448", phoneSource: "google", area: "Padel, 430 m ab Patuha" },
  { name: "Fifteen Padel Canggu", phone: "+6281299252675", phoneSource: "google", area: "Padel, 1,4 km ab Patuha" },
  { name: "Bali Padel Academy", phone: "+6281717107000", phoneSource: "google", email: "hello@balipadelacademy.com", area: "Padel, 1,9 km ab Patuha" },

  // Kampfsport
  { name: "Lions MMA Bali", phone: "+62818166636", phoneSource: "google", area: "MMA, 390 m ab Patuha" },
  { name: "MONSTR Fight Pit", phone: "+6282342751331", phoneSource: "google", area: "Kampfsport, 570 m ab Patuha" },
  { name: "Canggu Muay Thai", phone: "+6282147510001", phoneSource: "google", area: "Muay Thai, 1,7 km ab Patuha" },
  { name: "Bali MMA", phone: "+6287761885879", phoneSource: "google", email: "balimmaoffice@gmail.com", area: "MMA, 2,0 km ab Patuha" },
  { name: "Soma Fight Club", phone: "+6287756118691", phoneSource: "google", email: "contact@somafightclub.com", area: "Kampfsport, 2,2 km ab Patuha" },

  // Klettern
  { name: "Rock Island Climbing and Bouldering Gym Bali", phone: "+6283878808030", phoneSource: "google", email: "hello@rockisland.id", area: "Bouldern, 90 m ab Patuha" },
  { name: "Klimb Boulder Gym Bali", phone: "+6287739455021", phoneSource: "google", area: "Bouldern, 2,2 km ab Patuha (nur WhatsApp oder Instagram)" },

  // Pilates und Yoga
  { name: "Pulse Mat Pilates Studio", phone: "+6282135748300", phoneSource: "google", area: "Pilates, 150 m ab Patuha" },
  { name: "Obsidian Pilates Bali", phone: "+62812657678", phoneSource: "google", area: "Pilates, 190 m ab Patuha" },
  { name: "Sunset Pilates Pererenan", phone: "+6282147908603", phoneSource: "google", area: "Pilates, 290 m ab Patuha" },
  { name: "PILATES STUDIO LILATES PERERENAN", phone: "+6281322772269", phoneSource: "google", area: "Pilates, 500 m ab Patuha" },
  { name: "Mission Flow Studio", phone: "+6282221604481", phoneSource: "google", area: "Yoga, 610 m ab Patuha" },
  { name: "Canggu Yoga Centre", phone: "+628121020389", phoneSource: "google", placeId: "ChIJhfSXckw50i0RMxcsFO6sUwU", area: "Yoga, 1,8 km ab Patuha" },
  { name: "The Path Wellness Center", phone: "+6287753863795", phoneSource: "google", placeId: "ChIJea5Fadc50i0R3Eo8wjij-EE", area: "Yoga und Spa, 2,1 km ab Patuha" },

  // Golf, Reiten, Skaten
  { name: "Island Golf Canggu - Island Sport Clubs", phone: "+6281211661176", phoneSource: "google", area: "Indoor-Golf, 2,2 km ab Patuha" },
  { name: "Bali Equestrian Centre", phone: "+623618446533", phoneSource: "google", email: "info@baliequestriancentre.com", area: "Reiten, 2,2 km ab Patuha" },
  { name: "Amplitude", phone: "+628113850711", phoneSource: "google", area: "Skatepark mit Café, 3,8 km ab Patuha" },

  // Spa und Massage
  { name: "Solace Spa Pererenan", phone: "+6282342521469", phoneSource: "google", placeId: "ChIJS_NwKQA50i0R0d6TGrUJFwg", area: "Spa, 280 m ab Patuha" },
  { name: "Suchata Bali Massage", phone: "+6281995561177", phoneSource: "google", area: "Massage mit Hausbesuch, 830 m ab Patuha" },
  { name: "Lotus Massage Therapy Pererenan", phone: "+6281339796315", phoneSource: "google", area: "Massage, 1,3 km ab Patuha" },
  { name: "Alena Spa", phone: "+6282340349300", phoneSource: "google", area: "Spa, 2,2 km ab Patuha" },
  { name: "Carla Spa Pererenan", phone: "+6281139416203", phoneSource: "google", area: "Spa, 2,5 km ab Patuha" },

  // Coworking
  { name: "TheHub Pererenan", phone: "+6287880620056", phoneSource: "google", area: "Coworking, 820 m ab Patuha" },
  { name: "NOAH cafe", phone: "+628216339987", phoneSource: "google", area: "Café und Coworking, 1,2 km ab Patuha" },
  { name: "Argil Coworking Space", phone: "+6281320008478", phoneSource: "google", area: "Coworking, 2,6 km ab Patuha" },
  { name: "Tribal Bali Coworking Hostel", phone: "+6282147914973", phoneSource: "google", area: "Coworking, 2,0 km ab Patuha" },

  // Frühere Einträge aus dem Samalas-Guide, die im Patuha-Guide nicht vorkommen (bleiben erhalten)
  { name: "Shortcut Cafe Canggu" },
  { name: "Day by Day Coffee & Eatery" },
  { name: "The Hula" },
  { name: "Warung Local" },
  { name: "Cinta Pererenan" },
  { name: "LOOP cafe" },
  { name: "Warung Apa?" },
  { name: "Warung Sika" },
  { name: "COMO Beach Club Canggu", instagram: "comobeachclub.canggu", phone: "+6281138209418", phoneSource: "public", website: "https://www.comohotels.com/como-beach-club-canggu", placeId: "ChIJAaAOMnY40i0R2im42qhNbIw" },
  { name: "ZALI Pererenan" },
  { name: "Riviera Trattoria Pererenan" },
  { name: "Kilo Kitchen Pererenan" }
];
