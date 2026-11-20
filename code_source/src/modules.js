/* ============================================================
   2AM CONSTRUCTION — modules Planning, OPC, Suivi terrain,
   Facturation & trésorerie, Mémoires techniques
   ============================================================ */
var MOD = (function () {
  var X = APP.X, PL = PLAN, Cc = CALC;
  var $ = function (id) { return document.getElementById(id); };
  var esc = X.esc, fmt = X.fmt, fld = X.fld, inp = X.inp;
  function P() { return X.P(); }
  function S() { return X.S(); }
  function today() { return PL.d2s(new Date()); }
  function jour() { return X.ui.jour || today(); }
  function F(p) { p = p || P(); var q = Cc.dqe(p, X.ST()); return { q: q, F: PL.prevision(p, q, jour()) }; }
  function fr(s) { return PL.fr(s); }
  function uid(pfx) { return (pfx || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function badge(niv, txt) { return '<span class="badge ' + niv + '">' + esc(txt) + "</span>"; }
  function feu(m) { return m == null ? "gris" : m < 0 ? "rouge" : m < 10 ? "orange" : "vert"; }
  var LIBM = { MAC: "Maçons", FER: "Ferrailleurs", COFR: "Coffreurs", MAN: "Manœuvres", CARR: "Carreleurs", PEIN: "Peintres", PLOM: "Plombiers", ELEC: "Électriciens", MEN: "Menuisiers", ETANC: "Étancheurs", CHEF: "Chefs d'équipe" };

  /* ---------- Images : compression ---------- */
  function lireImage(file, max, qual) {
    return new Promise(function (res) {
      var rd = new FileReader();
      rd.onload = function () {
        var img = new Image();
        img.onload = function () {
          var sc = Math.min(1, (max || 1280) / Math.max(img.width, img.height)), cv = document.createElement("canvas");
          cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          res(cv.toDataURL("image/jpeg", qual || 0.62));
        };
        img.onerror = function () { res(null); };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }
  function vignettes(ids, cls) {
    return '<div class="thumbs">' + (ids || []).map(function (id) { return '<img data-ph="' + id + '" class="' + (cls || "") + '" alt="photo">'; }).join("") + "</div>";
  }
  function chargerVignettes() {
    document.querySelectorAll("img[data-ph]").forEach(function (im) {
      X.photoGet(im.dataset.ph).then(function (d) { if (d) { im.src = d; im.onclick = function () { var w = $("lightbox"); w.querySelector("img").src = d; w.classList.add("on"); }; } else im.classList.add("missing"); });
    });
  }

  /* ---------- Partage de fichiers (WhatsApp / téléchargement) ---------- */
  function partager(obj, nom, titre) {
    var json = JSON.stringify(obj), file;
    try { file = new File([json], nom, { type: "application/json" }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: titre, text: titre }).catch(function () {});
      return;
    }
    X.saveFile(new Blob([json], { type: "application/json" }), nom);
  }
  function importerFichiers(files, apres) {
    var arr = Array.prototype.slice.call(files), bilan = { rapports: 0, projets: 0, sauvegarde: 0, erreurs: 0 };
    var suite = Promise.resolve();
    arr.forEach(function (f) {
      suite = suite.then(function () {
        return f.text().then(function (txt) {
          var o; try { o = JSON.parse(txt); } catch (e) { bilan.erreurs++; return; }
          if (o.type === "rapport") return integrerRapport(o).then(function (ok) { if (ok) bilan.rapports++; });
          if (o.type === "projet") { integrerProjet(o); bilan.projets++; return; }
          if (o.projects || o.type === "sauvegarde2AM") { return PIL.importer(o).then(function () { bilan.sauvegarde++; }); }
          bilan.erreurs++;
        });
      });
    });
    suite.then(function () {
      X.save(); X.renderTop(); X.renderPage();
      var m = [];
      if (bilan.rapports) m.push(bilan.rapports + " rapport(s)");
      if (bilan.projets) m.push(bilan.projets + " projet(s)");
      if (bilan.sauvegarde) m.push("sauvegarde complète");
      X.toast(m.length ? "Importé : " + m.join(", ") : "Aucun fichier reconnu");
      if (apres) apres(bilan);
    });
  }
  function integrerRapport(o) {
    var p = S().projects.filter(function (x) { return x.id === o.pid; })[0];
    if (!p) { X.toast("Projet « " + o.projet + " » introuvable : importez d'abord le projet"); return Promise.resolve(false); }
    var r = o.rapport;
    if (p.suivi.rapports.some(function (x) { return x.id === r.id; })) return Promise.resolve(false);
    p.suivi.rapports.push(r);
    var ps = Object.keys(o.photos || {}).map(function (id) { return X.photoPut(id, o.photos[id]); });
    return Promise.all(ps).then(function () { return true; });
  }
  function integrerProjet(o) {
    var s = S(), p = o.projet, ex = s.projects.filter(function (x) { return x.id === p.id; })[0];
    if (ex) { var raps = ex.suivi.rapports; Object.assign(ex, p); ex.suivi.rapports = mergeById(raps, p.suivi.rapports || []); }
    else s.projects.push(p);
    if (o.collab && o.collab.length && !s.collab.length) s.collab = o.collab;
    s.active = p.id; X.setS(s);
  }
  function mergeById(a, b) { var ids = {}; a.forEach(function (x) { ids[x.id] = 1; }); return a.concat(b.filter(function (x) { return !ids[x.id]; })); }

  /* =========================================================
     PLANNING
     ========================================================= */
  function gantt(T, opts) {
    opts = opts || {};
    if (!T.length) return "<p>Aucune tâche : complétez le métré.</p>";
    var d0 = T.reduce(function (m, t) { var s = opts.prev ? t.pDebut : t.debut; return !m || s < m ? s : m; }, null);
    var d1 = T.reduce(function (m, t) { var s = opts.prev ? t.pFin : t.fin; return !m || s > m ? s : m; }, null);
    if (opts.livraison && opts.livraison > d1) d1 = opts.livraison;
    d0 = PL.addDays(d0, -3); d1 = PL.addDays(d1, 10);
    var nj = PL.diff(d0, d1) + 1, px = Math.max(2.5, Math.min(14, 820 / nj)), L = 270, rh = 24, W = L + nj * px + 10, H = 34 + T.length * rh + 8;
    var X0 = function (s) { return L + PL.diff(d0, s) * px; };
    var s = '<svg class="gantt" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">';
    // hivernage + mois
    var d = d0;
    while (d <= d1) {
      var dt = PL.s2d(d), m = dt.getMonth() + 1;
      if (dt.getDate() === 1 || d === d0) {
        var finM = PL.d2s(new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 12)); if (finM > d1) finM = d1;
        var x = X0(d), w = (PL.diff(d, finM) + 1) * px;
        if (m >= 7 && m <= 10) s += '<rect x="' + x + '" y="20" width="' + w + '" height="' + (H - 20) + '" class="hiv"/>';
        s += '<line x1="' + x + '" x2="' + x + '" y1="16" y2="' + H + '" class="gl"/><text x="' + (x + 3) + '" y="13" class="ml">' + dt.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) + "</text>";
      }
      d = PL.addDays(d, 1);
    }
    T.forEach(function (t, i) {
      var y = 30 + i * rh, deb = opts.prev ? t.pDebut : t.debut, fin = opts.prev ? t.pFin : t.fin;
      s += '<text x="6" y="' + (y + 13) + '" class="tl' + (t.critique ? " crit" : "") + '">' + esc(t.nom.length > 44 ? t.nom.slice(0, 43) + "…" : t.nom) + "</text>";
      if (opts.prev && t.refDebut) s += '<rect x="' + X0(t.refDebut) + '" y="' + (y + 15) + '" width="' + Math.max(2, (PL.diff(t.refDebut, t.refFin) + 1) * px) + '" height="3" class="ref"/>';
      var bx = X0(deb), bw = Math.max(3, (PL.diff(deb, fin) + 1) * px);
      s += '<rect x="' + bx + '" y="' + (y + 2) + '" width="' + bw + '" height="12" rx="2" class="bar' + (t.critique ? " crit" : "") + '"><title>' + esc(t.nom + " : " + fr(deb) + " → " + fr(fin) + " (" + t.dur + " j ouvrés)" + (t.marge > 0 ? ", marge " + t.marge + " j" : ", critique")) + "</title></rect>";
      if (t.pct) s += '<rect x="' + bx + '" y="' + (y + 2) + '" width="' + bw * t.pct / 100 + '" height="12" rx="2" class="done"/>';
      if (t.pa) s += '<text x="' + (bx + bw + 3) + '" y="' + (y + 12) + '" class="pa">◆</text>';
    });
    var tj = jour();
    if (tj >= d0 && tj <= d1) s += '<line x1="' + X0(tj) + '" x2="' + X0(tj) + '" y1="18" y2="' + H + '" class="today"/><text x="' + (X0(tj) + 3) + '" y="27" class="tdl">aujourd\'hui</text>';
    if (opts.livraison) s += '<line x1="' + X0(opts.livraison) + '" x2="' + X0(opts.livraison) + '" y1="18" y2="' + H + '" class="livr"/><text x="' + (X0(opts.livraison) - 3) + '" y="27" text-anchor="end" class="lvl">livraison promise</text>';
    return '<div class="gwrap">' + s + "</svg></div>";
  }
  function pagePlanning() {
    var p = P(), r = F(p), pl = r.F.base, T = pl.taches, liv = p.info.dateLivraison, marge = liv ? PL.diff(pl.fin, liv) : null;
    var h = '<div class="head"><h1>Planning</h1><p>Généré à partir du métré : durée de chaque tâche = journées de main-d\'œuvre des sous-détails ÷ effectif de l\'équipe. Il tient compte des délais de cure et de séchage, de l\'hivernage (juillet à octobre) et des jours ouvrés.</p></div>';
    h += '<div class="kpis">' + X.kpi("Début des travaux", fr(pl.debut), "modifiable ci-dessous") + X.kpi("Fin prévue", fr(pl.fin), pl.duree + " jours calendaires (" + Math.round(pl.duree / 7) + " semaines)") +
      X.kpi("Livraison promise", liv ? fr(liv) : "—", liv ? (marge >= 0 ? "marge de " + marge + " jours" : (-marge) + " jours de dépassement") : "à renseigner dans Projets") +
      X.kpi("Tâches critiques", T.filter(function (t) { return t.critique; }).length + " / " + T.length, "un retard sur l'une d'elles décale la livraison") + "</div>";
    if (liv && marge < 0) h += '<div class="note rouge">Le planning dépasse la date promise de <b>' + (-marge) + ' jours</b>. Leviers : renforcer les équipes des tâches critiques (en rouge), travailler le samedi, démarrer plus tôt, ou renégocier la date.</div>';
    if (window.PIL) h += PIL.risqueHTML(p);
    h += '<div class="card"><h2>Paramètres du planning</h2><div class="form">' + fld("Date de début des travaux", "planning.debut", { date: true }) + fld("Travail le samedi", "planning.samedi", { check: true }) +
      fld("Prendre en compte l'hivernage", "planning.hivernage", { check: true }, "De juillet à octobre, la productivité des travaux extérieurs est réduite.") + fld("Productivité en hivernage (0 à 1)", "planning.facteurHiv", {}, "0,75 = les travaux extérieurs avancent à 75 % de la normale.") + "</div>" +
      '<h2 style="margin-top:14px">Effectif affecté à ce chantier (par métier)</h2><div class="form">' + Object.keys(PL.EQUIPES).filter(function (k) { return k !== "CHEF"; }).map(function (k) { return fld(LIBM[k], "planning.equipes." + k); }).join("") + "</div></div>";
    h += '<div class="bar-btn"><button class="btn p" id="pdfGantt">Générer le PDF du planning</button><button class="btn" id="figer">' + (p.planning.ref ? "Mettre à jour le planning de référence" : "Figer comme planning de référence") + '</button><button class="btn" id="rstPl">Effacer les ajustements manuels</button>' + (p.planning.ref ? '<span class="hint">Référence figée : l\'OPC mesure les retards par rapport à elle.</span>' : "") + "</div>";
    h += '<div class="card"><h2>Diagramme de Gantt</h2><div class="legend"><i class="lg bar"></i>tâche <i class="lg crit"></i>critique <i class="lg hiv"></i>hivernage <span class="pa">◆</span> point d\'arrêt qualité</div>' + gantt(T, { livraison: liv }) + "</div>";
    h += '<div class="card"><h2>Tâches</h2><table class="t edit"><tr><th class="l">Tâche</th><th class="l">Métier principal</th><th>Journées</th><th>Durée calculée</th><th>Durée ajustée</th><th>Début imposé</th><th>Début</th><th>Fin</th><th>Marge</th></tr>';
    T.forEach(function (t) {
      var j = Object.keys(t.mo).reduce(function (s, k) { return s + t.mo[k]; }, 0), ov = p.planning.ov[t.id] || {};
      h += '<tr class="' + (t.critique ? "critrow" : "") + '"><td class="l">' + esc(t.nom) + (t.conflit ? " " + X.esc("") + '<span class="badge rouge">conflit</span>' : "") + '</td><td class="l small">' + (t.metier ? LIBM[t.metier] + " × " + t.equipe : "—") + "</td><td>" + fmt(j) + "</td><td>" + t.durCalc + ' j</td><td><input type="number" min="1" data-pov="' + t.id + '|dur" value="' + (ov.dur || "") + '" placeholder="' + t.durCalc + '"></td><td><input type="date" data-pov="' + t.id + '|debut" value="' + (ov.debut || "") + '"></td><td>' + fr(t.debut) + "</td><td>" + fr(t.fin) + "</td><td>" + (t.critique ? badge("rouge", "critique") : t.marge + " j") + "</td></tr>";
    });
    return h + '</table><p class="hint">Durée ajustée : remplace la durée calculée. Début imposé : force la date de début. Si elle ne respecte pas les enchaînements (cure, séchage, tâches précédentes), le conflit est signalé ici et dans l\'OPC.</p></div>';
  }
  function postPlanning() {
    var p = P();
    document.querySelectorAll("[data-pov]").forEach(function (el) {
      el.onchange = function () { var a = el.dataset.pov.split("|"); var o = p.planning.ov[a[0]] = p.planning.ov[a[0]] || {}; if (el.value === "") delete o[a[1]]; else o[a[1]] = a[1] === "dur" ? +el.value : el.value; X.save(); X.renderPage(); };
    });
    $("figer").onclick = function () { var pl = F(p).F.base, ref = {}; pl.taches.forEach(function (t) { ref[t.id] = [t.debut, t.fin]; }); p.planning.ref = ref; X.save(); X.renderPage(); X.toast("Planning de référence enregistré"); };
    $("rstPl").onclick = function () { p.planning.ov = {}; X.save(); X.renderPage(); };
    $("pdfGantt").onclick = function () { pdfGantt(false); };
  }

  /* =========================================================
     OPC
     ========================================================= */
  function engagementsHTML(dash) {
    var ps = S().projects.filter(function (p) { return p.statut === "chantier"; });
    var al = PL.alertes(S().projects, X.ST(), jour(), S().ent);
    var h = '<div class="card"><h2>Mes engagements</h2>';
    if (!ps.length) h += '<p class="hint">Aucun chantier en cours. Passez le statut d\'un projet à « Chantier en cours » (onglet Projets) pour activer le suivi des engagements et les alertes.</p>';
    else {
      h += '<table class="t"><tr><th class="l"></th><th class="l">Chantier</th><th>Livraison promise</th><th>Fin prévue</th><th>Marge</th><th>Avancement réel / prévu</th><th>Alertes</th></tr>';
      ps.forEach(function (p) {
        var r = F(p), m = p.info.dateLivraison ? PL.diff(r.F.fin, p.info.dateLivraison) : null, na = al.filter(function (a) { return a.pid === p.id; });
        h += '<tr class="click" data-openp="' + p.id + '"><td><i class="feu ' + feu(m) + '"></i></td><td class="l">' + esc(p.info.nom) + '<div class="small">' + esc(p.info.ville || p.info.region) + "</div></td><td>" + fr(p.info.dateLivraison) + "</td><td>" + fr(r.F.fin) + "</td><td>" + (m == null ? "—" : (m >= 0 ? "+" : "") + m + " j") + "</td><td>" + Math.round(r.F.avancement) + " % / " + Math.round(r.F.avancementPrevu) + " %</td><td>" +
          (na.filter(function (a) { return a.niv === "rouge"; }).length ? badge("rouge", na.filter(function (a) { return a.niv === "rouge"; }).length + " urgentes") + " " : "") + (na.filter(function (a) { return a.niv === "orange"; }).length ? badge("orange", na.filter(function (a) { return a.niv === "orange"; }).length + " à surveiller") : "") + "</td></tr>";
      });
      h += "</table>";
    }
    h += "</div>";
    if (ps.length) {
      var liste = dash ? al.slice(0, 8) : al;
      h += '<div class="card"><h2>À anticiper ' + (dash ? "(les plus urgentes)" : "(" + al.length + ")") + '</h2>' + (liste.length ? '<div class="alerts">' + liste.map(function (a) { return '<div class="al ' + a.niv + '"><b>' + esc(a.type) + "</b><span>" + esc(a.projet) + "</span><p>" + esc(a.msg) + "</p></div>"; }).join("") + "</div>" : '<p class="hint">Rien à signaler pour le moment.</p>') + (dash && al.length > 8 ? '<p><a href="#" data-go="opc">Voir les ' + al.length + " alertes dans OPC</a></p>" : "") + "</div>";
    }
    return h;
  }
  function pageOPC() {
    var h = '<div class="head"><h1>OPC et anticipation</h1><p>Ordonnancement, pilotage et coordination : engagements, alertes, avancement, planning glissant, comptes rendus et réserves.</p></div>';
    h += '<div class="bar-btn"><label>Date d\'analyse : <input type="date" id="jourA" value="' + jour() + '"></label><span class="hint">Par défaut aujourd\'hui. Changez-la pour simuler une autre date.</span></div>';
    h += (X.ui.sub.opc = X.ui.sub.opc || "eng", "") + X.tabs("opc", [["eng", "Engagements et alertes"], ["av", "Avancement"], ["glis", "Planning glissant (3 semaines)"], ["cr", "Comptes rendus"], ["res", "Réserves"], ["rec", "Réception (PV)"]]);
    var sub = X.ui.sub.opc || "eng";
    return h + ({ eng: function () { return engagementsHTML(false); }, av: opcAv, glis: opcGlis, cr: opcCR, res: opcRes, rec: function () { return window.TYP ? TYP.receptionHTML() : ""; } }[sub] || function () { return engagementsHTML(false); })();
  }
  function postOPC() {
    if (!X.ui.sub.opc) X.ui.sub.opc = "eng";
    X.bindTabs("opc");
    $("jourA").onchange = function () { X.ui.jour = this.value || null; X.renderPage(); };
    document.querySelectorAll("[data-openp]").forEach(function (r) { r.onclick = function () { S().active = r.dataset.openp; X.save(); X.renderTop(); X.ui.sub.opc = "av"; X.renderPage(); }; });
    X.linkGo();
    var sub = X.ui.sub.opc;
    if (sub === "av") postAv(); if (sub === "glis") postGlis(); if (sub === "cr") postCR(); if (sub === "res") postRes(); if (sub === "rec" && window.TYP) TYP.postReception();
    chargerVignettes();
  }
  function courbeS(r) {
    var T = r.F.taches; if (!T.length) return "";
    var cfg = r.F.cfg, d0 = r.F.base.debut, d1 = r.F.fin > r.F.refFin ? r.F.fin : r.F.refFin, nj = PL.diff(d0, d1) + 1, W = 760, H = 220, l = 40, b = 24;
    var Xd = function (s) { return l + (W - l - 10) * PL.diff(d0, s) / Math.max(1, nj); }, Y = function (v) { return H - b - (H - b - 10) * v / 100; };
    var pts = [], k, tot = r.F.montant || 1;
    for (k = 0; k <= 40; k++) { var dd = PL.addDays(d0, Math.round(nj * k / 40)); var v = T.reduce(function (s, t) { return s + t.montant * PL.pctPrevu({ debut: t.refDebut, fin: t.refFin }, dd, cfg); }, 0) / tot; pts.push(Xd(dd) + "," + Y(v)); }
    var raps = (P().suivi.rapports || []).map(function (x) { return x.date; }).sort(), reel = [];
    raps.filter(function (d, i) { return raps.indexOf(d) === i; }).forEach(function (d) { var av = PL.avancements(P(), d); var v = T.reduce(function (s, t) { return s + t.montant * ((av[t.id] || {}).pct || 0); }, 0) / tot; reel.push([d, v]); });
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" class="courbe">';
    [0, 25, 50, 75, 100].forEach(function (v) { s += '<line x1="' + l + '" x2="' + (W - 10) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="gl"/><text x="' + (l - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="ml">' + v + " %</text>"; });
    s += '<polyline points="' + pts.join(" ") + '" class="prevu"/>';
    if (reel.length) s += '<polyline points="' + reel.map(function (x) { return Xd(x[0]) + "," + Y(x[1]); }).join(" ") + '" class="reel"/>' + reel.map(function (x) { return '<circle cx="' + Xd(x[0]) + '" cy="' + Y(x[1]) + '" r="3" class="reelp"><title>' + fr(x[0]) + " : " + Math.round(x[1]) + " %</title></circle>"; }).join("");
    var tj = jour(); if (tj >= d0 && tj <= d1) s += '<line x1="' + Xd(tj) + '" x2="' + Xd(tj) + '" y1="10" y2="' + (H - b) + '" class="today"/>';
    s += '<text x="' + l + '" y="' + (H - 6) + '" class="ml">' + fr(d0) + '</text><text x="' + (W - 10) + '" y="' + (H - 6) + '" text-anchor="end" class="ml">' + fr(d1) + "</text></svg>";
    return s + '<div class="legend"><i class="lg prevu"></i>avancement prévu (référence) <i class="lg reel"></i>avancement réel (rapports terrain)</div>';
  }
  function opcAv() {
    var p = P(), r = F(p), T = r.F.taches, spi = r.F.valeurPrevue ? r.F.valeurAcquise / r.F.valeurPrevue : null;
    var dep = depensesReelles(p), dsAcq = T.reduce(function (s, t) { return s + t.ds * t.pct / 100; }, 0), cpi = dep > 0 ? dsAcq / dep : null;
    var h = '<div class="kpis">' + X.kpi("Avancement réel", Math.round(r.F.avancement) + " %", "prévu à cette date : " + Math.round(r.F.avancementPrevu) + " %") + X.kpi("Indice délai (SPI)", spi == null ? "—" : spi.toFixed(2), spi == null ? "" : spi >= 0.98 ? "dans les temps" : "en retard : " + Math.round((1 - spi) * 100) + " % du travail prévu non fait") +
      X.kpi("Indice coût (CPI)", cpi == null ? "—" : cpi.toFixed(2), cpi == null ? "saisir les dépenses (Facturation)" : cpi >= 1 ? "dépenses maîtrisées" : "dépenses supérieures au prévu") + X.kpi("Fin prévue", fr(r.F.fin), "référence : " + fr(r.F.refFin)) + "</div>";
    h += '<div class="bar-btn"><button class="btn p" id="pdfClient">Rapport d\'avancement pour le client (PDF)</button><button class="btn" id="pdfGantt2">Planning recalé (PDF)</button></div>';
    h += '<div class="card"><h2>Courbe en S</h2>' + courbeS(r) + "</div>";
    h += '<div class="card"><h2>Avancement par tâche</h2><table class="t edit"><tr><th class="l">Tâche</th><th>Prévu à date</th><th>Terrain</th><th>Validé OPC</th><th>Écart</th><th>Début</th><th>Fin prévue</th><th>Retard</th></tr>';
    T.forEach(function (t) {
      var a = (r.F.av[t.id] || {}), val = p.opc.avValide[t.id];
      h += '<tr class="' + (t.critique ? "critrow" : "") + '"><td class="l">' + esc(t.nom) + "</td><td>" + Math.round(t.pctPrevu) + " %</td><td>" + (a.pct != null ? Math.round(a.pct) + " %" : "—") + '</td><td><input type="number" min="0" max="100" data-val="' + t.id + '" value="' + (val ? val.pct : "") + '" placeholder="—"></td><td>' + (t.ecart > 15 ? badge(t.ecart > 30 ? "rouge" : "orange", "-" + Math.round(t.ecart) + " pts") : t.ecart < -5 ? badge("vert", "+" + Math.round(-t.ecart) + " pts") : "ok") + "</td><td>" + fr(t.pDebut) + "</td><td>" + fr(t.pFin) + "</td><td>" + (t.retard ? badge(t.critique ? "rouge" : "orange", t.retard + " j") : "—") + "</td></tr>";
    });
    return h + '</table><p class="hint">« Terrain » = dernier pourcentage remonté par vos collaborateurs. « Validé OPC » = votre propre constat (prioritaire). Il sert aussi aux situations de travaux.</p></div>';
  }
  function postAv() {
    var p = P();
    document.querySelectorAll("[data-val]").forEach(function (el) { el.onchange = function () { if (el.value === "") delete p.opc.avValide[el.dataset.val]; else p.opc.avValide[el.dataset.val] = { pct: Math.max(0, Math.min(100, +el.value)), date: jour() }; X.save(); X.renderPage(); }; });
    $("pdfClient").onclick = pdfClient; $("pdfGantt2").onclick = function () { pdfGantt(true); };
  }
  function opcGlis() {
    var p = P(), r = F(p), j = jour(), j21 = PL.addDays(j, 21);
    var T = r.F.taches.filter(function (t) { return t.pct < 100 && t.pDebut <= j21 && t.pFin >= j; });
    var h = '<div class="bar-btn"><button class="btn p" id="pdfGlis">PDF du planning glissant</button></div><div class="card"><h2>Du ' + fr(j) + " au " + fr(j21) + " : ce qui doit être prêt</h2>";
    if (!T.length) return h + '<p class="hint">Aucune tâche dans les 3 prochaines semaines.</p></div>';
    var CHK = [["mat", "Matériaux livrés ou commandés"], ["eq", "Équipe confirmée"], ["plans", "Plans et validations OK"], ["acces", "Accès, sécurité, eau, électricité"]];
    h += '<table class="t"><tr><th class="l">Tâche</th><th>Début</th><th>Fin</th><th>Équipe</th>' + CHK.map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + "</tr>";
    T.forEach(function (t) {
      var lk = p.opc.lookahead[t.id] || {}, ok = CHK.every(function (c) { return lk[c[0]]; });
      h += "<tr><td class='l'>" + esc(t.nom) + (t.critique ? " " + badge("rouge", "critique") : "") + (!ok && t.pDebut <= PL.addDays(j, 7) ? " " + badge("orange", "non prête") : "") + "</td><td>" + fr(t.pDebut) + "</td><td>" + fr(t.pFin) + "</td><td>" + (t.metier ? t.equipe + " " + LIBM[t.metier].toLowerCase() : "—") + "</td>" + CHK.map(function (c) { return '<td><input type="checkbox" data-lk="' + t.id + "|" + c[0] + '"' + (lk[c[0]] ? " checked" : "") + "></td>"; }).join("") + "</tr>";
    });
    h += "</table></div>";
    // commandes
    var cmd = [];
    r.F.taches.forEach(function (t) { if (t.pct === 0 && t.appro) t.appro.forEach(function (c) { cmd.push({ cle: t.id + "|" + c, cat: c, t: t, avant: PL.addDays(t.pDebut, -(PL.APPRO[c] || 7) - 2) }); }); });
    cmd.sort(function (a, b) { return a.avant < b.avant ? -1 : 1; });
    h += '<div class="card"><h2>Commandes à passer</h2><table class="t"><tr><th class="l">Fourniture</th><th class="l">Pour la tâche</th><th>Délai</th><th>Commander avant le</th><th>Commandé</th></tr>' + cmd.map(function (c) {
      var fait = p.opc.commandes[c.cle], k = PL.diff(j, c.avant);
      return "<tr><td class='l'>" + esc(c.cat) + "</td><td class='l small'>" + esc(c.t.nom) + "</td><td>" + (PL.APPRO[c.cat] || 7) + " j</td><td>" + fr(c.avant) + " " + (fait ? "" : k < 0 ? badge("rouge", "en retard") : k <= 10 ? badge("orange", "dans " + k + " j") : "") + '</td><td><input type="checkbox" data-cmd="' + c.cle + '"' + (fait ? " checked" : "") + "></td></tr>";
    }).join("") + "</table></div>";
    return h;
  }
  function postGlis() {
    var p = P();
    document.querySelectorAll("[data-lk]").forEach(function (el) { el.onchange = function () { var a = el.dataset.lk.split("|"); p.opc.lookahead[a[0]] = p.opc.lookahead[a[0]] || {}; p.opc.lookahead[a[0]][a[1]] = el.checked; X.save(); }; });
    document.querySelectorAll("[data-cmd]").forEach(function (el) { el.onchange = function () { if (el.checked) p.opc.commandes[el.dataset.cmd] = jour(); else delete p.opc.commandes[el.dataset.cmd]; X.save(); X.renderPage(); }; });
    var b = $("pdfGlis"); if (b) b.onclick = pdfGlissant;
  }
  // ---- Comptes rendus
  function opcCR() {
    var p = P(), crs = p.opc.crs;
    if (X.ui.cr == null && crs.length) X.ui.cr = crs.length - 1;
    var h = '<div class="bar-btn"><button class="btn p" id="newCR">+ Nouveau compte rendu</button>' + (crs.length ? '<select id="crSel">' + crs.map(function (c, i) { return '<option value="' + i + '"' + (i === X.ui.cr ? " selected" : "") + ">CR n° " + c.num + " du " + fr(c.date) + "</option>"; }).join("") + "</select>" : "") + "</div>";
    if (!crs.length || X.ui.cr == null || !crs[X.ui.cr]) return h + '<p class="hint">Le compte rendu reprend automatiquement l\'avancement, l\'effectif, la météo, les incidents et les photos des rapports terrain de la période. Vous complétez les observations et les décisions.</p>';
    var c = crs[X.ui.cr], base = "opc.crs." + X.ui.cr;
    h += '<div class="card"><h2>Compte rendu n° ' + c.num + '</h2><div class="form">' + fld("Date de la réunion", base + ".date", { date: true }) + fld("Période du", base + ".du", { date: true }) + fld("Présents", base + ".presents", { text: true }) + "</div>" +
      '<label class="f wide"><span>Observations générales</span>' + inp(base + ".obs", { area: true, rows: 4 }) + "</label>" +
      '<h2 style="margin-top:14px">Décisions et actions</h2><table class="t edit"><tr><th class="l">Action</th><th class="l">Responsable</th><th>Pour le</th><th>Faite</th><th></th></tr>' +
      (c.actions || []).map(function (a, i) { return '<tr><td class="l">' + inp(base + ".actions." + i + ".a", { text: true }) + '</td><td class="l">' + inp(base + ".actions." + i + ".qui", { text: true }) + "</td><td>" + inp(base + ".actions." + i + ".pour", { date: true }) + "</td><td>" + inp(base + ".actions." + i + ".ok", { check: true }) + '</td><td><button class="x" data-adel="' + i + '">✕</button></td></tr>'; }).join("") +
      '</table><button class="btn sm" id="addAct">+ Ajouter une action</button><div class="bar-btn" style="margin-top:12px"><button class="btn p" id="pdfCR">Générer le PDF du compte rendu</button><button class="btn danger" id="delCR">Supprimer ce compte rendu</button></div></div>';
    var ctx = contexteCR(p, c);
    h += '<div class="card"><h2>Repris automatiquement des rapports terrain (' + ctx.raps.length + " rapport(s) du " + fr(c.du) + " au " + fr(c.date) + ")</h2>" +
      "<p>Effectif moyen : <b>" + fmt(ctx.effMoy, 1) + "</b> personnes · Météo : " + esc(ctx.meteo || "—") + "</p>" + (ctx.incidents.length ? "<p><b>Incidents :</b> " + ctx.incidents.map(esc).join(" · ") + "</p>" : "") + vignettes(ctx.photos.slice(0, 12)) + "</div>";
    return h;
  }
  function contexteCR(p, c) {
    var raps = p.suivi.rapports.filter(function (r) { return r.date >= (c.du || "0000") && r.date <= c.date; });
    var eff = raps.map(function (r) { return Object.keys(r.eff || {}).reduce(function (s, k) { return s + (+r.eff[k] || 0); }, 0); });
    var met = {}; raps.forEach(function (r) { if (r.meteo) met[r.meteo] = (met[r.meteo] || 0) + 1; });
    var photos = []; raps.forEach(function (r) { photos = photos.concat(r.photos || []); Object.keys(r.pa || {}).forEach(function (k) { photos = photos.concat(r.pa[k] || []); }); });
    return { raps: raps, effMoy: eff.length ? eff.reduce(function (a, b) { return a + b; }, 0) / eff.length : 0, meteo: Object.keys(met).map(function (k) { return k + " (" + met[k] + " j)"; }).join(", "), incidents: raps.filter(function (r) { return r.incidents; }).map(function (r) { return fr(r.date) + " : " + r.incidents; }), photos: photos };
  }
  function postCR() {
    var p = P();
    $("newCR").onclick = function () {
      var prev = p.opc.crs[p.opc.crs.length - 1], r = F(p), j = jour();
      var actionsOuvertes = prev ? (prev.actions || []).filter(function (a) { return !a.ok; }).map(function (a) { return Object.assign({}, a); }) : [];
      p.opc.crs.push({ num: p.opc.crs.length + 1, date: j, du: prev ? prev.date : r.F.cfg.debut, presents: "", obs: "", actions: actionsOuvertes });
      X.ui.cr = p.opc.crs.length - 1; X.save(); X.renderPage();
    };
    var sel = $("crSel"); if (sel) sel.onchange = function () { X.ui.cr = +this.value; X.renderPage(); };
    var aa = $("addAct"); if (aa) aa.onclick = function () { p.opc.crs[X.ui.cr].actions.push({ a: "", qui: "", pour: PL.addDays(jour(), 7), ok: false }); X.save(); X.renderPage(); };
    document.querySelectorAll("[data-adel]").forEach(function (b) { b.onclick = function () { p.opc.crs[X.ui.cr].actions.splice(+b.dataset.adel, 1); X.save(); X.renderPage(); }; });
    var pc = $("pdfCR"); if (pc) pc.onclick = function () { pdfCR(p.opc.crs[X.ui.cr]); };
    var dc = $("delCR"); if (dc) dc.onclick = function () { if (dc.dataset.c !== "1") { dc.dataset.c = "1"; dc.textContent = "Confirmer la suppression"; return; } p.opc.crs.splice(X.ui.cr, 1); X.ui.cr = p.opc.crs.length ? p.opc.crs.length - 1 : null; X.save(); X.renderPage(); };
  }
  // ---- Réserves
  function opcRes() {
    var p = P(), R = p.opc.reserves, ouv = R.filter(function (r) { return !r.levee; }).length;
    var h = '<div class="bar-btn"><button class="btn p" id="addRes">+ Nouvelle réserve</button><button class="btn" id="pdfRes">PDF de la liste des réserves</button><span class="hint">' + ouv + " ouverte(s) sur " + R.length + "</span></div>";
    h += '<div class="card"><table class="t edit"><tr><th class="l">N°</th><th class="l">Lot / localisation</th><th class="l">Description</th><th class="l">Responsable</th><th>Échéance</th><th>Photo</th><th>Levée le</th><th></th></tr>';
    R.forEach(function (r, i) {
      var b = "opc.reserves." + i, late = !r.levee && r.ech && r.ech < jour();
      h += '<tr class="' + (r.levee ? "done" : "") + '"><td class="l">' + (i + 1) + '</td><td class="l">' + inp(b + ".loc", { text: true }) + '</td><td class="l">' + inp(b + ".desc", { text: true }) + '</td><td class="l">' + inp(b + ".resp", { text: true }) + "</td><td>" + inp(b + ".ech", { date: true }) + (late ? badge("rouge", "dépassée") : "") + "</td><td>" + vignettes(r.photos, "mini") + '<label class="btn sm">+<input type="file" accept="image/*" capture="environment" data-rph="' + i + '" hidden></label></td><td>' + inp(b + ".levee", { date: true }) + '</td><td><button class="x" data-rdel="' + i + '">✕</button></td></tr>';
    });
    return h + "</table></div>";
  }
  function postRes() {
    var p = P();
    $("addRes").onclick = function () { p.opc.reserves.push({ loc: "", desc: "", resp: "", ech: PL.addDays(jour(), 15), levee: "", photos: [], date: jour() }); X.save(); X.renderPage(); };
    $("pdfRes").onclick = pdfReserves;
    document.querySelectorAll("[data-rdel]").forEach(function (b) { b.onclick = function () { p.opc.reserves.splice(+b.dataset.rdel, 1); X.save(); X.renderPage(); }; });
    document.querySelectorAll("[data-rph]").forEach(function (el) { el.onchange = function () { var f = el.files[0]; if (!f) return; lireImage(f).then(function (d) { var id = uid("ph"); X.photoPut(id, d).then(function () { p.opc.reserves[+el.dataset.rph].photos.push(id); X.save(); X.renderPage(); }); }); }; });
  }

  /* =========================================================
     SUIVI TERRAIN
     ========================================================= */
  var METEO = ["Ensoleillé", "Nuageux", "Pluie", "Orage", "Vent / poussière", "Chaleur forte"];
  var MATS = [["CIM", "Ciment (sacs)"], ["HA6", "Fer HA6 (kg)"], ["HA8", "Fer HA8 (kg)"], ["HA10", "Fer HA10 (kg)"], ["HA12", "Fer HA12 (kg)"], ["HA14", "Fer HA14 (kg)"], ["SAB", "Sable (m³)"], ["GRA", "Gravier (m³)"], ["AG15", "Agglos de 15 (u)"], ["AG10", "Agglos de 10 (u)"], ["AG20", "Agglos de 20 (u)"], ["HOU16", "Hourdis (u)"]];
  function brouillon(p) {
    var s = S(); s.terrain.brouillons = s.terrain.brouillons || {};
    var b = s.terrain.brouillons[p.id];
    if (!b) b = s.terrain.brouillons[p.id] = { id: uid("r"), date: today(), meteo: "Ensoleillé", eff: {}, av: {}, mat: {}, dep: [], photos: [], pa: {}, incidents: "", livraisons: "", note: "" };
    return b;
  }
  function pageTerrain() {
    var h = '<div class="head"><h1>Suivi terrain</h1><p>Vos collaborateurs remplissent ici le rapport de chantier, sur téléphone, même sans réseau, puis l\'envoient au bureau par WhatsApp. Au bureau, vous importez les rapports et tout se met à jour : avancement, alertes, consommations, comptes rendus.</p></div>';
    h += (X.ui.sub.terrain = X.ui.sub.terrain || "rap", "") + X.tabs("terrain", [["rap", "Nouveau rapport"], ["hist", "Rapports reçus"], ["ech", "Échanges bureau ↔ chantier"]]);
    var sub = X.ui.sub.terrain || "rap";
    return h + ({ rap: terRapport, hist: terHist, ech: terEch }[sub] || terRapport)();
  }
  function terRapport() {
    var p = P(), b = brouillon(p), r = F(p), dt = b.date;
    var T = r.F.taches.filter(function (t) { return t.pct < 100 && t.pDebut <= PL.addDays(dt, 14); });
    var col = S().collab || [];
    var h = '<div class="card"><h2>Rapport de chantier : ' + esc(p.info.nom) + '</h2><div class="form">' +
      '<label class="f"><span>Rédigé par</span><select id="moi"><option value="">— choisir —</option>' + col.map(function (c) { return "<option" + (S().terrain.moi === c.nom ? " selected" : "") + ">" + esc(c.nom) + "</option>"; }).join("") + "<option" + (S().terrain.moi === S().ent.responsable ? " selected" : "") + ">" + esc(S().ent.responsable || "Bureau") + "</option></select></label>" +
      '<label class="f"><span>Date</span><input type="date" data-br="date" value="' + esc(b.date) + '"></label><label class="f"><span>Météo</span><select data-br="meteo">' + METEO.map(function (m) { return "<option" + (b.meteo === m ? " selected" : "") + ">" + m + "</option>"; }).join("") + "</select></label></div></div>";
    h += '<div class="card"><h2>Effectif présent</h2><div class="form compact">' + Object.keys(LIBM).map(function (k) { return '<label class="f"><span>' + LIBM[k] + '</span><input type="number" min="0" data-br="eff.' + k + '" value="' + (b.eff[k] || "") + '"></label>'; }).join("") + "</div></div>";
    h += '<div class="card"><h2>Avancement des tâches (% cumulé réalisé)</h2>' + (T.length ? T.map(function (t) {
      var cur = b.av[t.id] != null ? b.av[t.id] : Math.round(t.pct);
      return '<div class="avrow"><div><b>' + esc(t.nom) + '</b><span class="small"> prévu ' + fr(t.pDebut) + " → " + fr(t.pFin) + "</span></div>" +
        '<input type="range" min="0" max="100" step="5" data-avr="' + t.id + '" value="' + cur + '"><output id="o-' + t.id + '">' + cur + " %</output>" +
        (t.pa ? '<div class="pa-box">◆ Point d\'arrêt : <b>' + esc(t.pa) + '</b> ' + vignettes(b.pa[t.id], "mini") + '<label class="btn sm">Photo de contrôle<input type="file" accept="image/*" capture="environment" data-paph="' + t.id + '" hidden></label></div>' : "") + "</div>";
    }).join("") : '<p class="hint">Aucune tâche prévue dans les 15 prochains jours. Vérifiez le planning.</p>') + "</div>";
    h += '<div class="card"><h2>Matériaux consommés aujourd\'hui</h2><div class="form compact">' + MATS.map(function (m) { return '<label class="f"><span>' + m[1] + '</span><input type="number" min="0" step="any" data-br="mat.' + m[0] + '" value="' + (b.mat[m[0]] || "") + '"></label>'; }).join("") + "</div></div>";
    h += '<div class="card"><h2>Dépenses de caisse</h2><table class="t edit"><tr><th class="l">Libellé</th><th>Montant (FCFA)</th><th class="l">Paiement</th><th>Reçu</th><th></th></tr>' + b.dep.map(function (d, i) {
      return '<tr><td class="l"><input type="text" data-dep="' + i + '|lib" value="' + esc(d.lib) + '"></td><td><input type="number" data-dep="' + i + '|mt" value="' + (d.mt || "") + '"><br><select data-dep="' + i + '|lot" style="max-width:150px;margin-top:3px">' + '<option value="">— lot —</option>' + DATA.LOTS.map(function (L) { return '<option value="' + L[0] + '"' + (d.lot === L[0] ? " selected" : "") + ">" + esc(L[1]) + "</option>"; }).join("") + '</select></td><td class="l"><select data-dep="' + i + '|mode">' + ["Espèces", "Wave", "Orange Money", "Virement"].map(function (m) { return "<option" + (d.mode === m ? " selected" : "") + ">" + m + "</option>"; }).join("") + "</select></td><td>" + vignettes(d.photo ? [d.photo] : [], "mini") + '<label class="btn sm">📷<input type="file" accept="image/*" capture="environment" data-depph="' + i + '" hidden></label></td><td><button class="x" data-depdel="' + i + '">✕</button></td></tr>';
    }).join("") + '</table><button class="btn sm" id="addDep">+ Ajouter une dépense</button></div>';
    h += '<div class="card"><h2>Journal</h2><label class="f wide"><span>Livraisons reçues</span><textarea data-br="livraisons" rows="2">' + esc(b.livraisons) + '</textarea></label><label class="f wide"><span>Incidents, problèmes, besoins</span><textarea data-br="incidents" rows="2">' + esc(b.incidents) + '</textarea></label><label class="f wide"><span>Remarques</span><textarea data-br="note" rows="2">' + esc(b.note) + "</textarea></label>" +
      '<h2 style="margin-top:12px">Photos du jour</h2>' + vignettes(b.photos, "mini") + '<label class="btn">📷 Ajouter des photos<input type="file" accept="image/*" multiple data-gph="1" hidden></label></div>';
    h += '<div class="bar-btn sticky"><button class="btn p" id="saveRap">Enregistrer le rapport</button><button class="btn" id="sendRap">Enregistrer et envoyer au bureau (WhatsApp)</button><button class="btn danger" id="clrRap">Effacer le brouillon</button></div>';
    return h;
  }
  function postRapport() {
    var p = P(), b = brouillon(p);
    function setPath(o, path, v) { var ks = path.split("."), last = ks.pop(); ks.forEach(function (k) { o = o[k] = o[k] || {}; }); o[last] = v; }
    document.querySelectorAll("[data-br]").forEach(function (el) { el.onchange = function () { setPath(b, el.dataset.br, el.type === "number" ? (el.value === "" ? 0 : +el.value) : el.value); X.save(); if (el.dataset.br === "date") X.renderPage(); }; });
    $("moi").onchange = function () { S().terrain.moi = this.value; X.save(); };
    document.querySelectorAll("[data-avr]").forEach(function (el) { el.oninput = function () { $("o-" + el.dataset.avr).textContent = el.value + " %"; }; el.onchange = function () { b.av[el.dataset.avr] = +el.value; X.save(); }; });
    document.querySelectorAll("[data-dep]").forEach(function (el) { el.onchange = function () { var a = el.dataset.dep.split("|"); b.dep[+a[0]][a[1]] = a[1] === "mt" ? +el.value : el.value; X.save(); }; });
    document.querySelectorAll("[data-depdel]").forEach(function (el) { el.onclick = function () { b.dep.splice(+el.dataset.depdel, 1); X.save(); X.renderPage(); }; });
    $("addDep").onclick = function () { b.dep.push({ lib: "", mt: 0, mode: "Espèces", photo: null }); X.save(); X.renderPage(); };
    function photos(files, cb) { var ids = []; return Array.prototype.slice.call(files).reduce(function (pr, f) { return pr.then(function () { return lireImage(f).then(function (d) { if (!d) return; var id = uid("ph"); ids.push(id); return X.photoPut(id, d); }); }); }, Promise.resolve()).then(function () { cb(ids); X.save(); X.renderPage(); }); }
    document.querySelectorAll("[data-paph]").forEach(function (el) { el.onchange = function () { photos(el.files, function (ids) { b.pa[el.dataset.paph] = (b.pa[el.dataset.paph] || []).concat(ids); }); }; });
    document.querySelectorAll("[data-depph]").forEach(function (el) { el.onchange = function () { photos(el.files, function (ids) { b.dep[+el.dataset.depph].photo = ids[0]; }); }; });
    document.querySelectorAll("[data-gph]").forEach(function (el) { el.onchange = function () { photos(el.files, function (ids) { b.photos = b.photos.concat(ids); }); }; });
    function enregistrer() {
      var rap = JSON.parse(JSON.stringify(b)); rap.auteur = S().terrain.moi || ""; rap.enregistre = new Date().toISOString();
      p.suivi.rapports = p.suivi.rapports.filter(function (r) { return r.id !== rap.id; }); p.suivi.rapports.push(rap);
      delete S().terrain.brouillons[p.id]; X.save(); return rap;
    }
    $("saveRap").onclick = function () { enregistrer(); X.toast("Rapport enregistré"); X.ui.sub.terrain = "hist"; X.renderPage(); };
    $("sendRap").onclick = function () { var rap = enregistrer(); envoyerRapport(p, rap); X.ui.sub.terrain = "hist"; X.renderPage(); };
    $("clrRap").onclick = function () { var c = $("clrRap"); if (c.dataset.c !== "1") { c.dataset.c = "1"; c.textContent = "Confirmer"; return; } delete S().terrain.brouillons[p.id]; X.save(); X.renderPage(); };
  }
  function idsPhotosRapport(r) { var ids = (r.photos || []).slice(); Object.keys(r.pa || {}).forEach(function (k) { ids = ids.concat(r.pa[k]); }); (r.dep || []).forEach(function (d) { if (d.photo) ids.push(d.photo); }); return ids; }
  function envoyerRapport(p, rap) {
    var ids = idsPhotosRapport(rap), photos = {};
    Promise.all(ids.map(function (id) { return X.photoGet(id).then(function (d) { if (d) photos[id] = d; }); })).then(function () {
      partager({ type: "rapport", pid: p.id, projet: p.info.nom, rapport: rap, photos: photos }, "rapport_" + X.slug(p.info.nom) + "_" + rap.date + ".json", "Rapport de chantier " + p.info.nom + " du " + fr(rap.date));
    });
  }
  function terHist() {
    var p = P(), R = p.suivi.rapports.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var h = '<div class="bar-btn"><label class="btn p">Importer des rapports reçus (.json)<input type="file" id="impRap" accept=".json,application/json" multiple hidden></label><span class="hint">' + R.length + " rapport(s) pour ce projet</span></div>";
    var tot = R.reduce(function (s, r) { return s + (r.dep || []).reduce(function (a, d) { return a + (+d.mt || 0); }, 0); }, 0);
    h += '<div class="kpis">' + X.kpi("Dépenses de caisse déclarées", fmt(tot) + " FCFA", "toutes dates") + X.kpi("Ciment déclaré", fmt(PL.consommations(p).CIM || 0) + " sacs", "cumul des rapports") + "</div>";
    R.forEach(function (r) {
      var eff = Object.keys(r.eff || {}).reduce(function (s, k) { return s + (+r.eff[k] || 0); }, 0), dep = (r.dep || []).reduce(function (a, d) { return a + (+d.mt || 0); }, 0);
      h += '<div class="card rap"><div class="raph"><b>' + fr(r.date) + "</b> · " + esc(r.auteur || "—") + " · " + esc(r.meteo || "") + " · " + eff + " personnes" + (dep ? " · dépenses " + fmt(dep) + " FCFA" : "") + '<button class="x" data-rapdel="' + r.id + '" title="Supprimer">✕</button><button class="btn sm" data-rapsend="' + r.id + '">Renvoyer</button></div>' +
        '<div class="small">Avancement : ' + Object.keys(r.av || {}).map(function (k) { var t = F(p).F.taches.filter(function (x) { return x.id === k; })[0]; return esc(t ? t.nom : k) + " " + r.av[k] + " %"; }).join(" · ") + "</div>" +
        (Object.keys(r.mat || {}).filter(function (k) { return r.mat[k]; }).length ? '<div class="small">Matériaux : ' + Object.keys(r.mat).filter(function (k) { return r.mat[k]; }).map(function (k) { var m = MATS.filter(function (x) { return x[0] === k; })[0]; return (m ? m[1] : k) + " " + r.mat[k]; }).join(" · ") + "</div>" : "") +
        (r.incidents ? '<div class="small"><b>Incidents :</b> ' + esc(r.incidents) + "</div>" : "") + (r.livraisons ? '<div class="small"><b>Livraisons :</b> ' + esc(r.livraisons) + "</div>" : "") + vignettes(idsPhotosRapport(r), "mini") + "</div>";
    });
    return h;
  }
  function postHist() {
    var p = P();
    $("impRap").onchange = function () { importerFichiers(this.files); };
    document.querySelectorAll("[data-rapdel]").forEach(function (b) { b.onclick = function () { if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Supprimer ?"; return; } p.suivi.rapports = p.suivi.rapports.filter(function (r) { return r.id !== b.dataset.rapdel; }); X.save(); X.renderPage(); }; });
    document.querySelectorAll("[data-rapsend]").forEach(function (b) { b.onclick = function () { var r = p.suivi.rapports.filter(function (x) { return x.id === b.dataset.rapsend; })[0]; if (r) envoyerRapport(p, r); }; });
  }
  function terEch() {
    var p = P();
    return '<div class="grid2"><div class="card"><h2>Au bureau : envoyer le chantier à un collaborateur</h2><p>Le collaborateur reçoit le projet (planning, tâches, points d\'arrêt) et peut faire ses rapports hors connexion.</p><button class="btn p" id="sendProj">Envoyer « ' + esc(p.info.nom) + ' » (WhatsApp)</button></div>' +
      '<div class="card"><h2>Recevoir un fichier</h2><p>Projet envoyé par le bureau, rapports envoyés par le chantier ou sauvegarde complète : l\'application reconnaît le type de fichier.</p><label class="btn p">Importer un fichier reçu (.json)<input type="file" id="impAny" accept=".json,application/json" multiple hidden></label></div></div>' +
      '<div class="card"><h2>Comment ça marche</h2><ol class="small"><li>Au bureau : « Envoyer le chantier » → choisissez le collaborateur dans WhatsApp.</li><li>Sur le téléphone du collaborateur : ouvrez l\'application, onglet Suivi terrain → Échanges → « Importer un fichier reçu ».</li><li>Le collaborateur remplit son rapport, même sans réseau, puis « Enregistrer et envoyer au bureau ».</li><li>Au bureau : Suivi terrain → Rapports reçus → « Importer des rapports reçus ». L\'avancement, les alertes et les comptes rendus se mettent à jour.</li></ol></div>';
  }
  function postEch() {
    var p = P();
    $("sendProj").onclick = function () { var cp = JSON.parse(JSON.stringify(p)); partager({ type: "projet", projet: cp, collab: S().collab, ent: { nom: S().ent.nom } }, "chantier_" + X.slug(p.info.nom) + ".json", "Chantier " + p.info.nom); };
    $("impAny").onchange = function () { importerFichiers(this.files); };
  }
  function postTerrain() {
    if (!X.ui.sub.terrain) X.ui.sub.terrain = "rap";
    X.bindTabs("terrain");
    var s = X.ui.sub.terrain; if (s === "rap") postRapport(); if (s === "hist") postHist(); if (s === "ech") postEch();
    chargerVignettes();
  }

  /* =========================================================
     FACTURATION & TRÉSORERIE
     ========================================================= */
  function marche(p) { return p.factu.marche; }
  function figerMarche(p) {
    var q = Cc.dqe(p, X.ST());
    p.factu.marche = { date: jour(), ht: q.ht, tva: q.tva, ttc: q.ttc, lignes: q.lignes.map(function (l) { var L = q.lots.filter(function (x) { return x.code === l.lot; })[0]; return { id: l.id, num: l.num, d: l.d, u: l.u, q: l.q, pu: l.pu, m: l.m, lot: l.lot, lotNom: L ? "Lot " + L.num + " – " + L.nom : "" }; }) };
  }
  function numFacture() { var e = S().ent; e.factuSeq = (+e.factuSeq || 0) + 1; return "F-" + new Date().getFullYear() + "-" + String(e.factuSeq).padStart(3, "0"); }
  function acompteHT(p) { return p.factu.docs.filter(function (d) { return d.type === "acompte"; }).reduce(function (s, d) { return s + d.ht; }, 0); }
  function derniereSituation(p) { var s = p.factu.docs.filter(function (d) { return d.type === "situation"; }); return s[s.length - 1] || null; }
  function paye(d) { return (d.paiements || []).reduce(function (s, x) { return s + (+x.mt || 0); }, 0); }
  function aPayer(d) { return d.type === "situation" ? d.net : d.ttc; }
  function depensesReelles(p) {
    var caisse = p.suivi.rapports.reduce(function (s, r) { return s + (r.dep || []).reduce(function (a, d) { return a + (+d.mt || 0); }, 0); }, 0);
    return caisse + p.factu.achats.reduce(function (s, a) { return s + (+a.mt || 0); }, 0);
  }
  function pageFactu() {
    var h = '<div class="head"><h1>Facturation et trésorerie</h1><p>Facture d\'acompte, situations de travaux cumulées (avec remboursement de l\'acompte et retenue de garantie), décompte final, encaissements, dépenses et trésorerie prévisionnelle.</p></div>';
    h += (X.ui.sub.factu = X.ui.sub.factu || "docs", "") + X.tabs("factu", [["docs", "Factures"], ["sit", "Nouvelle situation"], ["dep", "Dépenses du chantier"], ["treso", "Trésorerie prévisionnelle"]]);
    var sub = X.ui.sub.factu || "docs";
    return h + ({ docs: facDocs, sit: facSit, dep: facDep, treso: facTreso }[sub] || facDocs)();
  }
  function facDocs() {
    var p = P(), m = marche(p), e = S().ent;
    var h = "";
    if (!m) return h + '<div class="card"><h2>Marché</h2><p>Avant de facturer, figez le marché : le DQE actuel devient la base de facturation (les modifications ultérieures du DQE ne changeront pas les factures).</p><button class="btn p" id="figM">Figer le marché (DQE actuel : ' + fmt(Cc.dqe(p, X.ST()).ttc) + " FCFA TTC)</button></div>";
    var docs = p.factu.docs, fact = docs.reduce(function (s, d) { return s + aPayer(d); }, 0), enc = docs.reduce(function (s, d) { return s + paye(d); }, 0);
    var echus = docs.filter(function (d) { return aPayer(d) - paye(d) > 1 && PL.addDays(d.date, +e.delaiPaiement || 30) < jour(); });
    h += '<div class="kpis">' + X.kpi("Marché HT", fmt(m.ht), "figé le " + fr(m.date) + " · TTC " + fmt(m.ttc)) + X.kpi("Facturé (à payer)", fmt(fact), "FCFA") + X.kpi("Encaissé", fmt(enc), "FCFA") + X.kpi("Reste à encaisser", fmt(fact - enc), echus.length ? echus.length + " facture(s) en retard de paiement" : "aucun retard") + "</div>";
    h += '<div class="bar-btn"><button class="btn p" id="newAc">+ Facture d\'acompte (' + e.acompte + ' %)</button><button class="btn p" id="goSit">+ Situation de travaux</button><button class="btn" id="newRG">+ Facture de libération de la retenue de garantie</button><button class="btn" id="refigM">Mettre à jour le marché</button></div>';
    h += '<div class="card"><table class="t"><tr><th class="l">N°</th><th class="l">Type</th><th>Date</th><th>Montant à payer</th><th>Encaissé</th><th>Reste</th><th class="l">Encaisser</th><th></th></tr>';
    docs.forEach(function (d, i) {
      var reste = aPayer(d) - paye(d), retard = reste > 1 && PL.addDays(d.date, +e.delaiPaiement || 30) < jour();
      h += '<tr><td class="l"><b>' + esc(d.num) + '</b></td><td class="l">' + esc(libType(d)) + "</td><td>" + fr(d.date) + "</td><td>" + fmt(aPayer(d)) + "</td><td>" + fmt(paye(d)) + "</td><td>" + (reste > 1 ? fmt(reste) + (retard ? " " + badge("rouge", "échue") : "") : badge("vert", "soldée")) + '</td><td class="l"><input type="number" placeholder="montant" data-pay="' + i + '" style="width:110px"> <select data-paym="' + i + '">' + ["Virement", "Wave", "Orange Money", "Espèces", "Chèque"].map(function (x) { return "<option>" + x + "</option>"; }).join("") + '</select> <button class="btn sm" data-payok="' + i + '">OK</button></td><td><button class="btn sm" data-dpdf="' + i + '">PDF</button> <button class="btn sm" data-dwa="' + i + '">WhatsApp</button>' + (retard ? ' <button class="btn sm p" data-drel="' + i + '">Relancer</button>' : "") + ' <button class="x" data-ddel="' + i + '">✕</button></td></tr>';
    });
    return h + "</table></div>";
  }
  function libType(d) { return d.type === "acompte" ? "Facture d'acompte" : d.type === "rg" ? "Libération de la retenue de garantie" : (d.dgd ? "Décompte final (situation n° " + d.sitNum + ")" : "Situation de travaux n° " + d.sitNum); }
  function facSit() {
    var p = P(), m = marche(p);
    if (!m) return '<div class="card"><p>Figez d\'abord le marché dans l\'onglet Factures.</p></div>';
    var prec = derniereSituation(p), r = F(p), lt = r.F.base.ligneTache, av = {};
    r.F.taches.forEach(function (t) { av[t.id] = t.pct; });
    X.ui.sitPct = X.ui.sitPct || {};
    m.lignes.forEach(function (l) {
      if (X.ui.sitPct[l.id] != null) return;
      var parts = lt[l.id] || [], pc = parts.length ? parts.reduce(function (s, x) { return s + (av[x[0]] || 0) * x[1]; }, 0) / parts.reduce(function (s, x) { return s + x[1]; }, 0) : (l.id === "F-inst" ? (av.INST || 0) : 0);
      X.ui.sitPct[l.id] = Math.max(prec ? +prec.pcts[l.id] || 0 : 0, Math.round(pc));
    });
    var s = PL.situation(m, X.ui.sitPct, prec, S().ent, acompteHT(p));
    var h = '<div class="note">Pourcentages proposés à partir de l\'avancement validé (OPC) et des rapports terrain. Vous pouvez les corriger ligne par ligne. Un pourcentage ne peut pas descendre sous celui de la situation précédente.</div>';
    h += '<div class="card"><table class="t edit"><tr><th class="l">N°</th><th class="l">Désignation</th><th>Montant marché</th><th>% précédent</th><th>% cumulé</th><th>Cumul HT</th><th>Période HT</th></tr>';
    var lot = null;
    s.lignes.forEach(function (l) {
      if (l.lotNom !== lot) { lot = l.lotNom; h += '<tr class="grp"><td colspan="7" class="l">' + esc(lot) + "</td></tr>"; }
      h += '<tr><td class="l">' + l.num + '</td><td class="l small">' + esc(l.d) + "</td><td>" + fmt(l.m) + "</td><td>" + (prec ? (+prec.pcts[l.id] || 0) + " %" : "—") + '</td><td><input type="number" min="0" max="100" data-sp="' + l.id + '" value="' + l.pct + '"></td><td>' + fmt(l.cumul) + "</td><td>" + fmt(l.periode) + "</td></tr>";
    });
    h += '</table><div class="calc">' + [["Travaux cumulés HT (" + fmt(s.tauxAvancement, 1) + " % du marché)", s.cumulHT], ["À déduire : situations précédentes HT", -s.precedentHT], ["Montant de la période HT", s.periodeHT], ["Remboursement de l'acompte", -s.rembAcompte], ["Base HT", s.baseHT], ["TVA " + S().ent.tva + " %", s.tva], ["Total TTC", s.ttc], ["Retenue de garantie " + S().ent.retenue + " %", -s.retenue], ["NET À PAYER", s.net]].map(function (x, i) { return '<div class="' + (i === 8 ? "big" : "") + '"><span>' + esc(x[0]) + "</span><b>" + fmt(x[1]) + "</b></div>"; }).join("") + "</div>";
    h += '<div class="bar-btn" style="margin-top:12px"><button class="btn p" id="saveSit">Émettre la situation n° ' + (p.factu.docs.filter(function (d) { return d.type === "situation"; }).length + 1) + '</button><button class="btn" id="rstSit">Recalculer depuis l\'avancement</button></div></div>';
    return h;
  }
  function facDep() {
    var p = P(), A = p.factu.achats, r = F(p), dsAcq = r.F.taches.reduce(function (s, t) { return s + t.ds * t.pct / 100; }, 0), dep = depensesReelles(p);
    var caisse = dep - A.reduce(function (s, a) { return s + (+a.mt || 0); }, 0);
    var h = '<div class="kpis">' + X.kpi("Dépenses réelles", fmt(dep), "achats " + fmt(dep - caisse) + " + caisse chantier " + fmt(caisse)) + X.kpi("Déboursé prévu à cet avancement", fmt(dsAcq), "FCFA") + X.kpi("Écart", fmt(dep - dsAcq), dep > dsAcq * 1.05 ? "⚠ dépenses supérieures au prévu" : "dans le budget") + "</div>";
    var EL = PL.ecartsLots(p, r.q, r.F), nonAff = dep - EL.reduce(function (s, x) { return s + x.reel; }, 0);
    h += '<div class="card"><h2>Marge réelle par lot</h2><table class="t"><tr><th class="l">Lot</th><th>Budget (déboursé)</th><th>Prévu à l\'avancement</th><th>Dépensé</th><th>Écart</th></tr>' + EL.map(function (x) { var e = x.reel - x.prevu, niv = x.reel > 100000 && x.reel > x.prevu * 1.25 ? "rouge" : x.reel > 100000 && x.reel > x.prevu * 1.1 ? "orange" : null; return '<tr><td class="l">' + esc(x.nom) + "</td><td>" + fmt(x.budget) + "</td><td>" + fmt(x.prevu) + "</td><td>" + fmt(x.reel) + "</td><td>" + (x.reel ? fmt(e) + (niv ? " " + badge(niv, "dérive") : "") : "—") + "</td></tr>"; }).join("") + '<tr><td class="l"><i>Dépenses non affectées à un lot</i></td><td></td><td></td><td>' + fmt(nonAff) + '</td><td></td></tr></table><p class="hint">Affectez chaque achat à un lot : l\'application compare alors les dépenses au déboursé prévu à l\'avancement réel, et vous alerte dès qu\'un lot dérape de plus de 10 %.</p></div>';
    var mats = S().res.filter(function (x) { return x[4] === "MAT"; });
    h += '<div class="card"><h2>Achats et paiements fournisseurs / tâcherons</h2><div style="overflow-x:auto"><table class="t edit"><tr><th>Date</th><th class="l">Fournisseur / tâcheron</th><th class="l">Libellé</th><th class="l">Lot</th><th class="l">Matériau (facultatif)</th><th>Quantité</th><th>Montant (FCFA)</th><th>Prix unitaire</th><th>Délai livr. (j)</th><th></th></tr>' + A.map(function (a, i) {
      var b = "factu.achats." + i, res = mats.filter(function (x) { return x[0] === a.res; })[0];
      return "<tr><td>" + inp(b + ".date", { date: true }) + '</td><td class="l">' + inp(b + ".four", { text: true }) + '</td><td class="l">' + inp(b + ".lib", { text: true }) + '</td><td class="l"><select data-b="' + b + '.lot" style="max-width:150px">' + '<option value="">— lot —</option>' + DATA.LOTS.map(function (L) { return '<option value="' + L[0] + '"' + (a.lot === L[0] ? " selected" : "") + ">" + esc(L[1]) + "</option>"; }).join("") + '</select></td><td class="l"><select data-b="' + b + '.res" style="max-width:170px"><option value="">—</option>' + mats.map(function (x) { return '<option value="' + x[0] + '"' + (a.res === x[0] ? " selected" : "") + ">" + esc(x[1] + " (" + x[2] + ")") + "</option>"; }).join("") + "</select></td><td>" + inp(b + ".qte", { w: "70px" }) + "</td><td>" + inp(b + ".mt") + "</td><td>" + (res && +a.qte > 0 ? fmt(a.mt / a.qte) + " / " + esc(res[2]) : "—") + "</td><td>" + inp(b + ".delai", { w: "56px" }) + '</td><td><button class="x" data-adel="' + i + '">✕</button></td></tr>';
    }).join("") + '</table></div><button class="btn sm" id="addAch">+ Ajouter un achat</button><p class="hint">Indiquez le matériau et la quantité (ex. ciment, 2 t) : l\'application apprend vos vrais prix et compare vos fournisseurs (Approvisionnements › Fournisseurs). Les dépenses de caisse des rapports terrain sont ajoutées automatiquement.</p></div>';
    return h;
  }
  function facTreso() {
    var p = P(), r = F(p), T = PL.tresorerie(p, r.q, r.F, S().ent), rows = T.rows;
    var max = Math.max.apply(null, rows.map(function (x) { return Math.max(x.enc, x.dep, Math.abs(x.cumul)); }).concat([1]));
    var h = '<div class="kpis">' + X.kpi("Besoin de financement maximal", fmt(T.besoin) + " FCFA", T.besoin > 0 ? "à couvrir (fonds propres, crédit, acompte plus élevé)" : "l'acompte couvre les dépenses") + X.kpi("Acompte", S().ent.acompte + " %", "Paramètres") + X.kpi("Délai de paiement", (S().ent.delaiPaiement || 30) + " jours", "après chaque situation mensuelle") + "</div>";
    var W = 760, H = 240, l = 60, bw = (W - l - 10) / Math.max(1, rows.length), Y0 = H / 2, sc = (H / 2 - 20) / max;
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" class="courbe"><line x1="' + l + '" x2="' + W + '" y1="' + Y0 + '" y2="' + Y0 + '" class="gl"/>';
    rows.forEach(function (x, i) { var xx = l + i * bw; s += '<rect x="' + (xx + 2) + '" y="' + (Y0 - x.enc * sc) + '" width="' + (bw / 2 - 3) + '" height="' + x.enc * sc + '" class="enc"><title>' + x.mois + " encaissements " + fmt(x.enc) + '</title></rect><rect x="' + (xx + bw / 2) + '" y="' + Y0 + '" width="' + (bw / 2 - 3) + '" height="' + x.dep * sc + '" class="dep"><title>' + x.mois + " dépenses " + fmt(x.dep) + "</title></rect>" + (i % Math.ceil(rows.length / 12) === 0 ? '<text x="' + (xx + 2) + '" y="' + (H - 4) + '" class="ml">' + x.mois.slice(5) + "/" + x.mois.slice(2, 4) + "</text>" : ""); });
    s += '<polyline points="' + rows.map(function (x, i) { return (l + i * bw + bw / 2) + "," + (Y0 - x.cumul * sc); }).join(" ") + '" class="cum"/></svg>';
    h += '<div class="card"><h2>Encaissements, dépenses et trésorerie cumulée (HT)</h2>' + s + '<div class="legend"><i class="lg enc"></i>encaissements <i class="lg dep"></i>dépenses (déboursé sec) <i class="lg cum"></i>trésorerie cumulée</div></div>';
    h += '<div class="card"><table class="t"><tr><th class="l">Mois</th><th>Encaissements</th><th>Dépenses</th><th>Solde du mois</th><th>Cumul</th></tr>' + rows.map(function (x) { return '<tr><td class="l">' + x.mois + "</td><td>" + fmt(x.enc) + "</td><td>" + fmt(x.dep) + "</td><td>" + fmt(x.solde) + '</td><td class="' + (x.cumul < 0 ? "neg" : "") + '">' + fmt(x.cumul) + "</td></tr>"; }).join("") + '</table><p class="hint">Hypothèses : dépenses = déboursé sec réparti sur la durée de chaque tâche ; encaissements = acompte au démarrage, puis situations mensuelles payées après le délai de paiement, nettes du remboursement d\'acompte et de la retenue de garantie (libérée 1 an après la fin). TVA exclue (reversée à l\'État).</p></div>';
    return h;
  }
  function postFactu() {
    if (!X.ui.sub.factu) X.ui.sub.factu = "docs";
    X.bindTabs("factu");
    var p = P(), e = S().ent;
    var b;
    if ((b = $("figM"))) b.onclick = function () { figerMarche(p); X.save(); X.renderPage(); X.toast("Marché figé"); };
    if ((b = $("refigM"))) b.onclick = function () { if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer : remplacer le marché par le DQE actuel"; return; } figerMarche(p); X.save(); X.renderPage(); };
    if ((b = $("newAc"))) b.onclick = function () { var m = marche(p), ht = m.ht * (+e.acompte || 0) / 100; p.factu.docs.push({ type: "acompte", num: numFacture(), date: jour(), ht: ht, tva: ht * e.tva / 100, ttc: ht * (1 + e.tva / 100), paiements: [] }); X.save(); X.renderPage(); X.toast("Facture d'acompte créée"); };
    if ((b = $("goSit"))) b.onclick = function () { X.ui.sub.factu = "sit"; X.ui.sitPct = null; X.renderPage(); };
    if ((b = $("newRG"))) b.onclick = function () { var rg = p.factu.docs.filter(function (d) { return d.type === "situation"; }).reduce(function (s, d) { return s + d.retenue; }, 0); if (rg <= 0) { X.toast("Aucune retenue de garantie à libérer"); return; } p.factu.docs.push({ type: "rg", num: numFacture(), date: jour(), ht: 0, tva: 0, ttc: rg, paiements: [] }); X.save(); X.renderPage(); };
    document.querySelectorAll("[data-payok]").forEach(function (bt) { bt.onclick = function () { var i = +bt.dataset.payok, v = +document.querySelector('[data-pay="' + i + '"]').value; if (!v) return; p.factu.docs[i].paiements = p.factu.docs[i].paiements || []; p.factu.docs[i].paiements.push({ mt: v, date: jour(), mode: document.querySelector('[data-paym="' + i + '"]').value }); X.save(); X.renderPage(); X.toast("Encaissement enregistré"); }; });
    document.querySelectorAll("[data-ddel]").forEach(function (bt) { bt.onclick = function () { if (bt.dataset.c !== "1") { bt.dataset.c = "1"; bt.textContent = "Supprimer ?"; return; } p.factu.docs.splice(+bt.dataset.ddel, 1); X.save(); X.renderPage(); }; });
    document.querySelectorAll("[data-dpdf]").forEach(function (bt) { bt.onclick = function () { pdfFacture(p.factu.docs[+bt.dataset.dpdf]); }; });
    document.querySelectorAll("[data-dwa]").forEach(function (bt) { bt.onclick = function () { var d = p.factu.docs[+bt.dataset.dwa]; PIL.envoyer(function () { pdfFacture(d); }, p.info.tel, PIL.messageFacture(p, d, false)); }; });
    document.querySelectorAll("[data-drel]").forEach(function (bt) { bt.onclick = function () { var d = p.factu.docs[+bt.dataset.drel]; PIL.envoyer(function () { pdfFacture(d); }, p.info.tel, PIL.messageFacture(p, d, true)); }; });
    // situation
    document.querySelectorAll("[data-sp]").forEach(function (el) { el.onchange = function () { var prec = derniereSituation(p), min = prec ? +prec.pcts[el.dataset.sp] || 0 : 0; X.ui.sitPct[el.dataset.sp] = Math.max(min, Math.min(100, +el.value || 0)); X.renderPage(); }; });
    if ((b = $("rstSit"))) b.onclick = function () { X.ui.sitPct = null; X.renderPage(); };
    if ((b = $("saveSit"))) b.onclick = function () {
      var m = marche(p), prec = derniereSituation(p), s = PL.situation(m, X.ui.sitPct, prec, e, acompteHT(p));
      if (s.periodeHT <= 0) { X.toast("Montant de la période nul : rien à facturer"); return; }
      var n = p.factu.docs.filter(function (d) { return d.type === "situation"; }).length + 1;
      p.factu.docs.push({ type: "situation", num: numFacture(), sitNum: n, date: jour(), pcts: JSON.parse(JSON.stringify(X.ui.sitPct)), cumulHT: s.cumulHT, precedentHT: s.precedentHT, periodeHT: s.periodeHT, rembAcompte: s.rembAcompte, rembAcompteCum: s.rembAcompteCum, baseHT: s.baseHT, tva: s.tva, ttc: s.ttc, retenue: s.retenue, net: s.net, taux: s.tauxAvancement, dgd: s.tauxAvancement >= 99.99, paiements: [] });
      X.ui.sitPct = null; X.ui.sub.factu = "docs"; X.save(); X.renderPage(); X.toast("Situation n° " + n + " émise");
    };
    if ((b = $("addAch"))) b.onclick = function () { p.factu.achats.push({ date: jour(), four: "", lib: "", lot: "", res: "", qte: 0, mt: 0, delai: "" }); X.save(); X.renderPage(); };
    document.querySelectorAll("[data-adel]").forEach(function (bt) { bt.onclick = function () { p.factu.achats.splice(+bt.dataset.adel, 1); X.save(); X.renderPage(); }; });
  }

  /* =========================================================
     MÉMOIRES TECHNIQUES
     ========================================================= */
  function genererMemoire(p) {
    var e = S().ent, q = Cc.dqe(p, X.ST()), pl = PL.planifier(p, q), b = Cc.besoins(q, X.ST()), m = Cc.metre(p), i = p.info;
    var Q = function (code) { return m.lignes.filter(function (l) { return l.code === code; }).reduce(function (s, l) { return s + l.q; }, 0); };
    var f1 = function (v) { return fmt(v, v < 10 ? 2 : 0); };
    var niv = p.niveaux.map(function (v) { return v.nom; }).join(", ");
    var jMO = Object.keys(b.mo).reduce(function (s, k) { return s + b.mo[k]; }, 0);
    var effMax = Object.keys(pl.cfg.equipes).reduce(function (s, k) { return s + (+pl.cfg.equipes[k] || 0); }, 0);
    var collab = (S().collab || []).filter(function (c) { return c.nom; });
    var S_ = [];
    S_.push(["entreprise", "1. Présentation de l'entreprise",
      e.nom + " est une entreprise de bâtiment et de génie civil intervenant sur l'ensemble du territoire sénégalais (" + (e.slogan || "bâtiment, génie civil, rénovation") + "). Elle est dirigée par " + (e.responsable || "son gérant") + (e.fonction ? ", " + e.fonction.toLowerCase() : "") + ", qui assure personnellement les études de prix, les métrés, la planification et l'ordonnancement, le pilotage et la coordination (OPC) de chaque chantier.\n\n" +
      "Notre organisation repose sur un pilotage centralisé et des équipes de suivi basées sur place" + (collab.length ? " : " + collab.map(function (c) { return c.nom + (c.role ? " (" + c.role.toLowerCase() + (c.zone ? ", " + c.zone : "") + ")" : ""); }).join(", ") : "") + ". Chaque chantier fait l'objet d'un rapport quotidien (avancement, effectif, matériaux, photos), analysé par la direction technique, qui anticipe les retards, les commandes et les conflits entre corps d'état.\n\n" +
      "Nos engagements : respect de la parole donnée, respect des délais contractuels, transparence totale sur l'avancement et les coûts, qualité d'exécution contrôlée à chaque étape."]);
    S_.push(["comprehension", "2. Compréhension du projet",
      "Le projet « " + i.nom + " » " + (i.client ? "pour le compte de " + i.client + " " : "") + "est situé " + ([i.adresse, i.ville].filter(Boolean).join(", ") || "au Sénégal") + " (région de " + i.region + "). " + (i.description || "") + "\n\n" +
      "Il comprend " + p.niveaux.length + " niveau(x) (" + niv + ") pour une surface de plancher d'environ " + fmt(m.surface) + " m². La structure est de type poteaux-poutres en béton armé dosé à 350 kg/m³, sur semelles isolées reliées par des longrines, avec un remplissage en agglomérés de ciment et des planchers " + (p.niveaux.some(function (v) { return v.plancher === "3.8"; }) ? "en dalle pleine et/ou " : "") + "en corps creux. La couverture est une toiture-terrasse étanchée.\n\n" +
      "Principales quantités : " + f1(Q("2.2") + Q("2.3") + Q("2.4") + Q("3.4") + Q("3.5") + Q("3.6") + Q("3.8") + Q("3.9")) + " m³ de béton armé, " + fmt(Q("3.7")) + " m² de planchers en corps creux, " + fmt(Q("3.1") + Q("3.2") + Q("3.3") + Q("2.5")) + " m² de maçonnerie, " + fmt(Q("5.1") + Q("5.2") + Q("5.3")) + " m² d'enduits et " + fmt(Q("8.1") + Q("8.2") + Q("8.3")) + " m² de revêtements céramiques."]);
    S_.push(["organisation", "3. Organisation du chantier",
      "Installation : clôture provisoire et balisage, magasin fermé pour le ciment et les petites fournitures, aire de stockage des agrégats et des aciers, aire de ferraillage, point d'eau, base vie (vestiaire, sanitaires) et panneau de chantier.\n\n" +
      "Encadrement : direction technique (études, planning, OPC), chef de chantier présent en permanence, chefs d'équipe par corps d'état. Un rapport de chantier est établi chaque jour et une réunion de chantier hebdomadaire donne lieu à un compte rendu diffusé au maître d'ouvrage.\n\n" +
      "Approvisionnement : les besoins en matériaux sont calculés à partir de l'étude de prix et commandés par phase. Pour ce projet : environ " + fmt(Math.ceil((b.total.CIM || 0) * 20)) + " sacs de ciment, " + fmt(["HA6", "HA8", "HA10", "HA12", "HA14", "HA16"].reduce(function (s, k) { return s + (b.total[k] || 0); }, 0) / 1000, 1) + " t d'acier, " + fmt(b.total.SAB || 0) + " m³ de sable et " + fmt(b.total.GRA || 0) + " m³ de gravier. Les fournitures à long délai (menuiseries aluminium, menuiseries bois, carrelage, sanitaires) sont commandées par anticipation selon le planning."]);
    var meth = [];
    if (Q("1.4")) meth.push("Terrassements : décapage de la terre végétale, implantation contradictoire, fouilles en rigoles et en puits (" + f1(Q("1.4")) + " m³), réception du fond de fouille avant tout bétonnage.");
    if (Q("2.2")) meth.push("Fondations : béton de propreté dosé à 150 kg/m³, semelles en béton armé dosé à 350 kg/m³ (" + f1(Q("2.2")) + " m³), amorces de poteaux, longrines et soubassement en agglos pleins. Contrôle du ferraillage (diamètres, espacements, enrobages, attentes) avant chaque coulage, vibration systématique du béton.");
    if (Q("2.6")) meth.push("Dallage : remblai d'apport compacté par couches, traitement anti-termite, dallage en béton dosé à 300 kg/m³ sur treillis soudé.");
    meth.push("Gros œuvre en élévation : poteaux coffrés et vibrés, maçonnerie en agglos montés au mortier dosé à 300 kg/m³ avec chaînages et linteaux, poutres et planchers en corps creux (hourdis, poutrelles et table de compression) coulés après vérification des réservations. Cure du béton par arrosage pendant au moins 7 jours ; décoffrage et désétaiement des planchers après 21 jours minimum.");
    if (Q("4.2")) meth.push("Étanchéité : forme de pente, étanchéité multicouche autoprotégée avec relevés sur acrotères, descentes d'eaux pluviales ; essai de mise en eau avant réception.");
    meth.push("Second œuvre : réseaux encastrés (plomberie, électricité) avant enduits ; enduits intérieurs et extérieurs au mortier de ciment ; carrelage et faïence après séchage des enduits ; menuiseries ; peintures en impression et deux couches ; appareillage et essais des installations.");
    S_.push(["methodologie", "4. Méthodologie d'exécution par corps d'état", meth.join("\n\n")]);
    var ph = {}; pl.taches.forEach(function (t) { ph[t.phase] = ph[t.phase] || [t.debut, t.fin]; if (t.debut < ph[t.phase][0]) ph[t.phase][0] = t.debut; if (t.fin > ph[t.phase][1]) ph[t.phase][1] = t.fin; });
    S_.push(["planning", "5. Planning d'exécution",
      "Le planning est établi à partir des quantités du métré et des cadences de nos équipes. Durée totale prévisionnelle : " + pl.duree + " jours calendaires (environ " + Math.round(pl.duree / 30.4) + " mois), du " + fr(pl.debut) + " au " + fr(pl.fin) + ".\n\n" +
      Object.keys(ph).map(function (k) { return "• " + k + " : du " + fr(ph[k][0]) + " au " + fr(ph[k][1]); }).join("\n") + "\n\n" +
      "Le planning intègre les délais techniques (cure du béton, séchage des enduits), les jours ouvrés et la saison des pluies (juillet à octobre), pendant laquelle les travaux extérieurs sont programmés avec une productivité réduite. Il est mis à jour chaque semaine à partir des rapports de chantier ; tout risque de retard sur une tâche critique déclenche immédiatement des mesures de rattrapage (renfort d'équipes, travail le samedi, réorganisation)."]);
    S_.push(["moyens", "6. Moyens humains et matériels",
      "Moyens humains : environ " + fmt(jMO) + " journées de travail réparties entre " + Object.keys(b.mo).map(function (k) { return (PL.LIB[k] || k) + " (" + fmt(b.mo[k]) + " j)"; }).join(", ") + ". Effectif prévu sur le chantier : jusqu'à " + effMax + " personnes selon les phases.\n\n" +
      "Moyens matériels : bétonnières, pervibrateurs, coffrages bois et métalliques, étais, échafaudages, petit outillage, matériel de topographie pour l'implantation, véhicule de liaison et d'approvisionnement."]);
    S_.push(["qualite", "7. Contrôle qualité",
      "Points d'arrêt avec contrôle et photo obligatoires : " + pl.taches.filter(function (t) { return t.pa; }).map(function (t) { return t.pa.toLowerCase(); }).join(" ; ") + ".\n\n" +
      "Contrôles réalisés : implantation et niveaux, dosage et provenance des matériaux, conformité des aciers (diamètres, recouvrements, enrobages), confection d'éprouvettes de béton pour essais d'écrasement par un laboratoire agréé à la demande du maître d'ouvrage, planéité et aplomb des maçonneries, essais d'étanchéité, essais des réseaux d'eau et des installations électriques. Les non-conformités sont tracées et levées avant réception."]);
    S_.push(["hse", "8. Hygiène, sécurité et environnement",
      "Port obligatoire des équipements de protection individuelle (casque, chaussures de sécurité, gants, gilet), balisage des fouilles et des trémies, garde-corps provisoires en rive de plancher, échafaudages vérifiés, trousse de premiers secours sur site. Accueil sécurité de chaque nouvel arrivant.\n\n" +
      "Environnement : tri et évacuation des déchets de chantier, limitation des poussières par arrosage, gestion économe de l'eau, horaires respectueux du voisinage, remise en état des abords en fin de chantier."]);
    S_.push(["hivernage", "9. Gestion de la saison des pluies",
      "Les terrassements, fondations et travaux d'étanchéité sont programmés autant que possible hors hivernage. En période de pluie : protection des fouilles et des aciers, pompage des eaux, bâchage des bétons frais et des stocks de ciment, report des coulages en cas d'orage, priorité donnée aux travaux intérieurs une fois le bâtiment hors d'eau."]);
    S_.push(["engagements", "10. Nos engagements",
      "Délai : livraison " + (i.dateLivraison ? "au plus tard le " + fr(i.dateLivraison) : "selon le planning contractuel") + ", avec un suivi d'avancement transmis au maître d'ouvrage à chaque réunion de chantier (comptes rendus, photos, courbe d'avancement).\n\n" +
      "Prix : offre établie sur la base d'un métré détaillé et de sous-détails de prix transparents. Garanties : levée des réserves dans les délais convenus, retenue de garantie de " + e.retenue + " %."]);
    return S_;
  }
  function pageMemoire() {
    var p = P(), gen = genererMemoire(p), sec = p.memoire.sections;
    var h = '<div class="head"><h1>Mémoires techniques</h1><p>Le mémoire est rédigé automatiquement à partir du projet : quantités, planning, moyens, points d\'arrêt, collaborateurs. Chaque section est modifiable ; vos modifications sont conservées.</p></div>';
    h += '<div class="card"><div class="form">' + fld("Titre du mémoire", "memoire.titre", { text: true, ph: "Mémoire technique – " + p.info.nom }) + fld("Référence de l'appel d'offres", "memoire.ref", { text: true, ph: "DAO n° …" }) + '</div><div class="bar-btn" style="margin-top:10px"><button class="btn p" id="pdfMem">Générer le PDF du mémoire</button><button class="btn" id="regenAll">Régénérer toutes les sections</button></div></div>';
    gen.forEach(function (g) {
      var txt = sec[g[0]] != null ? sec[g[0]] : g[2];
      h += '<div class="card"><h2>' + esc(g[1]) + (sec[g[0]] != null ? ' <small>(modifié)</small> <button class="btn sm" data-regen="' + g[0] + '">Régénérer</button>' : "") + '</h2><textarea rows="' + Math.min(16, Math.max(4, Math.ceil(txt.length / 110) + (txt.match(/\n/g) || []).length)) + '" data-sec="' + g[0] + '">' + esc(txt) + "</textarea></div>";
    });
    return h;
  }
  function postMemoire() {
    var p = P();
    document.querySelectorAll("[data-sec]").forEach(function (el) { el.onchange = function () { p.memoire.sections[el.dataset.sec] = el.value; X.save(); }; });
    document.querySelectorAll("[data-regen]").forEach(function (b) { b.onclick = function () { delete p.memoire.sections[b.dataset.regen]; X.save(); X.renderPage(); }; });
    $("regenAll").onclick = function () { p.memoire.sections = {}; X.save(); X.renderPage(); };
    $("pdfMem").onclick = pdfMemoire;
  }

  /* =========================================================
     PDF
     ========================================================= */
  function H() { return APP._pdf().h; }
  function pdfGantt(prev) {
    var h = H(), p = P(), r = F(p), T = prev ? r.F.taches : r.F.base.taches, J = window.jspdf.jsPDF, doc = new J({ unit: "mm", format: "a4", orientation: "landscape" });
    var titre = prev ? "PLANNING RECALÉ" : "PLANNING D'EXÉCUTION", sous = (prev ? "Situation au " + fr(jour()) + " · " : "") + "Du " + fr(prev ? r.F.base.debut : r.F.base.debut) + " au " + fr(prev ? r.F.fin : r.F.base.fin);
    var W = 297, L = 14, LW = 92, R = W - 10, top = 40, rh = Math.min(6.5, (190 - top) / Math.max(1, T.length));
    var d0 = T.reduce(function (m, t) { var s = prev ? t.pDebut : t.debut; return !m || s < m ? s : m; }, null), d1 = T.reduce(function (m, t) { var s = prev ? t.pFin : t.fin; return !m || s > m ? s : m; }, null);
    if (p.info.dateLivraison && p.info.dateLivraison > d1) d1 = p.info.dateLivraison;
    d1 = PL.addDays(d1, 5); var nj = PL.diff(d0, d1) + 1, px = (R - L - LW) / nj, X0 = function (s) { return L + LW + PL.diff(d0, s) * px; };
    hdrL(doc, titre, sous);
    var d = d0; doc.setFontSize(6.5);
    while (d <= d1) { var dt = PL.s2d(d); if (dt.getDate() === 1 || d === d0) { var m = dt.getMonth() + 1; var finM = PL.d2s(new Date(dt.getFullYear(), dt.getMonth() + 1, 0, 12)); if (finM > d1) finM = d1; if (m >= 7 && m <= 10) { doc.setFillColor(225, 236, 246); doc.rect(X0(d), top - 4, (PL.diff(d, finM) + 1) * px, T.length * rh + 4, "F"); } doc.setDrawColor(200, 200, 200); doc.line(X0(d), top - 6, X0(d), top + T.length * rh); doc.setTextColor(90, 90, 90); doc.text(h.t(dt.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })), X0(d) + 1, top - 2.5); } d = PL.addDays(d, 1); }
    T.forEach(function (t, i) {
      var y = top + i * rh, deb = prev ? t.pDebut : t.debut, fin = prev ? t.pFin : t.fin;
      doc.setFontSize(Math.min(7.5, rh * 1.25)); doc.setTextColor(30, 30, 30); doc.setFont("helvetica", t.critique ? "bold" : "normal");
      doc.text(h.t(t.nom).slice(0, 58), L, y + rh * 0.7);
      doc.setFont("helvetica", "normal"); doc.setTextColor(110, 110, 110); doc.text(h.t(fr(deb).slice(0, 5) + "-" + fr(fin).slice(0, 5)), L + LW - 2, y + rh * 0.7, { align: "right" });
      if (t.critique) doc.setFillColor(178, 58, 58); else doc.setFillColor(43, 74, 140);
      doc.rect(X0(deb), y + rh * 0.18, Math.max(0.8, (PL.diff(deb, fin) + 1) * px), rh * 0.62, "F");
      if (t.pct) { doc.setFillColor(242, 165, 30); doc.rect(X0(deb), y + rh * 0.38, Math.max(0.5, (PL.diff(deb, fin) + 1) * px * t.pct / 100), rh * 0.22, "F"); }
    });
    var yb = top + T.length * rh;
    if (p.info.dateLivraison) { doc.setDrawColor(178, 58, 58); doc.setLineWidth(0.4); doc.line(X0(p.info.dateLivraison), top - 6, X0(p.info.dateLivraison), yb); doc.setTextColor(178, 58, 58); doc.setFontSize(6.5); doc.text("Livraison promise", X0(p.info.dateLivraison) - 1, yb + 3, { align: "right" }); }
    if (prev) { doc.setDrawColor(27, 44, 92); doc.line(X0(jour()), top - 6, X0(jour()), yb); }
    doc.setTextColor(90, 90, 90); doc.setFontSize(7); doc.text(h.t("Barres rouges : tâches critiques · zone bleue : hivernage (productivité extérieure réduite)" + (prev ? " · trait foncé : avancement réalisé" : "")), L, Math.min(200, yb + 8));
    footL(doc, titre); X.saveFile(doc.output("blob"), (prev ? "Planning_recale_" : "Planning_") + X.slug(p.info.nom) + ".pdf");
  }
  function hdrL(doc, titre, sous) {
    var e = S().ent, x = 14;
    if (e.logo) { try { doc.addImage(e.logo, H().fmtImg(e.logo), 14, 6, 18, 18.7); x = 36; } catch (er) {} }
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(30, 30, 30); doc.text(H().t(e.nom), x, 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90); doc.text(H().t(P().info.nom + " · " + (P().info.client || "")), x, 17);
    doc.setTextColor(27, 44, 92); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(H().t(titre), 287, 12, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90); doc.text(H().t(sous), 287, 17, { align: "right" });
    doc.setDrawColor(27, 44, 92); doc.setLineWidth(0.5); doc.line(14, 27, 287, 27);
  }
  function footL(doc, titre) { var n = doc.getNumberOfPages(); for (var i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(120, 120, 120); doc.text(H().t(S().ent.nom + " · " + titre), 14, 203); doc.text("Page " + i + " / " + n, 287, 203, { align: "right" }); } }
  function photosPDF(doc, ids, y, titre, sous, max) {
    var h = H(); ids = (ids || []).slice(0, max || 6);
    return Promise.all(ids.map(function (id) { return X.photoGet(id); })).then(function (imgs) {
      imgs = imgs.filter(Boolean); var w = 58, hh = 43, col = 0;
      imgs.forEach(function (im) {
        if (y + hh > 280) { doc.addPage(); h.header(doc, titre, sous); y = 38; }
        try { doc.addImage(im, "JPEG", 14 + col * (w + 4), y, w, hh); } catch (e) {}
        col++; if (col === 3) { col = 0; y += hh + 4; }
      });
      return col ? y + hh + 4 : y;
    });
  }
  function pdfCR(c) {
    var h = H(), p = P(), r = F(p), doc = h.doc0(), titre = "COMPTE RENDU DE CHANTIER N° " + c.num, sous = "Réunion du " + fr(c.date) + " · période du " + fr(c.du) + " au " + fr(c.date), ctx = contexteCR(p, c);
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, "Présents : " + (c.presents || "-"));
    var body = [["Avancement global", Math.round(r.F.avancement) + " % (prévu " + Math.round(r.F.avancementPrevu) + " %)"], ["Fin prévue / livraison promise", fr(r.F.fin) + " / " + fr(p.info.dateLivraison)], ["Effectif moyen sur la période", fmt(ctx.effMoy, 1) + " personnes"], ["Météo", ctx.meteo || "-"]];
    y = h.table(doc, { startY: y, body: body.map(function (x) { return [h.t(x[0]), h.t(x[1])]; }), theme: "plain", columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } } }, titre, sous) + 4;
    var T = r.F.taches.filter(function (t) { return t.pct > 0 && t.pct < 100 || (t.pDebut <= PL.addDays(c.date, 14) && t.pct < 100); });
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Avancement des travaux en cours et à venir", 14, y + 2);
    y = h.table(doc, { startY: y + 4, head: [["Tâche", "Réalisé", "Prévu", "Début", "Fin prévue", "Observation"]], body: T.map(function (t) { return [h.t(t.nom), Math.round(t.pct) + " %", Math.round(t.pctPrevu) + " %", fr(t.pDebut), fr(t.pFin), h.t(t.retard ? "Retard " + t.retard + " j" + (t.critique ? " (critique)" : "") : "")]; }), columnStyles: { 0: { cellWidth: 70 }, 1: { halign: "right" }, 2: { halign: "right" } } }, titre, sous) + 5;
    var al = PL.alertes([p], X.ST(), c.date, S().ent);
    if (al.length) { doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Points de vigilance", 14, y + 2); y = h.table(doc, { startY: y + 4, body: al.slice(0, 12).map(function (a) { return [h.t(a.type), h.t(a.msg)]; }), columnStyles: { 0: { cellWidth: 26, fontStyle: "bold" } } }, titre, sous) + 5; }
    if (ctx.incidents.length || c.obs) { doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Observations", 14, y + 2); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); var tx = doc.splitTextToSize(h.t([c.obs].concat(ctx.incidents).filter(Boolean).join("\n")), 182); if (y + tx.length * 4 > 270) { doc.addPage(); h.header(doc, titre, sous); y = 38; } doc.text(tx, 14, y + 7); y += tx.length * 4 + 9; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Décisions et actions", 14, y + 2);
    y = h.table(doc, { startY: y + 4, head: [["Action", "Responsable", "Pour le", "Statut"]], body: (c.actions || []).map(function (a) { return [h.t(a.a), h.t(a.qui), fr(a.pour), a.ok ? "Faite" : "En cours"]; }), columnStyles: { 0: { cellWidth: 100 } } }, titre, sous) + 5;
    var res = p.opc.reserves.filter(function (x) { return !x.levee; });
    if (res.length) { doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text(h.t("Réserves ouvertes (" + res.length + ")"), 14, y + 2); y = h.table(doc, { startY: y + 4, body: res.map(function (x) { return [h.t(x.loc), h.t(x.desc), h.t(x.resp), fr(x.ech)]; }) }, titre, sous) + 5; }
    if (ctx.photos.length) { if (y > 230) { doc.addPage(); h.header(doc, titre, sous); y = 38; } doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Photos de la période", 14, y + 2); y += 5; }
    photosPDF(doc, ctx.photos, y, titre, sous, 9).then(function () { h.footers(doc, "CR n° " + c.num); X.saveFile(doc.output("blob"), "CR_" + c.num + "_" + X.slug(p.info.nom) + ".pdf"); });
  }
  function pdfReserves() {
    var h = H(), p = P(), doc = h.doc0(), titre = "LISTE DES RÉSERVES", sous = "Au " + fr(jour());
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, "");
    h.table(doc, { startY: y, head: [["N°", "Localisation", "Description", "Responsable", "Échéance", "Levée le"]], body: p.opc.reserves.map(function (r, i) { return [i + 1, h.t(r.loc), h.t(r.desc), h.t(r.resp), fr(r.ech), r.levee ? fr(r.levee) : "Ouverte"]; }), columnStyles: { 2: { cellWidth: 70 } } }, titre, sous);
    h.footers(doc, "Réserves"); X.saveFile(doc.output("blob"), "Reserves_" + X.slug(p.info.nom) + ".pdf");
  }
  function pdfGlissant() {
    var h = H(), p = P(), r = F(p), j = jour(), j21 = PL.addDays(j, 21), doc = h.doc0(), titre = "PLANNING GLISSANT 3 SEMAINES", sous = "Du " + fr(j) + " au " + fr(j21);
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, "");
    var T = r.F.taches.filter(function (t) { return t.pct < 100 && t.pDebut <= j21 && t.pFin >= j; }), lk = p.opc.lookahead;
    var ok = function (v) { return v ? "Oui" : "NON"; };
    y = h.table(doc, { startY: y, head: [["Tâche", "Début", "Fin", "Équipe", "Matériaux", "Équipe OK", "Plans OK", "Accès OK"]], body: T.map(function (t) { var l = lk[t.id] || {}; return [h.t(t.nom + (t.critique ? " (critique)" : "")), fr(t.pDebut), fr(t.pFin), h.t(t.metier ? t.equipe + " " + LIBM[t.metier].toLowerCase() : "-"), ok(l.mat), ok(l.eq), ok(l.plans), ok(l.acces)]; }), columnStyles: { 0: { cellWidth: 62 } } }, titre, sous) + 6;
    h.footers(doc, "Planning glissant"); X.saveFile(doc.output("blob"), "Planning_glissant_" + X.slug(p.info.nom) + ".pdf");
  }
  function pdfClient() {
    var h = H(), p = P(), r = F(p), doc = h.doc0(), titre = "RAPPORT D'AVANCEMENT", sous = "Situation au " + fr(jour());
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, "");
    y = h.table(doc, { startY: y, theme: "plain", body: [["Avancement global des travaux", Math.round(r.F.avancement) + " %"], ["Date de fin prévue", fr(r.F.fin)], ["Date de livraison promise", fr(p.info.dateLivraison)]].map(function (x) { return [h.t(x[0]), h.t(x[1])]; }), columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 } } }, titre, sous) + 3;
    var ph = {}; r.F.taches.forEach(function (t) { ph[t.phase] = ph[t.phase] || { m: 0, f: 0, fin: t.pFin }; ph[t.phase].m += t.montant; ph[t.phase].f += t.montant * t.pct / 100; if (t.pFin > ph[t.phase].fin) ph[t.phase].fin = t.pFin; });
    y = h.table(doc, { startY: y, head: [["Phase", "Avancement", "Fin prévue"]], body: Object.keys(ph).map(function (k) { return [h.t(k), Math.round(ph[k].m ? 100 * ph[k].f / ph[k].m : 0) + " %", fr(ph[k].fin)]; }), columnStyles: { 0: { cellWidth: 110 }, 1: { halign: "right" } } }, titre, sous) + 5;
    var next = r.F.taches.filter(function (t) { return t.pct < 100 && t.pDebut <= PL.addDays(jour(), 21); }).map(function (t) { return "• " + t.nom + " (" + fr(t.pDebut) + " → " + fr(t.pFin) + ")"; });
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Prochaines étapes (3 semaines)", 14, y + 2); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); var tx = doc.splitTextToSize(h.t(next.join("\n") || "-"), 182); doc.text(tx, 14, y + 7); y += tx.length * 4 + 10;
    var photos = []; p.suivi.rapports.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (rp) { photos = photos.concat(rp.photos || []); });
    if (photos.length) { doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text(h.t("Photos récentes du chantier"), 14, y); y += 3; }
    photosPDF(doc, photos, y, titre, sous, 6).then(function () { h.footers(doc, "Rapport d'avancement"); X.saveFile(doc.output("blob"), "Avancement_" + X.slug(p.info.nom) + "_" + jour() + ".pdf"); });
  }
  function pdfFacture(d) {
    var h = H(), p = P(), e = S().ent, doc = h.doc0(), titre = "FACTURE N° " + d.num, sous = "Date : " + fr(d.date) + " · Échéance : " + fr(PL.addDays(d.date, +e.delaiPaiement || 30));
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, libType(d));
    var rows;
    if (d.type === "acompte") rows = [["Acompte de " + e.acompte + " % sur le marché de " + fmt(p.factu.marche.ht) + " FCFA HT", d.ht], ["TVA " + e.tva + " %", d.tva], ["TOTAL TTC À PAYER", d.ttc]];
    else if (d.type === "rg") rows = [["Libération de la retenue de garantie (" + e.retenue + " %) retenue sur les situations", d.ttc], ["TOTAL À PAYER", d.ttc]];
    else {
      var m = p.factu.marche, lots = {}, prev = p.factu.docs.filter(function (x) { return x.type === "situation" && x.sitNum === d.sitNum - 1; })[0];
      m.lignes.forEach(function (l) { var k = l.lotNom; lots[k] = lots[k] || { m: 0, c: 0, p: 0 }; lots[k].m += l.m; lots[k].c += l.m * (+d.pcts[l.id] || 0) / 100; lots[k].p += prev ? l.m * (+prev.pcts[l.id] || 0) / 100 : 0; });
      y = h.table(doc, { startY: y, head: [["Lot", "Marché HT", "%", "Cumul HT", "Précédent HT", "Période HT"]], body: Object.keys(lots).map(function (k) { var L = lots[k]; return [h.t(k), h.f(L.m), h.f(L.m ? 100 * L.c / L.m : 0, 1) + " %", h.f(L.c), h.f(L.p), h.f(L.c - L.p)]; }), columnStyles: { 0: { cellWidth: 62 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } } }, titre, sous) + 4;
      rows = [["Travaux cumulés HT (" + fmt(d.taux, 1) + " % du marché)", d.cumulHT], ["À déduire : situations précédentes HT", -d.precedentHT], ["Montant de la période HT", d.periodeHT], ["Remboursement de l'acompte", -d.rembAcompte], ["Base HT", d.baseHT], ["TVA " + e.tva + " %", d.tva], ["Total TTC", d.ttc], ["Retenue de garantie " + e.retenue + " %", -d.retenue], ["NET À PAYER", d.net]];
    }
    if (y > 220) { doc.addPage(); h.header(doc, titre, sous); y = 38; }
    doc.autoTable({ startY: y, margin: { left: 96, right: 14, top: 36 }, theme: "plain", body: rows.map(function (x) { return [h.t(x[0]), h.f(x[1]) + " FCFA"]; }), styles: { fontSize: 9, cellPadding: 1.6 }, columnStyles: { 1: { halign: "right", fontStyle: "bold" } }, didParseCell: function (c) { if (c.row.index === rows.length - 1) { c.cell.styles.fillColor = h.VERT; c.cell.styles.textColor = 255; c.cell.styles.fontStyle = "bold"; } } });
    y = doc.lastAutoTable.finalY + 6;
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); var tx = doc.splitTextToSize(h.t("Arrêtée la présente facture à la somme de : " + Cc.enLettres(aPayer(d)) + " francs CFA."), 182); doc.text(tx, 14, y); y += tx.length * 4 + 4;
    doc.setFont("helvetica", "normal"); var cond = doc.splitTextToSize(h.t((e.paiementInfo || "") + " Paiement à " + (e.delaiPaiement || 30) + " jours. " + [e.ninea ? "NINEA " + e.ninea : "", e.rccm ? "RCCM " + e.rccm : ""].filter(Boolean).join(" · ")), 182); doc.text(cond, 14, y);
    h.footers(doc, "Facture " + d.num); X.saveFile(doc.output("blob"), "Facture_" + d.num + "_" + X.slug(p.info.nom) + ".pdf");
  }
  function pdfMemoire() {
    var h = H(), p = P(), e = S().ent, gen = genererMemoire(p), sec = p.memoire.sections, doc = h.doc0(), titre = "MÉMOIRE TECHNIQUE", sous = p.memoire.ref || "";
    // page de garde
    doc.setFillColor(27, 44, 92); doc.rect(0, 0, 210, 297, "F");
    if (e.logo) { try { doc.setFillColor(255, 255, 255); doc.roundedRect(77, 37, 56, 58, 3, 3, "F"); doc.addImage(e.logo, H().fmtImg(e.logo), 81, 41, 48, 50); } catch (er) {} }
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.text(h.t(e.nom), 105, 115, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text(h.t(e.slogan || ""), 105, 124, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(doc.splitTextToSize(h.t(p.memoire.titre || "Mémoire technique"), 170), 105, 160, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.text(doc.splitTextToSize(h.t(p.info.nom + (p.memoire.ref ? " - " + p.memoire.ref : "")), 170), 105, 180, { align: "center" });
    doc.text(h.t("Maître d'ouvrage : " + (p.info.client || "-")), 105, 192, { align: "center" });
    doc.setFontSize(10); doc.text(h.t([e.responsable, e.fonction].filter(Boolean).join(", ")), 105, 262, { align: "center" }); doc.text(h.t([e.tel, e.email].filter(Boolean).join(" · ")), 105, 268, { align: "center" }); doc.text(h.t(new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })), 105, 274, { align: "center" });
    doc.addPage(); h.header(doc, titre, sous); var y = 40;
    gen.forEach(function (g) {
      var txt = sec[g[0]] != null ? sec[g[0]] : g[2];
      if (y > 255) { doc.addPage(); h.header(doc, titre, sous); y = 40; }
      doc.setTextColor(27, 44, 92); doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.text(h.t(g[1]), 14, y); y += 6;
      doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      doc.splitTextToSize(h.t(txt), 182).forEach(function (ln) { if (y > 280) { doc.addPage(); h.header(doc, titre, sous); y = 40; } doc.text(ln, 14, y); y += 4.6; });
      y += 5;
    });
    var n = doc.getNumberOfPages(); for (var i = 2; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.text(h.t(e.nom + " · Mémoire technique · " + p.info.nom), 14, 290); doc.text((i - 1) + " / " + (n - 1), 196, 290, { align: "right" }); }
    X.saveFile(doc.output("blob"), "Memoire_technique_" + X.slug(p.info.nom) + ".pdf");
  }

  /* ---------- Enregistrement des pages ---------- */
  APP.reg("planning", pagePlanning, postPlanning);
  APP.reg("opc", pageOPC, postOPC);
  APP.reg("terrain", pageTerrain, postTerrain);
  APP.reg("factu", pageFactu, postFactu);
  APP.reg("memoires", pageMemoire, postMemoire);
  return { engagementsHTML: engagementsHTML, genererMemoire: genererMemoire, figerMarche: figerMarche, integrerRapport: integrerRapport };
})();
