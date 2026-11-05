// Ergänzung zur Betriebsliste, aus der Orts-Recherche für die Villa Patuha (Google Places, November 2026).
// Gleiche Regeln wie in spots.ts: alles ist Vorbelegung, die Nummern sind phoneSource "google" und werden vor dem
// ersten Versand geprüft. Der Betrieb korrigiert seine Angaben beim Upload. Nichts wird überschrieben oder gelöscht.
// Nicht enthalten: Kliniken, Apotheken, Supermärkte, Wäschereien, SIM-Shops, Wechselstuben, Transfers, Sehenswürdigkeiten.
// Entfernung und Art stehen im Feld area, wie bei den Sport-Einträgen in spots.ts.

import type { Spot } from "./spots";

// Nummern für bestehende Einträge, die bisher keine hatten. Gilt nur, wenn im Eintrag keine Nummer steht.
export const PHONE_FILL: Record<string, string> = {
  "Brunch Club Pererenan": "+6281138312906",
  "Gather | brunch café": "+628132001598",
  "Warung Yess": "+6281353688196",
  "Riviera Trattoria Pererenan": "+6282295997800",
  "Warung Local": "+628113834510",
  "Warung Sika": "+6281337874958",
  "ZALI Pererenan": "+6281239003100",
  "Shortcut Cafe Canggu": "+6282147842085",
  "Day by Day Coffee & Eatery": "+6282220612361",
  "Old Man's Bali": "+623618469158",
  "Motel Mexicola Canggu": "+6281138898000",
  "Bar Vera Bistro & Wine Bar": "+6282342713110"
};

export const EXTRA_SPOTS: Spot[] = [
  // Essen
  { name: "K&A Grill", area: "Burger und BBQ, 700 m ab Patuha", price: "gehoben" },
  { name: "Fuego", phone: "+6282266312220", phoneSource: "google", area: "Burger und BBQ, 1,6 km ab Patuha", price: "gehoben" },
  { name: "Wok This Way", phone: "+628113888099", phoneSource: "google", area: "Asiatisch, 400 m ab Patuha", price: "mittel" },
  { name: "Optimist Bali", phone: "+62817216978", phoneSource: "google", area: "Asiatisch, 2,2 km ab Patuha", price: "gehoben" },
  { name: "Bird's Nest Thai Kitchen", phone: "+6287750786226", phoneSource: "google", area: "Thai, 100 m ab Patuha", price: "mittel" },
  { name: "KHAO Canggu", phone: "+6285211621162", phoneSource: "google", area: "Thai, 400 m ab Patuha" },
  { name: "Paed Thai Canggu", phone: "+6281237339353", phoneSource: "google", area: "Thai, 400 m ab Patuha" },
  { name: "Annapurna Agni", area: "Indisch, 1,5 km ab Patuha" },
  { name: "Aunty Ji's", phone: "+6282247515453", phoneSource: "google", area: "Indisch, 2,0 km ab Patuha", price: "gehoben" },
  { name: "rize pererenan", phone: "+6282311917193", phoneSource: "google", area: "Indisch, 2,1 km ab Patuha", price: "mittel" },
  { name: "Della Terra", phone: "+6287750787842", phoneSource: "google", area: "Italienisch, 400 m ab Patuha", price: "gehoben" },
  { name: "La Baracca Munggu", phone: "+6282326376215", phoneSource: "google", area: "Italienisch, 1,8 km ab Patuha", price: "gehoben" },
  { name: "Rosso Munggu", phone: "+628218189829", phoneSource: "google", area: "Italienisch, 1,9 km ab Patuha", price: "mittel" },
  { name: "ARTE Italian Restaurant", phone: "+6289523877565", phoneSource: "google", area: "Italienisch, 2,2 km ab Patuha" },
  { name: "Kenji Ramen & Izakaya", phone: "+6281139605857", phoneSource: "google", area: "Japanisch, 400 m ab Patuha", price: "mittel" },
  { name: "Enya Izakaya", phone: "+6281138309844", phoneSource: "google", area: "Japanisch, 1,5 km ab Patuha", price: "gehoben" },
  { name: "TYGR Sushi & Ramen Munggu", phone: "+6282326352641", phoneSource: "google", area: "Japanisch, 2,2 km ab Patuha", price: "mittel" },
  { name: "Nostimo Greek", phone: "+6281217196885", phoneSource: "google", area: "Mediterran, 700 m ab Patuha" },
  { name: "Santorini Greek", phone: "+6282341451976", phoneSource: "google", area: "Mediterran, 1,8 km ab Patuha", price: "mittel" },
  { name: "Taco Madre", phone: "+6281237862297", phoneSource: "google", area: "Mexikanisch, 600 m ab Patuha", price: "mittel" },
  { name: "Taco Island", phone: "+6285739228864", phoneSource: "google", area: "Mexikanisch, 2,0 km ab Patuha", price: "mittel" },
  { name: "TYM Sea Food", phone: "+6283119579423", phoneSource: "google", area: "Fisch und Meeresfrüchte, 600 m ab Patuha" },
  { name: "Pescado Pererenan", phone: "+6282146636846", phoneSource: "google", area: "Fisch und Meeresfrüchte, 1,7 km ab Patuha", price: "gehoben" },
  { name: "Warung Babi Guling Swari", phone: "+6287863064449", phoneSource: "google", area: "Lokale Küche, 400 m ab Patuha", price: "günstig" },
  { name: "Warung Bamboo", phone: "+628113985644", phoneSource: "google", area: "Lokale Küche, 1,5 km ab Patuha", price: "mittel" },
  { name: "Paparempa", phone: "+6281138315581", phoneSource: "google", area: "Lokale Küche, 1,8 km ab Patuha" },
  { name: "Suksma Kitchen", phone: "+6285746036909", phoneSource: "google", area: "Vegetarisch und vegan, 1,5 km ab Patuha", price: "mittel" },
  { name: "Roots Pererenan", phone: "+6281337531570", phoneSource: "google", area: "Vegetarisch und vegan, 1,9 km ab Patuha", price: "mittel" },
  { name: "Peace Garden Bali", phone: "+6287750549832", phoneSource: "google", area: "Vegetarisch und vegan, 2,7 km ab Patuha", price: "mittel" },
  { name: "Crousty Rice", phone: "+628213464550", phoneSource: "google", area: "Street Food, 1,1 km ab Patuha", price: "mittel" },
  { name: "Warung Sate Babi Pandu", phone: "+6285903134013", phoneSource: "google", area: "Street Food, 1,1 km ab Patuha", price: "günstig" },
  { name: "Sate Padang Canggu", phone: "+6281266735587", phoneSource: "google", area: "Street Food, 2,3 km ab Patuha", price: "mittel" },
  { name: "Bakso Taptap", area: "Street Food, 2,5 km ab Patuha", price: "günstig" },
  { name: "Huge Restaurant", phone: "+6281330984292", phoneSource: "google", area: "Fine Dining, 4,6 km ab Patuha", price: "gehoben" },
  { name: "TAKK", phone: "+628133981299", phoneSource: "google", area: "Fine Dining, 4,7 km ab Patuha", price: "gehoben" },
  { name: "Mauri", phone: "+62817776177", phoneSource: "google", area: "Fine Dining, 4,9 km ab Patuha", price: "gehoben" },
  { name: "nude cafe Pererenan", phone: "+6285337713840", phoneSource: "google", area: "Frühstück, 500 m ab Patuha", price: "mittel" },
  { name: "BRIGHT coffee and brunch", phone: "+6281330920104", phoneSource: "google", area: "Frühstück, 1,3 km ab Patuha", price: "mittel" },
  { name: "ACME Pererenan", phone: "+6282144557288", phoneSource: "google", area: "Café und Bäckerei, 1,0 km ab Patuha", price: "mittel" },
  { name: "NOUS Coffee", phone: "+628213841954", phoneSource: "google", area: "Café und Bäckerei, 1,7 km ab Patuha", price: "mittel" },
  { name: "Little Lima Specialty Coffee", area: "Café und Bäckerei, 2,3 km ab Patuha", price: "mittel" },
  { name: "Club House Pererenan", phone: "+6282233097841", phoneSource: "google", area: "Bar und Pub, 2,2 km ab Patuha" },
  { name: "The Barn Pub & Kitchen", area: "Bar und Pub, 2,4 km ab Patuha" },

  // Nachtleben und Beach Clubs
  { name: "Sol Rooftop Bali", phone: "+6285738078245", phoneSource: "google", area: "Beach Club, 2,5 km ab Patuha" },
  { name: "Othree Beach Bar", phone: "+6287876950826", phoneSource: "google", area: "Beach Club, 2,5 km ab Patuha" },
  { name: "Atlas Super Club", phone: "+623613007222", phoneSource: "google", area: "Nightclub, 3,1 km ab Patuha" },
  { name: "XBR Canggu", phone: "+6281938961103", phoneSource: "google", area: "Live-Musik, 2,5 km ab Patuha" },

  // Sport, Wellness, Erholung
  { name: "Camino de Padel", area: "Padel, Tennis und Pickleball, 1,6 km ab Patuha" },
  { name: "PickleBali Clubs", phone: "+6281139605102", phoneSource: "google", area: "Padel, Tennis und Pickleball, 2,9 km ab Patuha" },
  { name: "Liga Tennis Tanah Lot", phone: "+628132277632", phoneSource: "google", area: "Padel, Tennis und Pickleball, 5,2 km ab Patuha" },
  { name: "Chandra Yoga", phone: "+6281237679193", phoneSource: "google", area: "Yoga, 1,2 km ab Patuha" },
  { name: "sundaymood", phone: "+62895634203264", phoneSource: "google", area: "Sauna und Eisbad, 300 m ab Patuha" },
  { name: "The Ark Boutique Recovery Spa", phone: "+6282342222578", phoneSource: "google", area: "Sauna und Eisbad, 2,2 km ab Patuha" },
  { name: "Air Seseh Recovery Club", phone: "+6281239863913", phoneSource: "google", area: "Sauna und Eisbad, 2,6 km ab Patuha" },
  { name: "Escape Haven Bali Retreat", phone: "+6281237137829", phoneSource: "google", area: "Wellness-Retreat, 1,3 km ab Patuha" },
  { name: "Oasis by Where NeXt? Retreat", phone: "+6287758762780", phoneSource: "google", area: "Wellness-Retreat, 2,3 km ab Patuha" },
  { name: "Alchemy Wellness", phone: "+6282261564208", phoneSource: "google", area: "Spa und Massage, 1,3 km ab Patuha" },
  { name: "Surfers Surf Lesson", phone: "+6281337311604", phoneSource: "google", area: "Surfschule, 2,5 km ab Patuha" },
  { name: "Arya Surf School", phone: "+6281239243830", phoneSource: "google", area: "Surfschule, 2,5 km ab Patuha" },
  { name: "Canggu Surf School", phone: "+623618004284", phoneSource: "google", area: "Surfschule, 2,5 km ab Patuha" },

  // Aktivitäten, Familie, Arbeiten, Privatservice
  { name: "OXO Yachts Indonesia", phone: "+6289668636280", phoneSource: "google", area: "Boot und Yacht, 1,7 km ab Patuha" },
  { name: "Spearfishing Canggu", phone: "+6281523854481", phoneSource: "google", area: "Boot und Yacht, 2,6 km ab Patuha" },
  { name: "Intrinity Divers", phone: "+6282146762375", phoneSource: "google", area: "Tauchen, 700 m ab Patuha" },
  { name: "Adventure Scuba Diving Bali", phone: "+6287760102000", phoneSource: "google", area: "Tauchen, 6,2 km ab Patuha" },
  { name: "Salty Cowboy Horse Riding", phone: "+6281237312248", phoneSource: "google", area: "Reiten, 6,4 km ab Patuha" },
  { name: "Casa Tierra", phone: "+6281215955881", phoneSource: "google", area: "Töpfern und Workshop, 1,6 km ab Patuha" },
  { name: "Backus Ceramics", phone: "+6282145890402", phoneSource: "google", area: "Töpfern und Workshop, 1,7 km ab Patuha" },
  { name: "Vagabond Design Lab", phone: "+6287777318445", phoneSource: "google", area: "Töpfern und Workshop, 1,9 km ab Patuha" },
  { name: "Adrian Bali Tours", phone: "+6282215861906", phoneSource: "google", area: "Touren, 2,1 km ab Patuha" },
  { name: "Smile Bali Tours", phone: "+6281995035954", phoneSource: "google", area: "Touren, 2,9 km ab Patuha" },
  { name: "Bali Driver Seminyak", phone: "+6282144138853", phoneSource: "google", area: "Touren, 4,3 km ab Patuha" },
  { name: "Smiley Playhouse", phone: "+6282170003200", phoneSource: "google", area: "Kinder-Spielplatz, 400 m ab Patuha" },
  { name: "Babaloons Playground", phone: "+6287838307193", phoneSource: "google", area: "Kinder-Spielplatz, 900 m ab Patuha" },
  { name: "Parklife Bali", phone: "+6281805113200", phoneSource: "google", area: "Kinder-Spielplatz, 1,4 km ab Patuha" },
  { name: "Mookiland Park", phone: "+6285190678707", phoneSource: "google", area: "Kinder-Spielplatz, 5,0 km ab Patuha" },
  { name: "WOHL Cafe", phone: "+6281997183200", phoneSource: "google", area: "Coworking, 100 m ab Patuha" },
  { name: "Canggu Private Chef", area: "Privatkoch, 1,3 km ab Patuha" },
  { name: "Home Bali Private Chef", phone: "+6281337556438", phoneSource: "google", area: "Privatkoch, 2,9 km ab Patuha" }
];
