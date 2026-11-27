/* Portfolio-Dashboard: Sprachhilfen. Muss vor den Dashboard-Teilen (app-p*.min.js) geladen werden.
   __L(text, args)  Anzeigetext; deutsch = Originaltext, englisch = Eintrag aus i18n-en.json (Platzhalter {0}, {1} …)
   __D(text)        Datenwerte (Empfehlung, Status, Kategorie …): nur Anzeige übersetzen, Logik bleibt deutsch
   __TR(name, rows) übersetzt die Freitexte der geladenen Datensätze
   __LOC()          Sprache für Datumsformate */
(function () {
  var w = window;
  var en = w.ORBIT_PORTFOLIO_LOCALE === "en";
  var dict = w.ORBIT_PORTFOLIO_EN || {};
  function fill(t, a) {
    if (!a || !a.length) return t;
    return t.replace(/\{(\d+)\}/g, function (m, i) {
      return String(a[+i]);
    });
  }
  w.__L = function (t, a) {
    if (en && Object.prototype.hasOwnProperty.call(dict, t)) t = dict[t];
    return fill(t, a);
  };
  function d(s) {
    if (!en || typeof s !== "string" || !s) return s;
    if (Object.prototype.hasOwnProperty.call(dict, s)) return dict[s];
    var m;
    if ((m = s.match(/^Ausgeschieden (.+)$/))) return "Left " + m[1];
    if ((m = s.match(/^Nicht mehr im Portfolio \(seit (.+)\)$/))) return "No longer in portfolio (since " + m[1] + ")";
    if ((m = s.match(/^(.*) \(vorläufig – Miete fehlt\)$/))) return d(m[1]) + " (provisional – rent missing)";
    return s;
  }
  w.__D = d;
  var FIELDS = {
    properties: ["summary", "causes", "actions", "market"],
    issues: ["category", "text", "source"],
    markets: ["market"],
  };
  w.__TR = function (name, rows) {
    var f = FIELDS[name];
    if (!en || !f || !Array.isArray(rows)) return rows;
    return rows.map(function (r) {
      var o = Object.assign({}, r);
      f.forEach(function (k) {
        if (typeof o[k] === "string") o[k] = d(o[k]);
      });
      return o;
    });
  };
  w.__LOC = function () {
    return en ? "en-GB" : "de-CH";
  };
})();
