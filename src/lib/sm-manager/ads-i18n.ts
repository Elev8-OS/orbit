type Locale = 'de' | 'en';
type P = Record<string, unknown>;
const num = (v: unknown) => Number(v) || 0;
const txt = (v: unknown) => String(v ?? '');
const list = (v: unknown) => (Array.isArray(v) ? v.map(String).join(', ') : '');

const de = {
  tabAds: 'Ads',
  title: 'Anzeigen (Meta Ads)',
  intro:
    'Hier planst und gibst du bezahlte Anzeigen frei. Die Engine macht aus einem freigegebenen Reel oder Karussell einen Entwurf. Du prüfst Budget, Zielgruppe, Text und die Prüfungen. Nach «Freigeben» und «An Meta senden» liegt die Anzeige bei Meta, aber pausiert. Geld wird erst ausgegeben, wenn du sie einschaltest.',
  unavailableTitle: 'Anzeigen',
  unavailable: 'Die Anzeigen konnten gerade nicht von der Engine geladen werden.',
  setupTitle: 'Anbindung an Meta',
  account: 'Werbekonto',
  pixel: 'Pixel',
  lastFired: 'Zuletzt gefeuert',
  never: 'noch nie',
  noData: 'keine Angaben',
  eventsTitle: 'Events der letzten 7 Tage',
  events: { PageView: 'Seitenaufrufe', ViewContent: 'Villa angesehen', InitiateCheckout: 'Buchung gestartet', Purchase: 'Kauf' } as Record<string, string>,
  accountActive: 'aktiv',
  accountInactive: 'nicht aktiv',
  budgetTitle: 'Monatsbudget',
  budgetLine: (committed: string, monthly: string) => `${committed} von ${monthly} verplant`,
  missing: (list: string) => `In Railway fehlt noch: ${list}.`,
  metaError: 'Meta meldet',
  createDrafts: 'Entwürfe aus freigegebenen Posts erstellen',
  creating: 'Wird erstellt …',
  draftsCreated: (n: number) => (n === 0 ? 'Es wurde kein neuer Entwurf erstellt.' : n === 1 ? 'Ein Entwurf wurde erstellt.' : `${n} Entwürfe wurden erstellt.`),
  skipped: 'Übersprungen',
  empty: 'Noch keine Anzeigen. Erstelle Entwürfe aus deinen freigegebenen Reels und Karussells.',
  statuses: { draft: 'Entwurf', approved: 'Freigegeben', pushed: 'Bei Meta, pausiert', active: 'Läuft', paused: 'Pausiert', rejected: 'Abgelehnt', ended: 'Beendet' } as Record<string, string>,
  sending: 'Wird an Meta gesendet …',
  fromPost: (id: number) => `Aus Post ${id}`,
  formats: { reel: 'Reel', carousel: 'Karussell' } as Record<string, string>,
  budgetSection: 'Budget und Laufzeit',
  audienceSection: 'Zielgruppe',
  creativeSection: 'Anzeige',
  rulesSection: 'Ziel und Abbruchregeln',
  fName: 'Name',
  fBudget: 'Tagesbudget (USD)',
  fStart: 'Start',
  fEnd: 'Ende',
  fCountries: 'Länder (Codes mit Komma)',
  countriesHelp: 'zum Beispiel AU, GB',
  fAgeMin: 'Alter ab',
  fAgeMax: 'Alter bis',
  ageHelp: 'Meta behandelt das Alter bei breiter Zielgruppe als Vorschlag und liefert auch darüber hinaus aus, wenn es besser läuft.',
  fPlacements: 'Platzierung',
  placements: { automatic: 'Automatisch (Facebook und Instagram)', instagram: 'Nur Instagram' } as Record<string, string>,
  fGoal: 'Optimiert auf',
  goals: { INITIATE_CHECKOUT: 'Buchung gestartet (InitiateCheckout)', PURCHASE: 'Kauf (Purchase)', VIEW_CONTENT: 'Seite angesehen (ViewContent)' } as Record<string, string>,
  goalHelp: 'Mit wenig Budget gibt es zu wenige Käufe, damit Meta lernt. Darum wird auf den früheren Schritt optimiert und der Kauf nur mitgezählt.',
  fMaxCpa: 'Maximaler Preis pro Buchung (USD)',
  fStop: 'Pause ohne InitiateCheckout ab (USD)',
  stopHelp: 'Hat die Anzeige so viel ausgegeben, ohne dass ein Gast eine Buchung begonnen hat, pausiert die Engine sie automatisch.',
  fText: 'Anzeigentext',
  fHeadline: 'Überschrift',
  fDescription: 'Beschreibung',
  fCta: 'Button',
  ctas: { BOOK_TRAVEL: 'Jetzt buchen', LEARN_MORE: 'Mehr dazu', SIGN_UP: 'Registrieren' } as Record<string, string>,
  fLink: 'Ziel-Link mit Tracking',
  estimate: (days: number, spend: string, bookings: number) => `${days} Tage, höchstens ${spend} Ausgaben. Zum Preislimit wären das rund ${bookings} Buchungen. Das ist die Rechnung zum Limit, keine Prognose.`,
  save: 'Änderungen speichern',
  saving: 'Wird gespeichert …',
  working: 'Einen Moment …',
  failed: 'Das hat nicht geklappt',
  saveFirst: 'Speichere zuerst deine Änderungen.',
  approve: 'Freigeben',
  reopen: 'Wieder bearbeiten',
  reject: 'Ablehnen',
  rejectPrompt: 'Warum? (optional, nur für dich)',
  push: 'An Meta senden (pausiert)',
  pushHint: 'Legt Kampagne, Anzeigengruppe und Anzeige bei Meta an. Es wird noch kein Geld ausgegeben.',
  activate: 'Einschalten',
  pause: 'Pausieren',
  openAdsManager: 'Im Ads Manager ansehen',
  confirmActivate: (daily: string) => `Anzeige jetzt einschalten? Ab jetzt werden bis zu ${daily} pro Tag ausgegeben.`,
  checksTitle: 'Prüfungen',
  phaseApprove: 'Vor der Freigabe',
  phaseActivate: 'Vor dem Einschalten',
  insightsTitle: 'Zahlen bei Meta',
  iSpend: 'Ausgegeben',
  iClicks: 'Klicks',
  iCheckouts: 'Buchungen gestartet',
  iPurchases: 'Käufe',
  iCpa: 'Preis pro Kauf',
  asOf: 'Stand',
  note: 'Hinweis',
  checkTitles: {
    post_ready: 'Beitrag freigegeben',
    media: 'Medien vorhanden',
    meta_setup: 'Meta-Zugang komplett',
    account_ok: 'Werbekonto aktiv',
    currency: 'Konto in USD',
    budget_cap: 'Monatsbudget eingehalten',
    account_spend_cap: 'Ausgabenlimit des Kontos',
    free_nights: 'Freie Nächte',
    pixel_events: 'Pixel meldet InitiateCheckout',
    pixel_purchase: 'Pixel meldet Käufe'
  } as Record<string, string>,
  checkDetail: (key: string, ok: boolean, p: P): string => {
    switch (key) {
      case 'post_ready':
        return ok ? 'Der Beitrag ist freigegeben.' : `Der Beitrag hat den Status «${txt(p.status)}». Gib ihn zuerst frei.`;
      case 'media':
        return ok ? `${num(p.count)} Datei(en) vorhanden.` : 'Der Beitrag hat keine fertigen Medien.';
      case 'meta_setup':
        return ok ? 'Token, Konto, Seite und Pixel sind hinterlegt.' : `Es fehlt: ${list(p.missing)}.`;
      case 'account_ok':
        return ok ? 'Das Konto ist aktiv.' : p.error ? `Meta antwortet nicht: ${txt(p.error)}` : `Das Konto hat den Status ${txt(p.status) || 'unbekannt'} (1 wäre aktiv).`;
      case 'currency':
        return ok ? 'USD: Budget und Planung stimmen eins zu eins überein.' : `Das Konto läuft in ${txt(p.currency) || 'unbekannter Währung'}. Die Planung rechnet in USD, darum ist das Senden gesperrt.`;
      case 'budget_cap':
        return ok ? `${num(p.committed) + num(p.thisAd)} von ${num(p.cap)} USD im Monat verplant.` : `Mit dieser Anzeige wären es ${num(p.committed) + num(p.thisAd)} USD im Monat. Erlaubt sind ${num(p.cap)} USD.`;
      case 'account_spend_cap':
        return ok
          ? p.cap == null
            ? 'Am Konto ist kein Ausgabenlimit gesetzt. Empfohlen: 500 USD im Ads Manager.'
            : `Das Limit des Kontos (${num(p.cap)} USD) reicht noch.`
          : `Das Limit des Kontos (${num(p.cap)} USD, schon ausgegeben ${num(p.spent)} USD) reicht nicht für diese Anzeige.`;
      case 'free_nights':
        return ok ? `${num(p.freeNights)} freie Nächte in den nächsten ${num(p.days)} Tagen.` : p.freeNights == null ? 'Die freien Nächte konnten nicht geladen werden.' : 'Keine freien Nächte in nächster Zeit. Die Anzeige würde ins Leere laufen.';
      case 'pixel_events':
        return ok
          ? `${num(p.initiateCheckout)} InitiateCheckout in den letzten 7 Tagen.`
          : p.error
            ? `Meta antwortet nicht: ${txt(p.error)}`
            : `In 7 Tagen kein InitiateCheckout (Seitenaufrufe: ${num(p.pageView)}). Ohne dieses Event kann Meta nicht optimieren. Die Events baut Galih ein.`;
      case 'pixel_purchase':
        return ok ? `${num(p.purchase)} Käufe gemeldet.` : 'Noch kein Purchase-Event. Nicht zwingend, aber nötig, um den echten Preis pro Buchung zu messen.';
      default:
        return ok ? 'In Ordnung.' : 'Nicht in Ordnung.';
    }
  }
};

const en: typeof de = {
  tabAds: 'Ads',
  title: 'Ads (Meta Ads)',
  intro:
    'Plan and approve paid ads here. The engine turns an approved reel or carousel into a draft. You check budget, audience, text and the checks. After "Approve" and "Send to Meta" the ad sits at Meta, but paused. No money is spent until you switch it on.',
  unavailableTitle: 'Ads',
  unavailable: 'The ads could not be loaded from the engine right now.',
  setupTitle: 'Connection to Meta',
  account: 'Ad account',
  pixel: 'Pixel',
  lastFired: 'Last fired',
  never: 'never',
  noData: 'no data',
  eventsTitle: 'Events in the last 7 days',
  events: { PageView: 'Page views', ViewContent: 'Villa viewed', InitiateCheckout: 'Booking started', Purchase: 'Purchase' },
  accountActive: 'active',
  accountInactive: 'not active',
  budgetTitle: 'Monthly budget',
  budgetLine: (committed, monthly) => `${committed} of ${monthly} planned`,
  missing: (list) => `Still missing in Railway: ${list}.`,
  metaError: 'Meta reports',
  createDrafts: 'Create drafts from approved posts',
  creating: 'Creating ...',
  draftsCreated: (n) => (n === 0 ? 'No new draft was created.' : n === 1 ? 'One draft was created.' : `${n} drafts were created.`),
  skipped: 'Skipped',
  empty: 'No ads yet. Create drafts from your approved reels and carousels.',
  statuses: { draft: 'Draft', approved: 'Approved', pushed: 'At Meta, paused', active: 'Running', paused: 'Paused', rejected: 'Rejected', ended: 'Ended' },
  sending: 'Being sent to Meta ...',
  fromPost: (id) => `From post ${id}`,
  formats: { reel: 'Reel', carousel: 'Carousel' },
  budgetSection: 'Budget and duration',
  audienceSection: 'Audience',
  creativeSection: 'Ad',
  rulesSection: 'Goal and stop rules',
  fName: 'Name',
  fBudget: 'Daily budget (USD)',
  fStart: 'Start',
  fEnd: 'End',
  fCountries: 'Countries (codes, comma separated)',
  countriesHelp: 'for example AU, GB',
  fAgeMin: 'Age from',
  fAgeMax: 'Age to',
  ageHelp: 'With a broad audience Meta treats age as a suggestion and also delivers beyond it when that performs better.',
  fPlacements: 'Placement',
  placements: { automatic: 'Automatic (Facebook and Instagram)', instagram: 'Instagram only' },
  fGoal: 'Optimised for',
  goals: { INITIATE_CHECKOUT: 'Booking started (InitiateCheckout)', PURCHASE: 'Purchase', VIEW_CONTENT: 'Page viewed (ViewContent)' },
  goalHelp: 'With a small budget there are too few purchases for Meta to learn from. So it optimises for the earlier step and only counts the purchase.',
  fMaxCpa: 'Maximum price per booking (USD)',
  fStop: 'Pause without InitiateCheckout from (USD)',
  stopHelp: 'If the ad has spent this much without a single guest starting a booking, the engine pauses it automatically.',
  fText: 'Ad text',
  fHeadline: 'Headline',
  fDescription: 'Description',
  fCta: 'Button',
  ctas: { BOOK_TRAVEL: 'Book now', LEARN_MORE: 'Learn more', SIGN_UP: 'Sign up' },
  fLink: 'Destination link with tracking',
  estimate: (days, spend, bookings) => `${days} days, at most ${spend} spent. At the price limit that would be about ${bookings} bookings. This is the calculation at the limit, not a forecast.`,
  save: 'Save changes',
  saving: 'Saving ...',
  working: 'One moment ...',
  failed: 'That did not work',
  saveFirst: 'Save your changes first.',
  approve: 'Approve',
  reopen: 'Edit again',
  reject: 'Reject',
  rejectPrompt: 'Why? (optional, only for you)',
  push: 'Send to Meta (paused)',
  pushHint: 'Creates campaign, ad set and ad at Meta. No money is spent yet.',
  activate: 'Switch on',
  pause: 'Pause',
  openAdsManager: 'View in Ads Manager',
  confirmActivate: (daily) => `Switch the ad on now? From now on up to ${daily} per day will be spent.`,
  checksTitle: 'Checks',
  phaseApprove: 'Before approval',
  phaseActivate: 'Before switching on',
  insightsTitle: 'Numbers at Meta',
  iSpend: 'Spent',
  iClicks: 'Clicks',
  iCheckouts: 'Bookings started',
  iPurchases: 'Purchases',
  iCpa: 'Price per purchase',
  asOf: 'As of',
  note: 'Note',
  checkTitles: {
    post_ready: 'Post approved',
    media: 'Media available',
    meta_setup: 'Meta access complete',
    account_ok: 'Ad account active',
    currency: 'Account in USD',
    budget_cap: 'Monthly budget respected',
    account_spend_cap: 'Spend limit of the account',
    free_nights: 'Free nights',
    pixel_events: 'Pixel reports InitiateCheckout',
    pixel_purchase: 'Pixel reports purchases'
  },
  checkDetail: (key, ok, p) => {
    switch (key) {
      case 'post_ready':
        return ok ? 'The post is approved.' : `The post has the status "${txt(p.status)}". Approve it first.`;
      case 'media':
        return ok ? `${num(p.count)} file(s) available.` : 'The post has no finished media.';
      case 'meta_setup':
        return ok ? 'Token, account, page and pixel are set.' : `Missing: ${list(p.missing)}.`;
      case 'account_ok':
        return ok ? 'The account is active.' : p.error ? `Meta does not answer: ${txt(p.error)}` : `The account has the status ${txt(p.status) || 'unknown'} (1 would be active).`;
      case 'currency':
        return ok ? 'USD: budget and planning match one to one.' : `The account runs in ${txt(p.currency) || 'an unknown currency'}. Planning is in USD, so sending is blocked.`;
      case 'budget_cap':
        return ok ? `${num(p.committed) + num(p.thisAd)} of ${num(p.cap)} USD planned per month.` : `With this ad it would be ${num(p.committed) + num(p.thisAd)} USD per month. ${num(p.cap)} USD is allowed.`;
      case 'account_spend_cap':
        return ok
          ? p.cap == null
            ? 'No spend limit is set on the account. Recommended: 500 USD in Ads Manager.'
            : `The account limit (${num(p.cap)} USD) is still enough.`
          : `The account limit (${num(p.cap)} USD, already spent ${num(p.spent)} USD) is not enough for this ad.`;
      case 'free_nights':
        return ok ? `${num(p.freeNights)} free nights in the next ${num(p.days)} days.` : p.freeNights == null ? 'The free nights could not be loaded.' : 'No free nights soon. The ad would run into nothing.';
      case 'pixel_events':
        return ok
          ? `${num(p.initiateCheckout)} InitiateCheckout in the last 7 days.`
          : p.error
            ? `Meta does not answer: ${txt(p.error)}`
            : `No InitiateCheckout in 7 days (page views: ${num(p.pageView)}). Without this event Meta cannot optimise. Galih builds the events.`;
      case 'pixel_purchase':
        return ok ? `${num(p.purchase)} purchases reported.` : 'No Purchase event yet. Not required, but needed to measure the real price per booking.';
      default:
        return ok ? 'OK.' : 'Not OK.';
    }
  }
};

export const adsStrings = (locale: Locale) => (locale === 'en' ? en : de);
export type AdsStrings = ReturnType<typeof adsStrings>;
