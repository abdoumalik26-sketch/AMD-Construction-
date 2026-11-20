/* =========================================================
   2AM CONSTRUCTION — Sécurité de chantier (QHSE)
   · Check-list sécurité quotidienne dans le rapport terrain
   · Registre des incidents et accidents (bureau + remontés du terrain)
   · Plan de prévention généré à partir du planning (risques par tâche)
   · Causeries sécurité (¼ h sécurité) avec feuille d'émargement
   · Alertes intégrées au moteur d'anticipation
   ========================================================= */
var QHSE = (function () {
  var X = APP.X, PL = PLAN, Cc = CALC, esc = X.esc, fmt = X.fmt, inp = X.inp, fld = X.fld;
  var $ = function (id) { return document.getElementById(id); };
  function P() { return X.P(); }
  function S() { return X.S(); }
  function fr(s) { return PL.fr(s); }
  function jour() { return X.ui.jour || PL.d2s(new Date()); }
  function uid() { return "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function badge(niv, t) { return '<span class="badge ' + niv + '">' + esc(t) + "</span>"; }

  var CHECK = [
    ["epi", "Casques, chaussures de sécurité et gants portés par tous"],
    ["balisage", "Chantier clôturé ou balisé, public et enfants tenus à l'écart"],
    ["hauteur", "Échafaudages stables, garde-corps et trémies protégés"],
    ["fouilles", "Fouilles protégées (talus, blindage, balisage)"],
    ["elec", "Installation électrique provisoire en bon état"],
    ["secours", "Trousse de secours et eau potable sur place"],
    ["proprete", "Chantier rangé, circulations dégagées"]
  ];
  var GRAV = [["presqu", "Presque accident (sans blessé)", "orange"], ["soins", "Accident sans arrêt (premiers soins)", "orange"], ["arret", "Accident avec arrêt de travail", "rouge"], ["grave", "Accident grave", "rouge"]];
  var RISQUES = [
    { id: "fouille", t: /^(TERR|FOND|VRD)/, l: /^RL(1|2|12)$/, nom: "Effondrement des parois de fouille, chute dans la fouille", m: ["Talutage ou blindage dès 1,30 m de profondeur", "Balisage ou garde-corps à 1 m du bord", "Pas de déblais ni de matériaux stockés au bord", "Échelle pour descendre et remonter"] },
    { id: "hauteur", t: /^(POT|PLAN|ACRO|ETAN|ENDE|MENA)/, l: /^RL(3|4|5|7)$/, nom: "Chute de hauteur (échafaudage, plancher, terrasse)", m: ["Échafaudage sur appuis solides, avec garde-corps et plinthes", "Trémies et bords de dalle protégés", "Harnais attaché si aucune protection collective", "Interdiction de monter sur les étais ou les parpaings"] },
    { id: "beton", t: /^(FOND|SOUB|DALL|POT|PLAN)/, l: /^RL(2|3)$/, nom: "Manutention lourde, brûlures du ciment, bétonnière", m: ["Gants et lunettes pour le béton et le mortier", "Charges de plus de 25 kg portées à deux", "Bétonnière arrêtée et débranchée pour le nettoyage", "Pauses et eau en quantité"] },
    { id: "fer", t: /^(FOND|SOUB|POT|PLAN)/, l: /^RL(2|3)$/, nom: "Coupures et perforations par les aciers en attente", m: ["Capuchons ou protections sur les fers en attente", "Gants de manutention pour le ferraillage"] },
    { id: "elec", t: /^(RES|APPA)/, l: /^RL10$/, nom: "Électrisation", m: ["Travail hors tension, tableau consigné", "Outillage isolé", "Contrôle par l'électricien avant la remise sous tension"] },
    { id: "feu", t: /^ETAN/, l: /^RL4$/, nom: "Brûlures et incendie (chalumeau, bitume)", m: ["Extincteur à portée de main", "Bouteilles de gaz debout, à l'ombre, robinet fermé après usage", "Rien d'inflammable à proximité"] },
    { id: "poussiere", t: /^(CARR|ENDI|PEIN|MAC)/, l: /^RL(5|8|11)$/, nom: "Poussières et produits (découpe, ponçage, peinture)", m: ["Masque anti-poussière pour la découpe et le ponçage", "Découpe à l'eau quand c'est possible", "Pièces aérées pour les peintures et solvants"] },
    { id: "circulation", t: /^(INST|TERR|VRD)/, l: /^RL(1|12)$/, nom: "Heurts avec véhicules et engins, livraisons", m: ["Zone de livraison balisée", "Un guide pour les manœuvres de camions", "Gilets haute visibilité pendant les livraisons"] },
    { id: "chaleur", ext: true, nom: "Coup de chaleur (travaux en plein soleil)", m: ["Eau fraîche en quantité, pauses à l'ombre", "Travaux pénibles tôt le matin si forte chaleur", "Surveiller les signes : maux de tête, vertiges, nausées"] }
  ];
  function risquesTache(t) { return RISQUES.filter(function (r) { return r.ext ? !!t.ext : (r.t && r.t.test(t.id)) || (r.l && r.l.test(t.id)); }); }
  function q(p) { p.qhse = p.qhse || {}; p.qhse.incidents = p.qhse.incidents || []; p.qhse.causeries = p.qhse.causeries || []; p.qhse.clos = p.qhse.clos || {}; p.qhse.infos = p.qhse.infos || {}; return p.qhse; }

  // Incidents : saisis au bureau + remontés dans les rapports terrain
  function incidents(p) {
    var Q = q(p), out = Q.incidents.map(function (x) { return Object.assign({ source: "bureau" }, x); });
    ((p.suivi || {}).rapports || []).forEach(function (r) {
      var s = r.secu || {}; if (!s.incGrav || !s.incDesc) return;
      var id = "rap-" + r.id; out.push({ id: id, date: r.date, gravite: s.incGrav, desc: s.incDesc, victime: s.incVictime || "", mesures: s.incMesures || "", photos: s.incPhotos || [], cloture: !!Q.clos[id], source: "terrain (" + (r.auteur || "rapport") + ")" });
    });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function joursSansAccident(p) {
    var acc = incidents(p).filter(function (x) { return x.gravite === "arret" || x.gravite === "grave"; }), deb = (p.planning || {}).debut || jour();
    var dernier = acc.length ? acc[0].date : deb;
    return Math.max(0, PL.diff(dernier, jour()));
  }
  function conformite(p, nbJours) {
    var lim = PL.addDays(jour(), -(nbJours || 14)), ok = 0, tot = 0, nc = {};
    ((p.suivi || {}).rapports || []).forEach(function (r) { if (r.date < lim || !r.secu) return; CHECK.forEach(function (c) { var v = r.secu[c[0]]; if (v === "ok") { ok++; tot++; } else if (v === "nc") { tot++; nc[c[0]] = (nc[c[0]] || 0) + 1; } }); });
    return { pct: tot ? Math.round(100 * ok / tot) : null, nc: nc, tot: tot };
  }

  /* ---------------- Alertes (appelées par le moteur d'anticipation) ---------------- */
  function alertes(p, j, F, add) {
    var Q = q(p), raps = ((p.suivi || {}).rapports || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var dernier = raps.filter(function (r) { return r.secu && CHECK.some(function (c) { return r.secu[c[0]]; }); })[0];
    if (dernier) CHECK.forEach(function (c) { if (dernier.secu[c[0]] === "nc") add(c[0] === "hauteur" || c[0] === "fouilles" ? "rouge" : "orange", p, "Sécurité", "Non-conformité au rapport du " + fr(dernier.date) + " : " + c[1].toLowerCase() + ". À corriger avant de poursuivre."); });
    if (raps.length >= 3 && raps.slice(0, 3).every(function (r) { return !r.secu || !CHECK.some(function (c) { return r.secu[c[0]]; }); })) add("orange", p, "Sécurité", "Les 3 derniers rapports n'ont pas de check-list sécurité : demandez au chef de chantier de la remplir chaque jour.");
    incidents(p).forEach(function (x) { if (!x.cloture) add(x.gravite === "arret" || x.gravite === "grave" ? "rouge" : "orange", p, "Sécurité", "Incident du " + fr(x.date) + " non clôturé : " + x.desc.slice(0, 90) + " (définir les mesures puis clôturer dans Sécurité)."); });
    var j7 = PL.addDays(j, 7);
    F.taches.forEach(function (t) {
      if (t.pct >= 100 || t.pDebut > j7 || t.pFin < j) return;
      risquesTache(t).filter(function (r) { return r.id !== "chaleur"; }).forEach(function (r) {
        var fait = Q.causeries.some(function (c) { return c.risque === r.id && c.date >= PL.addDays(t.pDebut, -10) && c.date <= t.pFin; });
        if (!fait) add("orange", p, "Sécurité", "Causerie sécurité à faire avant « " + t.nom + " » (début le " + fr(t.pDebut) + ") : " + r.nom.toLowerCase() + ".", t.pDebut);
      });
    });
  }

  /* ---------------- Check-list dans le rapport terrain ---------------- */
  function rapportHTML(b) {
    b.secu = b.secu || {};
    var s = b.secu;
    return '<div class="card"><h2>Sécurité du jour</h2><table class="t"><tr><th class="l">Point de contrôle</th><th>Conforme</th><th>Non conforme</th><th>Sans objet</th></tr>' + CHECK.map(function (c) {
      return '<tr><td class="l">' + esc(c[1]) + "</td>" + ["ok", "nc", "na"].map(function (v) { return '<td><input type="radio" name="sc-' + c[0] + '" data-sc="' + c[0] + '" value="' + v + '"' + (s[c[0]] === v ? " checked" : "") + "></td>"; }).join("") + "</tr>";
    }).join("") + '</table><label class="f wide"><span>Observation sécurité (si non conforme : ce qui a été fait)</span><textarea data-br="secu.obs" rows="2">' + esc(s.obs || "") + '</textarea></label>' +
      '<details style="margin-top:8px"' + (s.incGrav ? " open" : "") + '><summary><b>Déclarer un incident ou un accident</b></summary><div class="form" style="margin-top:8px"><label class="f"><span>Gravité</span><select data-br="secu.incGrav"><option value="">— aucun incident —</option>' + GRAV.map(function (g) { return '<option value="' + g[0] + '"' + (s.incGrav === g[0] ? " selected" : "") + ">" + esc(g[1]) + "</option>"; }).join("") + '</select></label><label class="f"><span>Personne concernée</span><input type="text" data-br="secu.incVictime" value="' + esc(s.incVictime || "") + '"></label></div><label class="f wide"><span>Ce qui s\'est passé</span><textarea data-br="secu.incDesc" rows="2">' + esc(s.incDesc || "") + '</textarea></label><label class="f wide"><span>Mesures prises immédiatement</span><textarea data-br="secu.incMesures" rows="2">' + esc(s.incMesures || "") + "</textarea></label><p class=\"hint\">En cas d'accident grave : appelez les secours (sapeurs-pompiers 18, SAMU 1515), puis prévenez le bureau immédiatement par téléphone.</p></div></details></div>";
  }
  function postRapport(b) {
    document.querySelectorAll("[data-sc]").forEach(function (el) { el.onchange = function () { b.secu = b.secu || {}; b.secu[el.dataset.sc] = el.value; X.save(); }; });
  }

  /* ---------------- Page Sécurité ---------------- */
  function page() {
    X.ui.sub.qhse = X.ui.sub.qhse || "bord";
    var h = '<div class="head"><h1>Sécurité (QHSE)</h1><p>Zéro accident : check-lists quotidiennes, registre des incidents, plan de prévention tiré du planning et causeries sécurité. Les points à traiter remontent dans les alertes OPC.</p></div>';
    h += X.tabs("qhse", [["bord", "Tableau de bord"], ["inc", "Incidents et accidents"], ["plan", "Plan de prévention"], ["caus", "Causeries sécurité"]]);
    return h + ({ bord: bord, inc: pInc, plan: pPlan, caus: pCaus }[X.ui.sub.qhse] || bord)();
  }
  function bord() {
    var p = P(), I = incidents(p), c = conformite(p, 14), Q = q(p), mois = jour().slice(0, 7), js = joursSansAccident(p);
    var h = '<div class="kpis">' + X.kpi("Jours sans accident avec arrêt", js, "chantier « " + esc(p.info.nom) + " »") + X.kpi("Conformité des check-lists", c.pct == null ? "—" : c.pct + " %", "14 derniers jours (" + c.tot + " contrôles)") +
      X.kpi("Incidents ouverts", I.filter(function (x) { return !x.cloture; }).length, I.length + " déclarés au total") + X.kpi("Causeries ce mois", Q.causeries.filter(function (x) { return (x.date || "").slice(0, 7) === mois; }).length, "objectif : au moins 1 par semaine") + "</div>";
    var ncs = Object.keys(c.nc);
    if (ncs.length) h += '<div class="card"><h2>Non-conformités relevées (14 jours)</h2><table class="t">' + ncs.map(function (k) { var it = CHECK.filter(function (x) { return x[0] === k; })[0]; return '<tr><td class="l">' + esc(it[1]) + "</td><td>" + c.nc[k] + " fois</td></tr>"; }).join("") + "</table></div>";
    var al = [], F = PL.prevision(p, Cc.dqe(p, X.ST()), jour()); alertes(p, jour(), F, function (niv, pp, type, msg) { al.push({ niv: niv, msg: msg }); });
    h += '<div class="card"><h2>À faire en sécurité</h2>' + (al.length ? '<div class="alerts">' + al.map(function (a) { return '<div class="al ' + a.niv + '"><b>Sécurité</b><p>' + esc(a.msg) + "</p></div>"; }).join("") + "</div>" : '<p class="hint">Rien à signaler.</p>') + "</div>";
    var tous = S().projects.filter(function (x) { return x.statut === "chantier" && !x.archive; });
    if (tous.length > 1) h += '<div class="card"><h2>Tous les chantiers en cours</h2><table class="t"><tr><th class="l">Chantier</th><th>Jours sans accident</th><th>Conformité</th><th>Incidents ouverts</th></tr>' + tous.map(function (x) { var cc = conformite(x, 14); return '<tr><td class="l">' + esc(x.info.nom) + "</td><td>" + joursSansAccident(x) + "</td><td>" + (cc.pct == null ? "—" : cc.pct + " %") + "</td><td>" + incidents(x).filter(function (i) { return !i.cloture; }).length + "</td></tr>"; }).join("") + "</table></div>";
    h += '<div class="card"><h2>Informations de secours du chantier</h2><div class="form">' + fld("Centre de santé / hôpital le plus proche", "qhse.infos.hopital", { text: true }) + fld("Téléphone du centre de santé", "qhse.infos.telHopital", { text: true }) + fld("Responsable sécurité sur le chantier", "qhse.infos.resp", { text: true }) + fld("Téléphone du responsable", "qhse.infos.telResp", { text: true }) + '</div><p class="hint">Numéros d\'urgence au Sénégal : sapeurs-pompiers 18, police 17, gendarmerie 123, SAMU 1515. Ces informations figurent sur le plan de prévention à afficher sur le chantier.</p></div>';
    return h;
  }
  function pInc() {
    var p = P(), I = incidents(p);
    var h = '<div class="bar-btn"><button class="btn p" id="incAdd">+ Déclarer un incident</button><button class="btn" id="incPdf">Registre des incidents (PDF)</button></div>';
    var loc = q(p).incidents;
    if (loc.length) h += '<div class="card"><h2>Saisis au bureau</h2>' + loc.map(function (x, i) {
      var b = "qhse.incidents." + i;
      return '<div style="border-bottom:1px solid var(--line);padding:8px 0"><div class="form">' + fld("Date", b + ".date", { date: true }) + fld("Gravité", b + ".gravite", { options: GRAV.map(function (g) { return [g[0], g[1]]; }) }) + fld("Personne concernée", b + ".victime", { text: true }) + fld("Clôturé", b + ".cloture", { check: true }) + '</div><label class="f wide"><span>Description</span>' + inp(b + ".desc", { area: true, rows: 2 }) + '</label><label class="f wide"><span>Causes</span>' + inp(b + ".cause", { area: true, rows: 2 }) + '</label><label class="f wide"><span>Mesures correctives (pour que cela ne se reproduise pas)</span>' + inp(b + ".mesures", { area: true, rows: 2 }) + '</label><button class="btn sm danger" data-idel="' + i + '">Supprimer</button></div>';
    }).join("") + "</div>";
    var ter = I.filter(function (x) { return x.source !== "bureau"; });
    if (ter.length) h += '<div class="card"><h2>Remontés du terrain</h2><table class="t"><tr><th>Date</th><th class="l">Gravité</th><th class="l">Description</th><th class="l">Mesures</th><th class="l">Source</th><th>Clôturé</th></tr>' + ter.map(function (x) { var g = GRAV.filter(function (y) { return y[0] === x.gravite; })[0] || GRAV[0]; return "<tr><td>" + fr(x.date) + '</td><td class="l">' + badge(g[2], g[1]) + '</td><td class="l">' + esc(x.desc) + '</td><td class="l">' + esc(x.mesures) + '</td><td class="l">' + esc(x.source) + '</td><td><input type="checkbox" data-iclos="' + x.id + '"' + (x.cloture ? " checked" : "") + "></td></tr>"; }).join("") + "</table></div>";
    if (!I.length) h += '<div class="card"><p class="hint">Aucun incident déclaré. Déclarez aussi les « presque accidents » : ce sont eux qui permettent d\'éviter les vrais accidents.</p></div>';
    return h;
  }
  function planTaches(p) {
    var F = PL.prevision(p, Cc.dqe(p, X.ST()), jour()), out = [];
    F.taches.filter(function (t) { return t.pct < 100; }).forEach(function (t) { var r = risquesTache(t).filter(function (x) { return x.id !== "chaleur"; }); if (r.length) out.push({ t: t, r: r }); });
    return out;
  }
  function pPlan() {
    var p = P(), L = planTaches(p);
    var h = '<div class="bar-btn"><button class="btn p" id="ppPdf">Plan de prévention à afficher (PDF)</button></div><div class="card"><h2>Règles générales du chantier</h2><ul><li>Casque, chaussures de sécurité et gants obligatoires pour tous, visiteurs compris.</li><li>Chantier clôturé ; accès interdit au public et aux enfants.</li><li>Aucun travail en hauteur sans protection (garde-corps ou harnais).</li><li>Trousse de secours et eau potable en permanence sur le chantier.</li><li>Tout incident, même sans blessé, est signalé le jour même.</li><li>Forte chaleur : eau fraîche en quantité, pauses à l\'ombre, travaux pénibles tôt le matin.</li></ul></div>';
    h += '<div class="card"><h2>Risques et mesures par tâche (tiré du planning)</h2>' + (L.length ? '<table class="t"><tr><th class="l">Tâche</th><th>Période</th><th class="l">Risques</th><th class="l">Mesures de prévention</th></tr>' + L.map(function (x) { return '<tr><td class="l"><b>' + esc(x.t.nom) + "</b></td><td>" + fr(x.t.pDebut) + " → " + fr(x.t.pFin) + '</td><td class="l">' + x.r.map(function (r) { return esc(r.nom); }).join("<br>") + '</td><td class="l small">' + x.r.map(function (r) { return r.m.map(esc).join(" · "); }).join("<br>") + "</td></tr>"; }).join("") + "</table>" : '<p class="hint">Aucune tâche à venir.</p>') + "</div>";
    return h;
  }
  function pCaus() {
    var p = P(), Q = q(p), L = planTaches(p).filter(function (x) { return x.t.pDebut <= PL.addDays(jour(), 14); });
    var sug = []; L.forEach(function (x) { x.r.forEach(function (r) { if (!sug.some(function (s) { return s.r.id === r.id; })) sug.push({ r: r, t: x.t }); }); });
    var h = '<div class="card"><h2>Thèmes conseillés (tâches des 2 prochaines semaines)</h2>' + (sug.length ? '<table class="t">' + sug.map(function (s, i) { return '<tr><td class="l"><b>' + esc(s.r.nom) + '</b><br><span class="hint">avant « ' + esc(s.t.nom) + " » (" + fr(s.t.pDebut) + ')</span></td><td><button class="btn sm p" data-cfaire="' + i + '">Enregistrer la causerie</button> <button class="btn sm" data-cemarg="' + i + '">Feuille d\'émargement (PDF)</button></td></tr>'; }).join("") + "</table>" : '<p class="hint">Aucune tâche à risque dans les 2 prochaines semaines.</p>') + "</div>";
    h += '<div class="card"><h2>Causeries réalisées</h2>' + (Q.causeries.length ? '<table class="t edit"><tr><th>Date</th><th class="l">Thème</th><th class="l">Animée par</th><th>Participants</th><th></th></tr>' + Q.causeries.map(function (c, i) { var b = "qhse.causeries." + i; return "<tr><td>" + inp(b + ".date", { date: true }) + '</td><td class="l">' + esc(c.theme) + '</td><td class="l">' + inp(b + ".anim", { text: true }) + "</td><td>" + inp(b + ".nb", { w: "60px" }) + '</td><td><button class="x" data-cdel="' + i + '">✕</button></td></tr>'; }).join("") + "</table>" : '<p class="hint">Aucune causerie enregistrée. Un quart d\'heure sécurité par semaine, avant chaque tâche à risque, réduit fortement les accidents.</p>') + "</div>";
    X.ui._sug = sug;
    return h;
  }
  function post() {
    X.bindTabs("qhse"); var p = P(), Q = q(p), b;
    if ((b = $("incAdd"))) b.onclick = function () { Q.incidents.unshift({ id: uid(), date: jour(), gravite: "presqu", victime: "", desc: "", cause: "", mesures: "", cloture: false, photos: [] }); X.save(); X.renderPage(); };
    document.querySelectorAll("[data-idel]").forEach(function (el) { el.onclick = function () { if (el.dataset.c !== "1") { el.dataset.c = "1"; el.textContent = "Confirmer"; return; } Q.incidents.splice(+el.dataset.idel, 1); X.save(); X.renderPage(); }; });
    document.querySelectorAll("[data-iclos]").forEach(function (el) { el.onchange = function () { if (el.checked) Q.clos[el.dataset.iclos] = jour(); else delete Q.clos[el.dataset.iclos]; X.save(); }; });
    if ((b = $("incPdf"))) b.onclick = pdfRegistre;
    if ((b = $("ppPdf"))) b.onclick = pdfPlan;
    var sug = X.ui._sug || [];
    document.querySelectorAll("[data-cfaire]").forEach(function (el) { el.onclick = function () { var s = sug[+el.dataset.cfaire]; Q.causeries.unshift({ date: jour(), risque: s.r.id, theme: s.r.nom, tache: s.t.nom, anim: S().ent.responsable || "", nb: "" }); X.save(); X.renderPage(); X.toast("Causerie enregistrée : indiquez le nombre de participants"); }; });
    document.querySelectorAll("[data-cemarg]").forEach(function (el) { el.onclick = function () { pdfEmargement(sug[+el.dataset.cemarg]); }; });
    document.querySelectorAll("[data-cdel]").forEach(function (el) { el.onclick = function () { Q.causeries.splice(+el.dataset.cdel, 1); X.save(); X.renderPage(); }; });
  }

  /* ---------------- PDF ---------------- */
  function H() { return APP._pdf().h; }
  function pdfPlan() {
    var h = H(), p = P(), Q = q(p), doc = h.doc0(), titre = "PLAN DE PRÉVENTION SÉCURITÉ", sous = "À afficher sur le chantier · " + fr(jour());
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, "");
    var inf = Q.infos;
    y = h.table(doc, { startY: y, theme: "plain", body: [["Urgences", "Sapeurs-pompiers 18 · Police 17 · Gendarmerie 123 · SAMU 1515"], ["Centre de santé le plus proche", (inf.hopital || "à compléter") + (inf.telHopital ? " · " + inf.telHopital : "")], ["Responsable sécurité sur place", (inf.resp || "à compléter") + (inf.telResp ? " · " + inf.telResp : "")], ["Bureau 2AM", (S().ent.responsable || "") + " · " + (S().ent.tel || "")]].map(function (x) { return [h.t(x[0]), h.t(x[1])]; }), columnStyles: { 0: { fontStyle: "bold", cellWidth: 62 } } }, titre, sous) + 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(h.t("Règles générales"), 14, y); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    var reg = doc.splitTextToSize(h.t("- Casque, chaussures de sécurité et gants obligatoires pour tous, visiteurs compris.\n- Chantier clôturé ; accès interdit au public et aux enfants.\n- Aucun travail en hauteur sans protection (garde-corps ou harnais).\n- Trousse de secours et eau potable en permanence sur le chantier.\n- Tout incident, même sans blessé, est signalé le jour même au chef de chantier.\n- Forte chaleur : eau fraîche en quantité, pauses à l'ombre, travaux pénibles tôt le matin."), 182);
    doc.text(reg, 14, y + 5); y += reg.length * 4.3 + 9;
    h.table(doc, { startY: y, head: [["Tâche", "Période", "Risques", "Mesures de prévention"]], body: planTaches(p).map(function (x) { return [h.t(x.t.nom), fr(x.t.pDebut) + "\n" + fr(x.t.pFin), h.t(x.r.map(function (r) { return r.nom; }).join("\n")), h.t(x.r.map(function (r) { return r.m.map(function (m) { return "- " + m; }).join("\n"); }).join("\n"))]; }), columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 22 }, 2: { cellWidth: 46 }, 3: { cellWidth: 76, fontSize: 7.5 } } }, titre, sous);
    h.footers(doc, "Plan de prévention"); X.saveFile(doc.output("blob"), "Plan_prevention_" + X.slug(p.info.nom) + ".pdf");
  }
  function pdfEmargement(s) {
    var h = H(), p = P(), doc = h.doc0(), titre = "CAUSERIE SÉCURITÉ", sous = "Thème : " + s.r.nom;
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, "Date : ____ / ____ / ________");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(h.t("Avant la tâche : " + s.t.nom), 14, y); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    var tx = doc.splitTextToSize(h.t("Risque : " + s.r.nom + "\nMesures à respecter :\n" + s.r.m.map(function (m) { return "- " + m; }).join("\n")), 182); doc.text(tx, 14, y + 6); y += tx.length * 4.6 + 10;
    var body = []; for (var i = 1; i <= 15; i++) body.push([i, "", "", ""]);
    h.table(doc, { startY: y, head: [["N°", "Nom et prénom", "Métier", "Signature"]], body: body, styles: { minCellHeight: 9 }, columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 70 }, 2: { cellWidth: 40 }, 3: { cellWidth: 62 } } }, titre, sous);
    h.footers(doc, "Causerie sécurité"); X.saveFile(doc.output("blob"), "Causerie_" + s.r.id + "_" + X.slug(p.info.nom) + ".pdf");
  }
  function pdfRegistre() {
    var h = H(), p = P(), doc = h.doc0(), titre = "REGISTRE DES INCIDENTS ET ACCIDENTS", sous = "Au " + fr(jour());
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, "Jours sans accident avec arrêt : " + joursSansAccident(p));
    h.table(doc, { startY: y, head: [["Date", "Gravité", "Description", "Mesures", "Statut"]], body: incidents(p).map(function (x) { var g = GRAV.filter(function (y) { return y[0] === x.gravite; })[0] || GRAV[0]; return [fr(x.date), h.t(g[1]), h.t(x.desc + (x.victime ? " (" + x.victime + ")" : "")), h.t(x.mesures || ""), x.cloture ? "Clôturé" : "Ouvert"]; }), columnStyles: { 1: { cellWidth: 30 }, 2: { cellWidth: 62 }, 3: { cellWidth: 50 } } }, titre, sous);
    h.footers(doc, "Registre sécurité"); X.saveFile(doc.output("blob"), "Registre_securite_" + X.slug(p.info.nom) + ".pdf");
  }

  APP.reg("qhse", page, post);
  return { alertes: alertes, rapportHTML: rapportHTML, postRapport: postRapport, incidents: incidents, joursSansAccident: joursSansAccident, conformite: conformite, RISQUES: RISQUES, risquesTache: risquesTache };
})();
