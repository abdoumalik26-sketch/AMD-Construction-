/* ============================================================
   AMD CONSTRUCTION — moteur Planning / OPC / Facturation
   - taches(p, q)        : tâches générées depuis le métré (durées = journées MO ÷ équipe)
   - planifier(p, q)     : planning (calendrier ouvré, cure/séchage, hivernage, chemin critique)
   - prevision(p, q, j)  : replanification à partir de l'avancement terrain
   - alertes(...)        : moteur d'anticipation
   - situation(...)      : calcul des situations de travaux
   ============================================================ */
var PLAN = (function () {
  var C = (typeof CALC !== "undefined") ? CALC : require("./calc.js");
  var DATA = (typeof window !== "undefined" && window.DATA) || (typeof global !== "undefined" && global.DATA) || require("./data.js");
  var n = C.n;
  var JOUR = 86400000;

  /* ---------------- Dates ---------------- */
  function d2s(d) { var x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
  function s2d(s) { var a = String(s).split("-"); return new Date(+a[0], +a[1] - 1, +a[2], 12); }
  function addDays(s, k) { var d = s2d(s); d.setDate(d.getDate() + k); return d2s(d); }
  function diff(a, b) { return Math.round((s2d(b) - s2d(a)) / JOUR); }   // b - a en jours
  function maxS(a, b) { return !a ? b : !b ? a : (a > b ? a : b); }
  function ouvre(s, cfg) { var w = s2d(s).getDay(); return w !== 0 && (cfg.samedi || w !== 6) && (cfg.feries || []).indexOf(s) < 0; }
  function hiv(s, cfg) { var m = s2d(s).getMonth() + 1; return cfg.hivernage && m >= 7 && m <= 10; }
  function prochainOuvre(s, cfg) { var k = 0; while (!ouvre(s, cfg) && k++ < 30) s = addDays(s, 1); return s; }
  // fin (incluse) d'une tâche de 'dur' jours ouvrés commençant à s ; productivité réduite en hivernage si extérieur
  function finTravail(s, dur, ext, cfg) {
    s = prochainOuvre(s, cfg); if (dur <= 0) return s;
    var fait = 0, d = s, k = 0;
    while (k++ < 2000) {
      if (ouvre(d, cfg)) { fait += (ext && hiv(d, cfg)) ? n(cfg.facteurHiv) || 0.75 : 1; if (fait >= dur - 1e-9) return d; }
      d = addDays(d, 1);
    }
    return d;
  }
  function joursOuvres(a, b, cfg) { var k = 0, d = a; if (!a || !b || b < a) return 0; while (d <= b && k < 3000) { if (ouvre(d, cfg)) k++; d = addDays(d, 1); } return k; }

  /* ---------------- Paramètres ---------------- */
  var EQUIPES = { MAC: 4, FER: 2, COFR: 2, MAN: 6, CARR: 2, PEIN: 2, PLOM: 1, ELEC: 1, MEN: 1, ETANC: 1, CHEF: 1 };
  var APPRO = {  // catégorie -> délai de livraison (jours)
    "Fer à béton et ciment": 3, "Hourdis": 5, "Membrane d'étanchéité": 10, "Carrelage et faïence": 14,
    "Appareils sanitaires et électriques": 14, "Menuiseries bois": 21, "Menuiseries aluminium et métalliques": 30
  };
  function cfgOf(p) {
    var pl = p.planning || {};
    return { debut: pl.debut || (p.info && p.info.date) || d2s(new Date()), samedi: pl.samedi !== false, hivernage: pl.hivernage !== false, facteurHiv: pl.facteurHiv || 0.75, feries: pl.feries || [], equipes: Object.assign({}, EQUIPES, pl.equipes || {}) };
  }

  /* ---------------- Gabarit des tâches ---------------- */
  function gabarit(p) {
    if (p.mode === "rapide") return gabaritRapide(p);
    var N = p.niveaux || [], L = N.length, T = [];
    function t(id, nom, phase, lignes, deps, o) { T.push(Object.assign({ id: id, nom: nom, phase: phase, lignes: lignes, deps: deps }, o || {})); }
    var PF = "Terrassements et fondations";
    t("INST", "Installation de chantier et implantation", PF, [["F-inst", 1], ["F-impl", 1]], [], { ext: 1, fixe: 3 });
    t("TERR", "Décapage et fouilles", PF, [["F-dec", 1], ["F-fou", 1]], [["INST", 0]], { ext: 1, pa: "Réception du fond de fouille" });
    t("FOND", "Béton de propreté, semelles et amorces de poteaux", PF, [["F-bp", 1], ["F-sem", 1], ["F-am", 1]], [["TERR", 0]], { ext: 1, pa: "Ferraillage des semelles avant coulage", appro: ["Fer à béton et ciment"] });
    t("SOUB", "Longrines et soubassement", PF, [["F-lon", 1], ["F-sou", 1]], [["FOND", 3]], { ext: 1, pa: "Ferraillage des longrines avant coulage" });
    t("DALL", "Remblais, anti-termite et dallage", PF, [["F-rem", 1], ["F-app", 1], ["F-ate", 1], ["F-dal", 1], ["F-ts", 1]], [["SOUB", 2]], { ext: 1 });
    t("VRD", "Assainissement, fosse septique, regards et clôture", "VRD et divers", [["V-fos", 1], ["V-reg", 1], ["V-clo", 1]], [["FOND", 0]], { ext: 1 });
    N.forEach(function (v, i) {
      var ph = "Gros œuvre " + v.nom;
      t("POT" + i, "Poteaux " + v.nom, ph, [["N" + i + "-po", 1]], i === 0 ? [["DALL", 0]] : [["PLAN" + (i - 1), 7]], { ext: 1, pa: "Ferraillage des poteaux avant coulage", appro: i === 0 ? null : ["Fer à béton et ciment"] });
      t("MAC" + i, "Maçonnerie " + v.nom, ph, [["N" + i + "-me", 1], ["N" + i + "-cl", 1]], [["POT" + i, 2]], { ext: 1 });
      t("PLAN" + i, "Poutres, chaînages, escalier et plancher haut " + v.nom, ph, [["N" + i + "-pt", 1], ["N" + i + "-ch", 1], ["N" + i + "-es", 1], ["N" + i + "-pl", 1]], [["MAC" + i, 0]], { ext: 1, pa: "Ferraillage et réservations du plancher avant coulage", appro: ["Hourdis"] });
    });
    var last = L - 1, allMac = N.map(function (v, i) { return ["MAC" + i, 0]; });
    if (L) {
      t("ACRO", "Acrotère", "Toiture-terrasse", [["T-acm", 1], ["T-acc", 1]], [["PLAN" + last, 7]], { ext: 1 });
      t("ETAN", "Forme de pente et étanchéité de la terrasse", "Toiture-terrasse", [["T-fp", 1], ["T-et", 1], ["T-ep", 1]], [["ACRO", 7]], { ext: 1, appro: ["Membrane d'étanchéité"], pa: "Essai d'étanchéité (mise en eau)" });
      var PS = "Second œuvre et finitions";
      t("RES", "Réseaux encastrés plomberie et électricité", PS, [["S-ra", 1], ["S-re", 1], ["S-lum", 0.5], ["S-pc", 0.5], ["S-int", 0.5], ["S-vv", 0.5]], allMac.concat([["PLAN" + last, 21]]), { pa: "Réseaux encastrés avant enduits" });
      t("ENDI", "Enduits intérieurs et sous plafond", PS, [["S-ei", 1], ["S-pl", 1]], [["RES", 0]]);
      t("ENDE", "Enduits extérieurs", PS, [["S-ee", 1]], allMac.concat([["ACRO", 3]]), { ext: 1 });
      t("CARR", "Carrelage, faïence, plinthes et marches", PS, [["S-ci", 1], ["S-ce", 1], ["S-fa", 1], ["S-pli", 1], ["S-mar", 1]], [["ENDI", 7]], { appro: ["Carrelage et faïence"] });
      t("MENA", "Menuiseries aluminium et métalliques, grilles, garde-corps", PS, [["S-m-FA", 1], ["S-m-PFA", 1], ["S-m-PM", 1], ["S-gri", 1], ["S-gc", 1]], [["ENDE", 0]], { appro: ["Menuiseries aluminium et métalliques"] });
      t("MENB", "Menuiseries bois", PS, [["S-m-PB", 1], ["S-m-PE", 1]], [["CARR", 0]], { appro: ["Menuiseries bois"] });
      t("APPA", "Appareillage sanitaire et électrique, tableau, branchement", PS, [["S-wc", 1], ["S-lav", 1], ["S-dou", 1], ["S-evi", 1], ["S-bac", 1], ["S-cha", 1], ["S-lum", 0.5], ["S-pc", 0.5], ["S-int", 0.5], ["S-vv", 0.5], ["S-tab", 1], ["S-ter", 1], ["S-br", 1]], [["CARR", 0]], { appro: ["Appareils sanitaires et électriques"] });
      t("PEIN", "Peintures et vernis", PS, [["S-pi", 1], ["S-pp", 1], ["S-pe", 1], ["S-pg", 1], ["S-ve", 1]], [["CARR", 0], ["MENB", 0], ["MENA", 0], ["ENDI", 21]]);
      t("RECEP", "Nettoyage, essais et réception", "Réception", [], [["PEIN", 0], ["APPA", 0], ["ETAN", 0], ["VRD", 0]], { fixe: 3 });
    }
    return T;
  }
  // Petits travaux : une tâche par lot, enchaînées dans l'ordre des lots, puis réception
  function gabaritRapide(p) {
    var T = [], lots = {}, prev = null, EXT = { L1: 1, L2: 1, L3: 1, L4: 1, L12: 1 };
    (p.rapide || []).forEach(function (r) {
      if (!(+r.q > 0)) return;
      var o = r.code && DATA.OUV[r.code], lot = (o && !r.lot ? o.lot : r.lot) || "L12";
      lots[lot] = lots[lot] || { lignes: [], jours: 0 };
      lots[lot].lignes.push([r.id, 1]); lots[lot].jours += +r.jours || 0;
    });
    DATA.LOTS.forEach(function (L) {
      var x = lots[L[0]]; if (!x) return;
      var id = "R" + L[0];
      T.push({ id: id, nom: L[1], phase: L[1], lignes: x.lignes, deps: prev ? [[prev, 0]] : [], ext: EXT[L[0]] || 0, fixe: x.jours || 0 });
      prev = id;
    });
    T.push({ id: "RECEP", nom: "Nettoyage et réception", phase: "Réception", lignes: [], deps: prev ? [[prev, 0]] : [], fixe: 1 });
    return T;
  }
  function correspond(id, motif) { return id === motif || (motif.slice(-1) !== "-" && id.indexOf(motif) === 0 && /^S-m-/.test(motif)); }

  /* ---------------- Tâches avec durées ---------------- */
  function taches(p, q) {
    var cfg = cfgOf(p), T = gabarit(p), ov = (p.planning || {}).ov || {}, cat = q.cat, ligneTache = {};
    T.forEach(function (tk) {
      var mo = {}, mt = 0, ds = 0, lignes = [];
      q.lignes.forEach(function (l) {
        tk.lignes.forEach(function (m) {
          if (!correspond(l.id, m[0])) return;
          var fr = m[1]; lignes.push({ id: l.id, fr: fr });
          ligneTache[l.id] = ligneTache[l.id] || []; ligneTache[l.id].push([tk.id, fr]);
          mt += l.m * fr; ds += l.q * l.ds * fr;
          var o = cat.ouv[l.code]; if (!o) return;
          o.c.forEach(function (c) { var r = cat.res[c[0]]; if (r && r.cat === "MO") mo[r.code] = (mo[r.code] || 0) + l.q * c[1] * fr * (r.prod || 1); });
        });
      });
      var dur = 0, princ = null;
      Object.keys(mo).forEach(function (k) { if (k === "MAN" || k === "CHEF") return; var d = mo[k] / Math.max(1, n(cfg.equipes[k]) || 1); if (d > dur) { dur = d; princ = k; } });
      if (!princ && mo.MAN) { dur = mo.MAN / Math.max(1, n(cfg.equipes.MAN)); princ = "MAN"; }
      if (tk.fixe) dur = Math.max(dur, tk.fixe);
      dur = Math.max(1, Math.ceil(dur));
      var o2 = ov[tk.id] || {};
      tk.durCalc = dur; tk.dur = o2.dur ? Math.max(1, Math.round(n(o2.dur))) : dur;
      tk.debutImpose = o2.debut || null;
      tk.mo = mo; tk.metier = princ; tk.equipe = princ ? n(cfg.equipes[princ]) : 0; tk.montant = mt; tk.ds = ds; tk.lignesDQE = lignes;
    });
    // tâches vides (pas de quantités) sauf réception / installation : retirées, dépendances reportées
    var vides = {}; T.forEach(function (tk) { if (!tk.lignesDQE.length && !tk.fixe) vides[tk.id] = tk; });
    function depsReelles(deps) {
      var out = [];
      deps.forEach(function (d) { if (vides[d[0]]) depsReelles(vides[d[0]].deps).forEach(function (x) { out.push([x[0], x[1] + d[1]]); }); else out.push(d); });
      return out;
    }
    var R = T.filter(function (tk) { return !vides[tk.id]; });
    R.forEach(function (tk) { tk.deps = depsReelles(tk.deps); });
    return { taches: R, cfg: cfg, ligneTache: ligneTache };
  }

  /* ---------------- Planification (passe avant/arrière) ---------------- */
  function planifier(p, q) {
    var r = taches(p, q), T = r.taches, cfg = r.cfg, idx = {};
    T.forEach(function (t) { idx[t.id] = t; });
    T.forEach(function (t) {
      var req = cfg.debut;
      t.deps.forEach(function (d) { var pr = idx[d[0]]; if (pr) req = maxS(req, addDays(pr.fin, 1 + d[1])); });
      t.debutRequis = prochainOuvre(req, cfg);
      t.debut = t.debutImpose ? prochainOuvre(t.debutImpose, cfg) : t.debutRequis;
      t.conflit = t.debutImpose && t.debutImpose < t.debutRequis;
      t.fin = finTravail(t.debut, t.dur, t.ext, cfg);
    });
    var fin = T.reduce(function (m, t) { return maxS(m, t.fin); }, cfg.debut);
    // passe arrière (jours calendaires)
    for (var i = T.length - 1; i >= 0; i--) {
      var t = T[i], succ = T.filter(function (s) { return s.deps.some(function (d) { return d[0] === t.id; }); });
      t.finTard = succ.length ? succ.reduce(function (m, s) { var lag = s.deps.filter(function (d) { return d[0] === t.id; })[0][1]; var v = addDays(s.debutTard, -1 - lag); return !m || v < m ? v : m; }, null) : fin;
      t.debutTard = addDays(t.finTard, -diff(t.debut, t.fin));
      t.marge = diff(t.debut, t.debutTard);
      t.critique = t.marge <= 0;
    }
    return { taches: T, cfg: cfg, debut: cfg.debut, fin: fin, ligneTache: r.ligneTache, duree: diff(cfg.debut, fin) + 1 };
  }

  /* ---------------- Avancement terrain ---------------- */
  function avancements(p, jusqua) {
    var av = {}, rap = ((p.suivi || {}).rapports || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    rap.forEach(function (r) {
      if (jusqua && r.date > jusqua) return;
      Object.keys(r.av || {}).forEach(function (id) {
        var v = n(r.av[id]); var a = av[id] = av[id] || { pct: 0, debut: null, fin: null, date: null };
        if (v > 0 && !a.debut) a.debut = r.date;
        if (v >= a.pct) { a.pct = Math.min(100, v); a.date = r.date; }
        if (a.pct >= 100 && !a.fin) a.fin = r.date;
      });
    });
    // validation manuelle par l'OPC (prioritaire)
    var val = (p.opc || {}).avValide || {};
    Object.keys(val).forEach(function (id) { var a = av[id] = av[id] || { pct: 0 }; a.pct = n(val[id].pct); if (val[id].debut) a.debut = val[id].debut; if (a.pct >= 100) a.fin = a.fin || val[id].date; });
    return av;
  }
  function pctPrevu(t, jour, cfg) {
    if (jour < t.debut) return 0; if (jour >= t.fin) return 100;
    var tot = joursOuvres(t.debut, t.fin, cfg), fait = joursOuvres(t.debut, jour, cfg);
    return tot ? Math.min(100, 100 * fait / tot) : 0;
  }
  function prevision(p, q, jour) {
    var base = planifier(p, q), cfg = base.cfg, av = avancements(p, jour), idx = {}, ref = (p.planning || {}).ref || null;
    var T = base.taches.map(function (t) { return Object.assign({}, t); });
    T.forEach(function (t) {
      idx[t.id] = t;
      var a = av[t.id] || { pct: 0 }; t.pct = a.pct || 0;
      t.refDebut = ref && ref[t.id] ? ref[t.id][0] : t.debut; t.refFin = ref && ref[t.id] ? ref[t.id][1] : t.fin;
      t.pctPrevu = pctPrevu({ debut: t.refDebut, fin: t.refFin }, jour, cfg);
      var req = cfg.debut;
      t.deps.forEach(function (d) { var pr = idx[d[0]]; if (pr) req = maxS(req, addDays(pr.pFin, 1 + d[1])); });
      if (t.pct >= 100) { t.pDebut = a.debut || t.debut; t.pFin = a.fin || a.date || t.fin; }
      else if (t.pct > 0) { t.pDebut = a.debut || t.debut; t.pFin = finTravail(maxS(jour, t.pDebut), t.dur * (1 - t.pct / 100), t.ext, cfg); }
      else { t.pDebut = prochainOuvre(maxS(maxS(req, t.debut), jour > cfg.debut ? jour : cfg.debut), cfg); t.pFin = finTravail(t.pDebut, t.dur, t.ext, cfg); }
      t.retard = t.pct >= 100 ? 0 : Math.max(0, diff(t.refFin, t.pFin));
      t.ecart = t.pctPrevu - t.pct;
    });
    var fin = T.reduce(function (m, t) { return maxS(m, t.pFin); }, cfg.debut);
    var refFin = ref ? Object.keys(ref).reduce(function (m, k) { return maxS(m, ref[k][1]); }, null) : base.fin;
    var montant = T.reduce(function (s, t) { return s + t.montant; }, 0);
    var fait = T.reduce(function (s, t) { return s + t.montant * t.pct / 100; }, 0);
    var prevu = T.reduce(function (s, t) { return s + t.montant * t.pctPrevu / 100; }, 0);
    return { taches: T, cfg: cfg, base: base, fin: fin, refFin: refFin, jour: jour, avancement: montant ? 100 * fait / montant : 0, avancementPrevu: montant ? 100 * prevu / montant : 0, montant: montant, valeurAcquise: fait, valeurPrevue: prevu, av: av };
  }

  /* ---------------- Besoins par tâche (contrôle des consommations) ---------------- */
  function besoinsTache(t, q) {
    var out = {}, cat = q.cat;
    t.lignesDQE.forEach(function (ln) {
      var l = q.lignes.filter(function (x) { return x.id === ln.id; })[0]; if (!l) return;
      var o = cat.ouv[l.code]; if (!o) return;
      o.c.forEach(function (c) { var r = cat.res[c[0]]; if (r && r.cat === "MAT") out[r.code] = (out[r.code] || 0) + l.q * c[1] * ln.fr * (1 + r.perte / 100); });
    });
    return out;
  }
  function consommations(p, jour) {
    var out = {};
    ((p.suivi || {}).rapports || []).forEach(function (r) {
      if (jour && r.date > jour) return;
      Object.keys(r.mat || {}).forEach(function (k) { out[k] = (out[k] || 0) + n(r.mat[k]); });
    });
    return out;   // CIM en sacs, HA en kg, SAB/GRA en m³, AG/HOU en unités
  }

  /* ---------------- Moteur d'alertes ---------------- */
  var CAPACITE = { MAC: 8, FER: 4, COFR: 4, MAN: 12, CARR: 4, PEIN: 4, PLOM: 2, ELEC: 2, MEN: 2, ETANC: 2 };
  function alertes(projets, st, jour, ent) {
    var A = [], charges = {};
    function add(niv, p, type, msg, quand) { A.push({ niv: niv, projet: p.info.nom, pid: p.id, type: type, msg: msg, quand: quand || jour }); }
    projets.forEach(function (p) {
      if (p.archive) return;
      relances(p, jour, ent, add);
      if ((p.statut || "etude") !== "chantier") return;
      var q = C.dqe(p, st), F = prevision(p, q, jour), cfg = F.cfg, i = p.info || {};
      // 1. livraison
      if (i.dateLivraison) {
        var m = diff(F.fin, i.dateLivraison);
        if (m < 0) add("rouge", p, "Délai", "Livraison promise le " + fr(i.dateLivraison) + ", prévue le " + fr(F.fin) + " : " + (-m) + " jours de retard à rattraper.");
        else if (m < 10) add("orange", p, "Délai", "Marge de seulement " + m + " jours sur la livraison promise (" + fr(i.dateLivraison) + ").");
      }
      F.taches.forEach(function (t) {
        // 2. retards de tâches
        if (t.pct < 100 && t.ecart > 15 && jour >= t.refDebut) add(t.critique || t.ecart > 30 ? "rouge" : "orange", p, "Retard", t.nom + " : " + Math.round(t.pct) + " % réalisé pour " + Math.round(t.pctPrevu) + " % prévu" + (t.critique ? " (tâche critique : retarde la livraison)" : "") + ".");
        // 3. conflits d'enchaînement (début imposé trop tôt)
        if (t.conflit) add("rouge", p, "Conflit", t.nom + " est imposé au " + fr(t.debutImpose) + " alors que ses prérequis (cure, séchage, tâches précédentes) ne permettent pas de commencer avant le " + fr(t.debutRequis) + ".");
        // 4. approvisionnements
        if (t.pct === 0 && t.appro) t.appro.forEach(function (c) {
          var cle = t.id + "|" + c; if (((p.opc || {}).commandes || {})[cle]) return;
          var avant = addDays(t.pDebut, -(APPRO[c] || 7) - 2), k = diff(jour, avant);
          if (k < 0) add("rouge", p, "Commande", "« " + c + " » pour « " + t.nom + " » aurait dû être commandé avant le " + fr(avant) + " (début prévu le " + fr(t.pDebut) + ").");
          else if (k <= 10) add("orange", p, "Commande", "Commander « " + c + " » avant le " + fr(avant) + " pour « " + t.nom + " » (début le " + fr(t.pDebut) + ", délai " + (APPRO[c] || 7) + " j).");
        });
        // 5. hivernage
        if (cfg.hivernage && t.ext && t.pct < 100 && /TERR|FOND|ETAN|SOUB|DALL/.test(t.id) && diff(jour, t.pDebut) <= 60 && (hiv(t.pDebut, cfg) || hiv(t.pFin, cfg)))
          add("orange", p, "Hivernage", t.nom + " tombe en saison des pluies (" + fr(t.pDebut) + " → " + fr(t.pFin) + ") : prévoir protections, pompage et marge.");
        // charge des équipes (multi-chantiers) sur 60 jours
        if (t.metier && t.equipe && t.pct < 100) {
          var d = maxS(t.pDebut, jour);
          while (d <= t.pFin && diff(jour, d) <= 60) { if (ouvre(d, cfg)) { var k2 = t.metier + "|" + d; charges[k2] = charges[k2] || { n: 0, p: {} }; charges[k2].n += t.equipe; charges[k2].p[p.info.nom] = 1; } d = addDays(d, 1); }
        }
      });
      // 6. rapports terrain manquants
      var raps = (p.suivi || {}).rapports || [], dernier = raps.reduce(function (m, r) { return maxS(m, r.date); }, null);
      if (jour >= cfg.debut && jour <= F.fin) {
        var age = dernier ? diff(dernier, jour) : diff(cfg.debut, jour);
        if (age > 5) add("rouge", p, "Terrain", "Aucun rapport de chantier depuis " + age + " jours.");
        else if (age > 2) add("orange", p, "Terrain", "Dernier rapport de chantier il y a " + age + " jours.");
      }
      // 7. consommation de ciment et d'acier vs théorique
      var cons = consommations(p, jour), theo = {};
      F.taches.forEach(function (t) { var b = besoinsTache(t, q); Object.keys(b).forEach(function (k) { theo[k] = (theo[k] || 0) + b[k] * t.pct / 100; }); });
      var cimDecl = n(cons.CIM) / 20, cimTheo = n(theo.CIM);
      if (cimDecl > 2 && cimDecl > cimTheo * 1.15) add(cimDecl > cimTheo * 1.3 ? "rouge" : "orange", p, "Matériaux", "Ciment consommé : " + Math.round(cimDecl * 20) + " sacs pour " + Math.round(cimTheo * 20) + " sacs théoriques à cet avancement (+" + Math.round(100 * (cimDecl / Math.max(cimTheo, 0.01) - 1)) + " %).");
      var fer = ["HA6", "HA8", "HA10", "HA12", "HA14", "HA16"], ferD = fer.reduce(function (s, k) { return s + n(cons[k]); }, 0), ferT = fer.reduce(function (s, k) { return s + n(theo[k]); }, 0);
      if (ferD > 100 && ferD > ferT * 1.15) add("orange", p, "Matériaux", "Acier consommé : " + Math.round(ferD) + " kg pour " + Math.round(ferT) + " kg théoriques à cet avancement.");
      // 8. points d'arrêt sans photo
      F.taches.forEach(function (t) {
        if (!t.pa || t.pct <= 0) return;
        var ok = raps.some(function (r) { return (r.pa || {})[t.id]; });
        if (!ok) add("orange", p, "Qualité", "Point d'arrêt « " + t.pa + " » : aucune photo de contrôle reçue (" + t.nom + " à " + Math.round(t.pct) + " %).");
      });
      // 8 bis. sécurité (module QHSE)
      if (typeof QHSE !== "undefined") QHSE.alertes(p, jour, F, add);
      // 9. facturation
      var sit = ((p.factu || {}).docs || []).filter(function (d) { return d.type === "situation"; });
      var derniere = sit.reduce(function (m, d) { return maxS(m, d.date); }, null);
      if (F.avancement >= 5 && (!derniere || diff(derniere, jour) > 30)) add("orange", p, "Facturation", "Avancement global " + Math.round(F.avancement) + " % : pensez à établir une situation de travaux" + (derniere ? " (dernière le " + fr(derniere) + ")" : "") + ".");
      // 11. dérive des dépenses par lot
      ecartsLots(p, q, F).forEach(function (x) {
        if (x.reel > 100000 && x.reel > x.prevu * 1.1) add(x.reel > x.prevu * 1.25 ? "rouge" : "orange", p, "Coûts", "Lot « " + x.nom + " » : " + Math.round(x.reel).toLocaleString("fr-FR") + " FCFA dépensés pour " + Math.round(x.prevu).toLocaleString("fr-FR") + " FCFA prévus à cet avancement (+" + Math.round(100 * (x.reel / Math.max(1, x.prevu) - 1)) + " %).");
      });
    });
    // 10. surcharge d'équipes multi-chantiers
    var cap = Object.assign({}, CAPACITE, (ent || {}).capacite || {}), vu = {};
    Object.keys(charges).sort().forEach(function (k) {
      var m = k.split("|")[0], d = k.split("|")[1], c = charges[k], sem = d.slice(0, 8) + "s" + Math.floor((s2d(d).getDate() - 1) / 7);
      if (c.n > n(cap[m]) && !vu[m + sem]) {
        vu[m + sem] = 1;
        A.push({ niv: Object.keys(c.p).length > 1 ? "rouge" : "orange", projet: Object.keys(c.p).join(" + "), type: "Équipes", msg: "Le " + fr(d) + " : besoin de " + c.n + " " + (LIB[m] || m) + " pour " + n(cap[m]) + " disponibles (" + Object.keys(c.p).join(", ") + ").", quand: d });
      }
    });
    var ordre = { rouge: 0, orange: 1, info: 2 };
    return A.sort(function (a, b) { return ordre[a.niv] - ordre[b.niv] || (a.quand < b.quand ? -1 : 1); });
  }
  // Factures échues non payées (tous projets non archivés)
  function relances(p, jour, ent, add) {
    var dl = n((ent || {}).delaiPaiement) || 30;
    (((p.factu || {}).docs) || []).forEach(function (d) {
      var du = d.type === "situation" ? n(d.net) : n(d.ttc), paye = (d.paiements || []).reduce(function (s, x) { return s + n(x.mt); }, 0), ech = addDays(d.date, dl);
      if (du - paye > 1 && ech < jour) { var j = diff(ech, jour); add(j > 15 ? "rouge" : "orange", p, "Paiement", "Facture " + d.num + " : " + Math.round(du - paye).toLocaleString("fr-FR") + " FCFA impayés, échue depuis " + j + " jours (le " + fr(ech) + "). Relancez le client (Facturation › Relancer).", ech); }
    });
  }
  // Dépenses réelles par lot vs déboursé prévu à l'avancement
  function ecartsLots(p, q, F) {
    var prevu = {}, budget = {}, reel = {}, lig = {};
    q.lignes.forEach(function (l) { lig[l.id] = l; budget[l.lot] = (budget[l.lot] || 0) + l.q * l.ds; });
    F.taches.forEach(function (t) { (t.lignesDQE || []).forEach(function (ln) { var l = lig[ln.id]; if (l) prevu[l.lot] = (prevu[l.lot] || 0) + l.q * l.ds * ln.fr * t.pct / 100; }); });
    (((p.factu || {}).achats) || []).forEach(function (a) { if (a.lot) reel[a.lot] = (reel[a.lot] || 0) + n(a.mt); });
    ((p.suivi || {}).rapports || []).forEach(function (r) { (r.dep || []).forEach(function (d) { if (d.lot) reel[d.lot] = (reel[d.lot] || 0) + n(d.mt); }); });
    var D = (typeof DATA !== "undefined" && DATA.LOTS) || [];
    return Object.keys(budget).map(function (k) { var L = D.filter(function (x) { return x[0] === k; })[0]; return { lot: k, nom: L ? L[1] : k, budget: budget[k], prevu: prevu[k] || 0, reel: reel[k] || 0 }; });
  }
  var LIB = { MAC: "maçons", FER: "ferrailleurs", COFR: "coffreurs", MAN: "manœuvres", CARR: "carreleurs", PEIN: "peintres", PLOM: "plombiers", ELEC: "électriciens", MEN: "menuisiers", ETANC: "étancheurs", CHEF: "chefs d'équipe" };
  function fr(s) { if (!s) return "—"; var a = s.split("-"); return a[2] + "/" + a[1] + "/" + a[0]; }

  /* ---------------- Facturation : situation de travaux ---------------- */
  // marche : {lignes:[{id,num,d,u,q,pu,m,lot,lotNom}], ht}
  // pcts : {idLigne: % cumulé} ; prec : situation précédente (ou null)
  function situation(marche, pcts, prec, ent, acompteHT) {
    var lignes = marche.lignes.map(function (l) {
      var pc = Math.max(0, Math.min(100, n(pcts[l.id]))), cum = l.m * pc / 100;
      var pp = prec && prec.pcts ? n(prec.pcts[l.id]) : 0;
      return Object.assign({}, l, { pct: pc, cumul: cum, precedent: l.m * pp / 100, periode: cum - l.m * pp / 100 });
    });
    var cumul = lignes.reduce(function (s, l) { return s + l.cumul; }, 0);
    var precedent = prec ? n(prec.cumulHT) : 0, periode = cumul - precedent;
    var tauxAv = marche.ht ? cumul / marche.ht : 0;
    var rembAcompteCum = Math.min(n(acompteHT), n(acompteHT) * tauxAv), rembAcomptePrec = prec ? n(prec.rembAcompteCum) : 0;
    var rembAcompte = rembAcompteCum - rembAcomptePrec;
    var rg = n(ent.retenue) / 100 * periode;
    var base = periode - rembAcompte, tva = base * n(ent.tva) / 100;
    var net = base + tva - rg;
    return { lignes: lignes, cumulHT: cumul, precedentHT: precedent, periodeHT: periode, tauxAvancement: 100 * tauxAv, rembAcompte: rembAcompte, rembAcompteCum: rembAcompteCum, baseHT: base, tva: tva, ttc: base + tva, retenue: rg, net: net };
  }

  /* ---------------- Trésorerie prévisionnelle (mensuelle) ---------------- */
  function tresorerie(p, q, F, ent) {
    var mois = {}, cfg = F.cfg;
    function m(d) { return d.slice(0, 7); }
    F.taches.forEach(function (t) {   // dépenses = déboursé sec réparti sur la durée
      var jours = []; var d = t.pDebut; while (d <= t.pFin) { if (ouvre(d, cfg)) jours.push(d); d = addDays(d, 1); }
      jours.forEach(function (j) { var k = m(j); mois[k] = mois[k] || { dep: 0, enc: 0 }; mois[k].dep += t.ds / jours.length; });
    });
    var ht = q.ht, ac = n(ent.acompte) / 100, rg = n(ent.retenue) / 100, delai = n(ent.delaiPaiement) || 30;
    var k0 = m(cfg.debut); mois[k0] = mois[k0] || { dep: 0, enc: 0 }; mois[k0].enc += ac * ht;
    // situations mensuelles : travaux du mois encaissés M + délai
    F.taches.forEach(function (t) {
      var jours = []; var d = t.pDebut; while (d <= t.pFin) { if (ouvre(d, cfg)) jours.push(d); d = addDays(d, 1); }
      jours.forEach(function (j) {
        var fin = addDays(j.slice(0, 8) + "28", delai), k = m(fin);
        mois[k] = mois[k] || { dep: 0, enc: 0 };
        mois[k].enc += t.montant / jours.length * (1 - ac) * (1 - rg);
      });
    });
    var kf = m(addDays(F.fin, 365)); mois[kf] = mois[kf] || { dep: 0, enc: 0 }; mois[kf].enc += rg * ht * (1 - ac);  // libération RG à 1 an
    var cles = Object.keys(mois).sort(), cum = 0, mini = 0;
    var rows = cles.map(function (k) { cum += mois[k].enc - mois[k].dep; mini = Math.min(mini, cum); return { mois: k, enc: mois[k].enc, dep: mois[k].dep, solde: mois[k].enc - mois[k].dep, cumul: cum }; });
    return { rows: rows, besoin: -mini };
  }

  return { d2s: d2s, s2d: s2d, addDays: addDays, diff: diff, fr: fr, ouvre: ouvre, finTravail: finTravail, cfgOf: cfgOf, EQUIPES: EQUIPES, APPRO: APPRO, CAPACITE: CAPACITE, LIB: LIB,
    taches: taches, planifier: planifier, prevision: prevision, ecartsLots: ecartsLots, prochainOuvre: prochainOuvre, joursOuvres: joursOuvres, avancements: avancements, besoinsTache: besoinsTache, consommations: consommations, alertes: alertes, situation: situation, tresorerie: tresorerie, pctPrevu: pctPrevu };
})();
if (typeof module !== "undefined") module.exports = PLAN;
