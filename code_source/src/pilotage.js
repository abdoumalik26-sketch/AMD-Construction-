/* =========================================================
   2AM CONSTRUCTION — Pilotage avancé
   · Sauvegarde automatique (dossier choisi, avec photos)
   · Archives (base de données des chantiers) et REX automatique
   · Apprentissage : prix, productivités et pertes recalés sur vos chantiers
   · Risque de délai (simulation Monte-Carlo P50 / P80 / P90)
   · Comparateur de fournisseurs
   · Envoi WhatsApp et relances de paiement
   ========================================================= */
var PIL = (function () {
  var X = APP.X, Cc = CALC, PL = PLAN, D = DATA, esc = X.esc, fmt = X.fmt, inp = X.inp, fld = X.fld;
  var $ = function (id) { return document.getElementById(id); };
  function S() { return X.S(); }
  function P() { return X.P(); }
  function fr(s) { return PL.fr(s); }
  function today() { return PL.d2s(new Date()); }
  function n(v) { v = parseFloat(v); return isFinite(v) ? v : 0; }
  function badge(niv, t) { return '<span class="badge ' + niv + '">' + esc(t) + "</span>"; }
  function moy(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : 0; }
  var LIBM = { MAC: "Maçons", FER: "Ferrailleurs", COFR: "Coffreurs", MAN: "Manœuvres", CARR: "Carreleurs", PEIN: "Peintres", PLOM: "Plombiers", ELEC: "Électriciens", MEN: "Menuisiers", ETANC: "Étancheurs" };

  /* =====================================================
     1. SAUVEGARDE AUTOMATIQUE
     ===================================================== */
  var BK = { handle: null, etat: "aucun", sale: false, t: null, dernier: 0, enCours: false };
  var supporte = typeof window !== "undefined" && "showDirectoryPicker" in window;
  function complet() {
    return X.photoAll().then(function (ph) { return { type: "sauvegarde2AM", version: X.VERSION, date: new Date().toISOString(), state: S(), photos: ph }; });
  }
  function nomFichier() { return "2AM_sauvegarde_" + today() + ".json"; }
  function initSauvegarde() {
    if (!supporte) return;
    X.kvGet("dirHandle").then(function (h) {
      if (!h) return;
      BK.handle = h;
      try { h.queryPermission({ mode: "readwrite" }).then(function (st) { BK.etat = st === "granted" ? "actif" : "a-reactiver"; rafraichir(); }); } catch (e) { BK.etat = "a-reactiver"; }
    });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && BK.sale) ecrire(); });
  }
  function rafraichir() { if (X.ui.page === "dash" || X.ui.page === "params") X.renderPage(); }
  function choisirDossier() {
    if (!supporte) { X.toast("Votre navigateur ne permet pas la sauvegarde automatique : utilisez Edge ou Chrome sur ordinateur"); return; }
    window.showDirectoryPicker({ id: "sauvegarde2AM", mode: "readwrite" }).then(function (h) {
      BK.handle = h; BK.etat = "actif"; X.kvPut("dirHandle", h); S().sauvegarde.dossier = h.name; X.save();
      ecrire(true).then(function () { X.toast("Sauvegarde automatique activée dans « " + h.name + " »"); rafraichir(); });
    }).catch(function () {});
  }
  function reactiver() {
    if (!BK.handle) return choisirDossier();
    BK.handle.requestPermission({ mode: "readwrite" }).then(function (st) {
      BK.etat = st === "granted" ? "actif" : "a-reactiver";
      if (BK.etat === "actif") ecrire(true).then(function () { X.toast("Sauvegarde automatique réactivée"); rafraichir(); });
    }).catch(function () {});
  }
  function apresEnregistrement() {
    BK.sale = true;
    if (BK.etat !== "actif") return;
    clearTimeout(BK.t);
    var attente = Math.max(20000, 10 * 60 * 1000 - (Date.now() - BK.dernier));   // au plus une écriture toutes les 10 min
    BK.t = setTimeout(ecrire, attente);
  }
  function ecrire(force) {
    if (!BK.handle || BK.etat !== "actif" || BK.enCours) return Promise.resolve(false);
    if (!force && !BK.sale) return Promise.resolve(false);
    BK.enCours = true;
    return complet().then(function (obj) {
      return BK.handle.getFileHandle(nomFichier(), { create: true }).then(function (fh) {
        return fh.createWritable().then(function (w) { return w.write(JSON.stringify(obj)).then(function () { return w.close(); }); });
      });
    }).then(function () {
      BK.sale = false; BK.dernier = Date.now(); S().sauvegarde.derniere = new Date().toISOString(); S().sauvegarde.dossier = BK.handle.name;
      return nettoyer();
    }).then(function () { BK.enCours = false; return true; }, function () { BK.enCours = false; BK.etat = "a-reactiver"; return false; });
  }
  function nettoyer() {   // garde les 21 dernières sauvegardes quotidiennes
    var noms = [], it;
    try { it = BK.handle.keys(); } catch (e) { return Promise.resolve(); }
    function suiv() { return it.next().then(function (r) { if (r.done) return; if (/^2AM_sauvegarde_\d{4}-\d{2}-\d{2}\.json$/.test(r.value)) noms.push(r.value); return suiv(); }); }
    return suiv().then(function () { noms.sort(); var trop = noms.slice(0, Math.max(0, noms.length - 21)); return Promise.all(trop.map(function (nm) { return BK.handle.removeEntry(nm).catch(function () {}); })); }).catch(function () {});
  }
  function exporter() {
    complet().then(function (obj) { X.saveFile(new Blob([JSON.stringify(obj)], { type: "application/json" }), nomFichier()); S().sauvegarde.derniere = new Date().toISOString(); S().sauvegarde.export = today(); X.save(); });
  }
  function importer(o) {   // accepte l'ancien format (état seul) et le nouveau (état + photos)
    var st = o.type === "sauvegarde2AM" ? o.state : o, ph = o.type === "sauvegarde2AM" ? o.photos || {} : {};
    if (!st || !st.projects) return Promise.reject("format");
    return Promise.all(Object.keys(ph).map(function (k) { return X.photoPut(k, ph[k]); })).then(function () { X.setStateRaw(st); X.save(); X.renderTop(); X.renderPage(); return st.projects.length; });
  }
  function sauvegardeHTML() {
    var sv = S().sauvegarde, d = sv.derniere ? new Date(sv.derniere) : null;
    var etat = BK.etat === "actif" ? badge("vert", "Active") + " dans le dossier « " + esc(BK.handle.name) + " »" : BK.etat === "a-reactiver" ? badge("orange", "À réactiver") + " (le navigateur redemande l'autorisation après un redémarrage)" : supporte ? badge("rouge", "Non configurée") : badge("orange", "Non disponible sur ce navigateur");
    return '<div class="card"><h2>Sauvegardes</h2><p>Sauvegarde automatique : ' + etat + "</p><p class=\"hint\">Dernière sauvegarde complète : " + (d ? d.toLocaleString("fr-FR") : "jamais") + ". Elle contient tous vos projets, archives, paramètres <b>et les photos</b>. Une sauvegarde par jour est gardée, les 21 dernières sont conservées.</p>" +
      '<p class="hint"><b>Conseil :</b> choisissez un dossier synchronisé avec OneDrive ou Google Drive. Vous aurez ainsi une copie en ligne, même si l\'ordinateur est perdu ou en panne.</p>' +
      '<div class="bar-btn">' + (supporte ? '<button class="btn p" id="bkChoisir">' + (BK.handle ? "Changer de dossier" : "Choisir le dossier de sauvegarde automatique") + "</button>" + (BK.etat === "a-reactiver" ? '<button class="btn p" id="bkActiver">Réactiver</button>' : "") + (BK.etat === "actif" ? '<button class="btn" id="bkMaint">Sauvegarder maintenant</button>' : "") : "") +
      '<button class="btn" id="expJ">Télécharger une sauvegarde complète</button><label class="btn">Restaurer une sauvegarde<input type="file" id="impJ" accept=".json,application/json" hidden></label><button class="btn danger" id="rstAll">Tout réinitialiser</button></div></div>';
  }
  function postSauvegarde() {
    var b;
    if ((b = $("bkMaint"))) b.onclick = function () { ecrire(true).then(function (ok) { X.toast(ok ? "Sauvegarde enregistrée" : "Sauvegarde impossible : réactivez-la"); X.renderPage(); }); };
    $("expJ").onclick = exporter;
    $("impJ").onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (t) { return importer(JSON.parse(t)); }).then(function (nb) { X.toast("Sauvegarde restaurée : " + nb + " projet(s)"); }, function () { X.toast("Fichier invalide"); });
    };
  }
  function dashHTML() {
    var sv = S().sauvegarde, h = "";
    if (BK.etat === "a-reactiver") h += '<div class="note">La sauvegarde automatique est en pause (le navigateur redemande l\'autorisation). <button class="btn sm p" id="bkActiver">Réactiver la sauvegarde</button></div>';
    else if (BK.etat !== "actif") {
      var age = sv.derniere ? PL.diff(sv.derniere.slice(0, 10), today()) : null;
      if (age == null || age > 7) h += '<div class="note"><b>Vos données ne sont enregistrées que sur cet ordinateur.</b> ' + (age == null ? "Aucune sauvegarde n'a encore été faite." : "Dernière sauvegarde il y a " + age + " jours.") + " " + (supporte ? '<button class="btn sm p" id="bkChoisir">Activer la sauvegarde automatique</button>' : '<a href="#" data-go="params">Télécharger une sauvegarde</a>') + "</div>";
    }
    return h;
  }

  /* =====================================================
     2. ENVOI WHATSAPP ET RELANCES
     ===================================================== */
  function numeroWA(tel) {
    var d = String(tel || "").replace(/[^\d+]/g, "");
    if (d.indexOf("+") === 0) return d.slice(1);
    if (d.indexOf("00") === 0) return d.slice(2);
    if (d.length === 9 && /^[37]/.test(d)) return "221" + d;           // numéro sénégalais
    if (d.length === 10 && d[0] === "0") return "33" + d.slice(1);       // numéro français
    return d;
  }
  function envoyer(genererPDF, tel, msg) { X.ui.envoi = { tel: tel, msg: msg }; genererPDF(); }
  function partagerFichier(blob, nom, env) {
    var file = null;
    try { file = new File([blob], nom, { type: blob.type || "application/pdf" }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], text: env.msg, title: nom }).catch(function () {});
      return;
    }
    X.saveFile(blob, nom);
    var num = numeroWA(env.tel), url = "https://wa.me/" + num + "?text=" + encodeURIComponent(env.msg);
    setTimeout(function () { window.open(url, "_blank"); }, 400);
    X.toast(num ? "PDF téléchargé : joignez-le dans la conversation WhatsApp qui s'ouvre" : "PDF téléchargé : numéro du client absent (fiche projet)");
  }
  function messageFacture(p, d, relance) {
    var e = S().ent, du = d.type === "situation" ? d.net : d.ttc, paye = (d.paiements || []).reduce(function (s, x) { return s + n(x.mt); }, 0), ech = PL.addDays(d.date, n(e.delaiPaiement) || 30);
    var c = p.info.client ? " " + p.info.client : "";
    if (!relance) return "Bonjour" + c + ", veuillez trouver ci-joint la facture n° " + d.num + " du " + fr(d.date) + " d'un montant de " + fmt(du) + " FCFA, payable avant le " + fr(ech) + ". " + (e.paiementInfo || "") + " Cordialement, " + e.responsable + " – " + e.nom + ".";
    return "Bonjour" + c + ", sauf erreur de notre part, la facture n° " + d.num + " du " + fr(d.date) + " (chantier « " + p.info.nom + " ») reste à régler pour un montant de " + fmt(du - paye) + " FCFA ; son échéance était le " + fr(ech) + ". Merci de procéder au règlement dès que possible. " + (e.paiementInfo || "") + " Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce message. Cordialement, " + e.responsable + " – " + e.nom + ".";
  }

  /* =====================================================
     3. REX AUTOMATIQUE
     ===================================================== */
  function depensesReelles(p) {
    var caisse = (p.suivi.rapports || []).reduce(function (s, r) { return s + (r.dep || []).reduce(function (a, d) { return a + n(d.mt); }, 0); }, 0);
    return caisse + (p.factu.achats || []).reduce(function (s, a) { return s + n(a.mt); }, 0);
  }
  function calculerREX(p) {
    var st = X.ST(), q = Cc.dqe(p, st), rcp = p.reception || {}, fin0 = (rcp.decision !== "refus" && rcp.date) || p.dateReception || today();
    var F = PL.prevision(p, q, fin0), av = F.av || {}, cfg = F.cfg, prodUt = Object.assign({}, S().ent.productivite || {});
    var debutReel = null, finReelle = null;
    F.taches.forEach(function (t) { var a = av[t.id]; if (a && a.debut && (!debutReel || a.debut < debutReel)) debutReel = a.debut; if (a && a.fin && (!finReelle || a.fin > finReelle)) finReelle = a.fin; });
    if (rcp.date && rcp.decision !== "refus") finReelle = rcp.date;
    var promis = p.info.dateLivraison || F.refFin;
    // Tâches : durée prévue vs réelle (jours ouvrés)
    var taches = F.taches.filter(function (t) { var a = av[t.id]; return a && a.debut && a.fin && t.dur > 0 && !/^(INST|RECEP)$/.test(t.id); }).map(function (t) {
      var a = av[t.id], dr = Math.max(1, PL.joursOuvres(a.debut, a.fin, cfg)), f = t.metier ? n(prodUt[t.metier]) || 1 : 1;
      return { id: t.id, nom: t.nom, metier: t.metier, prevu: t.dur, reel: dr, ratio: dr / t.dur, ratioBase: dr / t.dur * f };
    });
    // Main-d'œuvre : journées déclarées vs théoriques (si les rapports couvrent assez de jours)
    var raps = p.suivi.rapports || [], jours = debutReel && finReelle ? Math.max(1, PL.joursOuvres(debutReel, finReelle, cfg)) : 1;
    var couverture = Math.min(1, raps.length / jours), reel = {}, theo = {}, mo = [];
    raps.forEach(function (r) { Object.keys(r.eff || {}).forEach(function (k) { reel[k] = (reel[k] || 0) + n(r.eff[k]); }); });
    F.taches.forEach(function (t) { Object.keys(t.mo || {}).forEach(function (k) { theo[k] = (theo[k] || 0) + t.mo[k] * t.pct / 100; }); });
    Object.keys(LIBM).forEach(function (k) {
      var f = n(prodUt[k]) || 1, tr = taches.filter(function (x) { return x.metier === k; });
      var r = null, src = "", rj = theo[k] >= 5 && reel[k] > 0 ? reel[k] / theo[k] : null;
      // garde-fou : un rapport journées très éloigné de 1 signale des effectifs mal déclarés → on se rabat sur les durées
      if (couverture >= 0.6 && rj != null && rj >= 0.6 && rj <= 1.8) { r = rj; src = "journées déclarées"; }
      else if (tr.length) { r = moy(tr.map(function (x) { return x.ratio; })); src = "durées des tâches" + (rj != null ? " (effectifs déclarés peu fiables)" : ""); }
      if (r != null) mo.push({ code: k, nom: LIBM[k], theo: theo[k] || 0, reel: reel[k] || 0, ratio: r, ratioBase: r * f, source: src });
    });
    // Matériaux : consommations déclarées vs théoriques (pertes comprises)
    var cons = PL.consommations(p), th = {}, mat = [];
    F.taches.forEach(function (t) { var b = PL.besoinsTache(t, q); Object.keys(b).forEach(function (k) { th[k] = (th[k] || 0) + b[k] * t.pct / 100; }); });
    Object.keys(cons).forEach(function (k) {
      var c = n(cons[k]) * (k === "CIM" ? 1 / 20 : 1), t = n(th[k]), r = q.cat.res[k];
      if (c > 0 && t > 0 && r) mat.push({ code: k, nom: r.d, u: r.u, theo: t, reel: c, ratio: c / t, perteUt: r.perte, multBase: c / t * (1 + r.perte / 100), fiable: c / t >= 0.7 && c / t <= 1.6 });
    });
    // Prix d'achat réels vs bibliothèque
    var coef = q.cat.coef || 1, pr = {};
    (p.factu.achats || []).forEach(function (a) { if (a.res && n(a.qte) > 0 && n(a.mt) > 0 && q.cat.res[a.res]) { (pr[a.res] = pr[a.res] || []).push(n(a.mt) / n(a.qte)); } });
    var prix = Object.keys(pr).map(function (k) { var r = q.cat.res[k], m = moy(pr[k]); return { code: k, nom: r.d, u: r.u, biblio: r.p, reel: m, ratio: m / r.p, dakar: m / coef, n: pr[k].length }; });
    // Finances
    var docs = p.factu.docs || [], sits = docs.filter(function (d) { return d.type === "situation"; });
    var factureHT = sits.length ? n(sits[sits.length - 1].cumulHT) : 0, marcheHT = p.factu.marche ? n(p.factu.marche.ht) : q.ht;
    var ca = factureHT > 0 ? factureHT : marcheHT * F.avancement / 100, dep = depensesReelles(p), depComplet = dep >= 0.6 * q.ds * F.avancement / 100;
    var encaisse = docs.reduce(function (s, d) { return s + (d.paiements || []).reduce(function (a, x) { return a + n(x.mt); }, 0); }, 0);
    var res = {
      date: today(), version: X.VERSION, region: p.info.region, mode: p.mode, public: (p.marche || {}).type === "public", surface: q.surface,
      dates: { etude: p.info.date, creation: (p.created || "").slice(0, 10), debutPrevu: cfg.debut, debutReel: debutReel, finPrevue: F.refFin, finReelle: finReelle, promis: promis, reception: rcp.date || "" },
      ecartDelai: finReelle && promis ? PL.diff(promis, finReelle) : null, dureeReelle: debutReel && finReelle ? PL.diff(debutReel, finReelle) : null, dureePrevue: F.refFin ? PL.diff(cfg.debut, F.refFin) : null,
      avancement: F.avancement, taches: taches, mo: mo, couverture: couverture, mat: mat, prix: prix, prodUtilisee: prodUt,
      fin: { marcheHT: marcheHT, factureHT: factureHT, ca: ca, dsPrevu: q.ds, depenses: dep, margePrevue: q.ht - q.ds, margePrevuePct: q.ht ? 100 * (q.ht - q.ds) / q.ht : 0, margeReelle: depComplet ? ca - dep : null, margeReellePct: depComplet && ca ? 100 * (ca - dep) / ca : null, depComplet: depComplet, encaisse: encaisse },
      qualite: { reserves: (p.opc.reserves || []).length, reservesOuvertes: (p.opc.reserves || []).filter(function (r) { return !r.levee; }).length, incidents: raps.filter(function (r) { return r.incidents; }).length, rapports: raps.length },
      notes: (p.rex && p.rex.notes) || { positif: "", negatif: "", actions: "" }
    };
    res.conclusions = conclusions(res);
    return res;
  }
  function conclusions(r) {
    var c = [];
    if (r.ecartDelai != null) c.push(r.ecartDelai > 0 ? "Livré avec " + r.ecartDelai + " jours de retard sur la date promise." : "Livré à l'heure" + (r.ecartDelai < 0 ? ", avec " + (-r.ecartDelai) + " jours d'avance." : "."));
    r.mo.forEach(function (m) { if (Math.abs(m.ratio - 1) >= 0.12) c.push(m.nom + " : " + (m.ratio > 1 ? Math.round(100 * (m.ratio - 1)) + " % plus lents" : Math.round(100 * (1 - m.ratio)) + " % plus rapides") + " que prévu (" + m.source + ")."); });
    r.mat.forEach(function (m) { if (!m.fiable) c.push(m.nom + " : consommation déclarée très éloignée du théorique (" + Math.round(100 * m.ratio) + " %) — déclarations probablement incomplètes, non utilisée pour l'apprentissage."); else if (Math.abs(m.ratio - 1) >= 0.08) c.push(m.nom + " : consommation " + (m.ratio > 1 ? "+" : "") + Math.round(100 * (m.ratio - 1)) + " % par rapport au théorique."); });
    r.prix.forEach(function (x) { if (Math.abs(x.ratio - 1) >= 0.05) c.push(x.nom + " : payé " + fmt(x.reel) + " FCFA/" + x.u + ", soit " + (x.ratio > 1 ? "+" : "") + Math.round(100 * (x.ratio - 1)) + " % par rapport à la bibliothèque."); });
    if (!r.fin.depComplet && r.fin.depenses > 0) c.push("Dépenses saisies incomplètes (" + fmt(r.fin.depenses) + " FCFA pour " + fmt(r.fin.dsPrevu) + " FCFA de déboursé prévu) : marge réelle non calculée. Saisissez tous les achats et paiements de tâcherons.");
    if (r.fin.margeReellePct != null) c.push("Marge réelle " + fmt(r.fin.margeReellePct, 1) + " % pour " + fmt(r.fin.margePrevuePct, 1) + " % prévue.");
    if (r.qualite.reserves) c.push(r.qualite.reserves + " réserve(s) à la réception" + (r.qualite.reservesOuvertes ? ", dont " + r.qualite.reservesOuvertes + " encore ouverte(s)." : ", toutes levées."));
    if (r.couverture < 0.6) c.push("Rapports terrain incomplets (" + Math.round(100 * r.couverture) + " % des jours couverts) : le REX est moins précis. Demandez un rapport par jour de travail.");
    return c;
  }
  function cloturer(p) {
    p.rex = calculerREX(p); p.statut = "termine"; p.archive = true; p.dateArchive = today();
    if (!p.dateReception && p.reception && p.reception.date && p.reception.decision !== "refus") p.dateReception = p.reception.date;
  }

  /* =====================================================
     4. APPRENTISSAGE
     ===================================================== */
  var K_PRIOR = 2;   // poids de la valeur de référence (équivaut à 2 chantiers)
  function wmoy(obs, prior, kp) { var sw = kp, sv = kp * prior; obs.forEach(function (o) { sw += o.w; sv += o.w * o.v; }); return sv / sw; }
  function suggestions() {
    var s = S(), out = [], rexs = s.projects.filter(function (p) { return p.rex; }), EXT = window.OUT ? OUT.observations() : { prod: {}, prix: {} };
    // Productivité par métier
    Object.keys(LIBM).forEach(function (k) {
      var obs = []; rexs.forEach(function (p) { p.rex.mo.forEach(function (m) { if (m.code === k) obs.push({ v: Math.min(1.8, Math.max(0.6, m.ratioBase)), w: 1 }); }); });
      (EXT.prod[k] || []).forEach(function (o) { obs.push({ v: Math.min(1.8, Math.max(0.6, o.v)), w: o.w, ext: 1 }); });
      if (!obs.length) return;
      var est = wmoy(obs, 1, K_PRIOR), cur = n(s.ent.productivite[k]) || 1;
      out.push({ cle: "prod:" + k, type: "Productivité", nom: LIBM[k], u: "coef. temps", cur: cur, obs: obs.map(function (o) { return o.v; }), next: obs.filter(function (o) { return o.ext; }).length, prop: Math.round(est * 100) / 100, effet: "Durées et coût de main-d'œuvre × " + (Math.round(est * 100) / 100).toFixed(2) + " (1 = cadence théorique)" });
    });
    // Pertes matériaux
    var mats = {}; rexs.forEach(function (p) { p.rex.mat.forEach(function (m) { if (m.fiable !== false) (mats[m.code] = mats[m.code] || []).push(m.multBase); }); });
    Object.keys(mats).forEach(function (k) {
      var row = s.res.filter(function (r) { return r[0] === k; })[0]; if (!row) return;
      var base = D.RES.filter(function (r) { return r[0] === k; })[0], p0 = base ? base[5] : row[5], obs = mats[k];
      var est = (obs.reduce(function (a, b) { return a + b; }, 0) + K_PRIOR * (1 + p0 / 100)) / (obs.length + K_PRIOR), prop = Math.max(0, Math.round((est - 1) * 100));
      out.push({ cle: "perte:" + k, type: "Pertes", nom: row[1], u: "% de perte", cur: row[5], obs: obs.map(function (x) { return Math.round((x - 1) * 100); }), prop: prop, effet: "Quantités commandées et prix des ouvrages qui l'utilisent" });
    });
    // Prix d'achat (tous chantiers, archivés ou non) ramenés à Dakar
    var px = {};
    s.projects.forEach(function (p) {
      var coef = (D.REGIONS[p.info.region] || [1])[0];
      (p.factu.achats || []).forEach(function (a) { if (a.res && n(a.qte) > 0 && n(a.mt) > 0) (px[a.res] = px[a.res] || []).push({ v: n(a.mt) / n(a.qte) / coef, d: a.date || "", w: 1 }); });
    });
    Object.keys(EXT.prix).forEach(function (k) { px[k] = px[k] || []; });
    Object.keys(px).forEach(function (k) {
      var row = s.res.filter(function (r) { return r[0] === k; })[0]; if (!row) return;
      var obs = px[k].sort(function (a, b) { return a.d < b.d ? 1 : -1; }).slice(0, 6);   // 6 achats les plus récents
      var ex = (EXT.prix[k] || []).slice().sort(function (a, b) { return a.d < b.d ? 1 : -1; }).slice(0, 10).map(function (o) { return { v: o.v, w: o.w, d: o.d, ext: 1 }; });
      obs = obs.concat(ex); if (!obs.length) return;
      var est = wmoy(obs, row[3], 1);
      out.push({ cle: "prix:" + k, type: "Prix", nom: row[1], u: "FCFA/" + row[2] + " (base Dakar)", cur: row[3], obs: obs.map(function (x) { return Math.round(x.v); }), next: ex.length, prop: Math.round(est), effet: "Prix des ouvrages et des devis" });
    });
    return out.filter(function (x) { return Math.abs(x.prop / (x.cur || 1) - 1) >= 0.03 && !s.appr.ignore[x.cle + "=" + x.prop]; });
  }
  function appliquer(sg) {
    var s = S(), a = sg.cle.split(":"), avant = sg.cur;
    if (a[0] === "prod") s.ent.productivite[a[1]] = sg.prop;
    if (a[0] === "perte" || a[0] === "prix") s.res.forEach(function (r) { if (r[0] === a[1]) { if (a[0] === "perte") r[5] = sg.prop; else r[3] = sg.prop; } });
    s.appr.journal.unshift({ date: today(), cle: sg.cle, nom: sg.type + " · " + sg.nom, avant: avant, apres: sg.prop, n: sg.obs.length });
  }
  function annuler(i) {
    var s = S(), j = s.appr.journal[i], a = j.cle.split(":");
    if (a[0] === "prod") { if (j.avant === 1) delete s.ent.productivite[a[1]]; else s.ent.productivite[a[1]] = j.avant; }
    else s.res.forEach(function (r) { if (r[0] === a[1]) { if (a[0] === "perte") r[5] = j.avant; else r[3] = j.avant; } });
    s.appr.journal.splice(i, 1);
  }
  // Dispersion apprise des durées (pour la simulation de risque)
  function dispersion() {
    var l = []; S().projects.forEach(function (p) { if (p.rex) p.rex.taches.forEach(function (t) { if (t.ratioBase > 0) l.push(Math.log(t.ratioBase)); }); });
    if (l.length < 5) return { sigma: 0.2, n: l.length, appris: false };
    var m = moy(l), v = moy(l.map(function (x) { return (x - m) * (x - m); }));
    return { sigma: Math.min(0.6, Math.max(0.08, Math.sqrt(v))), n: l.length, appris: true };
  }

  /* =====================================================
     5. RISQUE DE DÉLAI (Monte-Carlo)
     ===================================================== */
  function gauss() { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function simuler(p, N) {
    var q = Cc.dqe(p, X.ST()), j = today(), enCours = p.statut === "chantier";
    var F = enCours ? PL.prevision(p, q, j) : null, base = PL.planifier(p, q), T = enCours ? F.taches : base.taches, cfg = base.cfg, disp = dispersion();
    var depart = enCours && j > cfg.debut ? j : cfg.debut, fins = [];
    for (var it = 0; it < N; it++) {
      var fin = {}, maxFin = depart;
      T.forEach(function (t) {
        var pct = enCours ? t.pct || 0 : 0;
        if (pct >= 100) { fin[t.id] = t.pFin || t.fin; if (fin[t.id] > maxFin) maxFin = fin[t.id]; return; }
        var req = depart;
        t.deps.forEach(function (d) { var e = fin[d[0]]; if (e) { var r2 = PL.addDays(e, 1 + d[1]); if (r2 > req) req = r2; } });
        if (pct > 0) req = depart;   // tâche déjà commencée : le reste démarre aujourd'hui
        var f = Math.exp(gauss() * disp.sigma), dur = t.dur * (1 - pct / 100) * f;
        if ((t.appro || t.ext) && Math.random() < 0.12) req = PL.addDays(req, 2 + Math.floor(Math.random() * 9));   // aléa : livraison, absence, panne
        var e = PL.finTravail(PL.prochainOuvre(req, cfg), Math.max(0.5, dur), t.ext, cfg);
        fin[t.id] = e; if (e > maxFin) maxFin = e;
      });
      fins.push(maxFin);
    }
    fins.sort();
    var pc = function (x) { return fins[Math.min(N - 1, Math.floor(x * N))]; }, liv = p.info.dateLivraison;
    return { p50: pc(0.5), p80: pc(0.8), p90: pc(0.9), min: fins[0], max: fins[N - 1], fins: fins, proba: liv ? fins.filter(function (f) { return f <= liv; }).length / N : null, liv: liv, prevu: enCours ? F.fin : base.fin, disp: disp, enCours: enCours };
  }
  var CACHE_RISQUE = {};
  function risqueHTML(p) {
    var cle = p.id + JSON.stringify([p.planning, p.info.dateLivraison, p.statut, (p.suivi.rapports || []).length, p.opc.avValide, S().ent.productivite]);
    var r = CACHE_RISQUE[cle] || (CACHE_RISQUE = {}, CACHE_RISQUE[cle] = simuler(p, 300));
    if (r.min === r.max) return '<div class="card"><h2>Date de livraison réaliste</h2><p>Il ne reste que la réception : fin prévue le <b>' + fr(r.p50) + "</b>.</p></div>";
    var d0 = r.min, nj = Math.max(1, PL.diff(d0, r.max)), W = 640, H = 90, bins = new Array(30).fill(0);
    r.fins.forEach(function (f) { bins[Math.min(29, Math.floor(29 * PL.diff(d0, f) / nj))]++; });
    var mx = Math.max.apply(null, bins), xd = function (d) { return 10 + (W - 20) * PL.diff(d0, d) / nj; };
    var svg = '<svg viewBox="0 0 ' + W + " " + (H + 18) + '" width="100%" style="max-width:640px">' + bins.map(function (b, i) { var x = 10 + (W - 20) * i / 30; return '<rect x="' + x + '" y="' + (H - H * b / mx) + '" width="' + ((W - 20) / 30 - 2) + '" height="' + (H * b / mx) + '" fill="#c9d3ea"/>'; }).join("");
    [["P50", r.p50, "#1b2c5c"], ["P80", r.p80, "#e8892b"]].forEach(function (x) { svg += '<line x1="' + xd(x[1]) + '" x2="' + xd(x[1]) + '" y1="0" y2="' + H + '" stroke="' + x[2] + '" stroke-width="2"/><text x="' + (xd(x[1]) + 3) + '" y="11" font-size="11" fill="' + x[2] + '">' + x[0] + "</text>"; });
    if (r.liv && r.liv >= d0 && r.liv <= r.max) svg += '<line x1="' + xd(r.liv) + '" x2="' + xd(r.liv) + '" y1="0" y2="' + H + '" stroke="#c0392b" stroke-dasharray="4 3" stroke-width="2"/><text x="' + (xd(r.liv) + 3) + '" y="' + (H - 4) + '" font-size="11" fill="#c0392b">promis</text>';
    svg += '<text x="10" y="' + (H + 15) + '" font-size="11" fill="#777">' + fr(r.min) + '</text><text x="' + (W - 10) + '" y="' + (H + 15) + '" font-size="11" fill="#777" text-anchor="end">' + fr(r.max) + "</text></svg>";
    var niv = r.proba == null ? null : r.proba >= 0.8 ? "vert" : r.proba >= 0.5 ? "orange" : "rouge";
    var h = '<div class="card"><h2>Date de livraison réaliste' + (r.enCours ? " (à partir de l'avancement réel)" : "") + "</h2>" +
      '<div class="kpis">' + X.kpi("Fin probable (P50)", fr(r.p50), "1 chance sur 2 de finir avant") + X.kpi("Fin sûre à 80 % (P80)", fr(r.p80), "date conseillée à promettre au client") + X.kpi("Fin sûre à 90 % (P90)", fr(r.p90), "en cas d'imprévus nombreux") +
      X.kpi("Chances de tenir la date promise", r.proba == null ? "—" : Math.round(100 * r.proba) + " %", r.liv ? "promis le " + fr(r.liv) : "date de livraison à renseigner dans Projets") + "</div>" + svg +
      (niv === "rouge" ? '<div class="note rouge">Moins d\'une chance sur deux de tenir la date promise. Renforcez les équipes des tâches critiques, travaillez le samedi, ou proposez au client le ' + fr(r.p80) + ".</div>" : niv === "orange" ? '<div class="note">La date promise est tenable mais fragile : surveillez les tâches critiques et anticipez les commandes.</div>' : "") +
      '<p class="hint">300 simulations du chantier : durée de chaque tâche variable (dispersion ' + (r.disp.appris ? "apprise sur " + r.disp.n + " tâches de vos chantiers archivés" : "par défaut, en attendant vos REX") + "), aléas de livraison et d'absences, hivernage et jours ouvrés. Le planning déterministe donne le " + fr(r.prevu) + ".</p></div>";
    return h;
  }

  /* =====================================================
     6. FOURNISSEURS
     ===================================================== */
  function fournisseursHTML() {
    var s = S(), parMat = {};
    s.projects.forEach(function (p) {
      (p.factu.achats || []).forEach(function (a) {
        if (!a.res || !a.four || !(n(a.qte) > 0)) return;
        var m = parMat[a.res] = parMat[a.res] || {}, f = m[a.four.trim()] = m[a.four.trim()] || { pu: [], delai: [], dernier: null, dpu: 0, mt: 0 };
        var pu = n(a.mt) / n(a.qte); f.pu.push(pu); f.mt += n(a.mt); if (n(a.delai) > 0) f.delai.push(n(a.delai));
        if (!f.dernier || (a.date || "") > f.dernier) { f.dernier = a.date || ""; f.dpu = pu; }
      });
    });
    var ks = Object.keys(parMat);
    var h = '<div class="card"><h2>Comparateur de fournisseurs (tous chantiers)</h2>';
    if (!ks.length) return h + '<p class="hint">Aucun achat renseigné avec matériau et quantité. Dans Finances et comptabilité › Dépenses du chantier, indiquez pour chaque achat le matériau et la quantité : les prix réels de chaque fournisseur apparaîtront ici.</p></div>';
    ks.forEach(function (k) {
      var r = s.res.filter(function (x) { return x[0] === k; })[0], m = parMat[k], fs = Object.keys(m).sort(function (a, b) { return moy(m[a].pu) - moy(m[b].pu); });
      h += "<h3 style=\"margin:12px 0 4px\">" + esc(r ? r[1] : k) + ' <span class="hint">(bibliothèque : ' + fmt(r ? r[3] : 0) + " FCFA/" + esc(r ? r[2] : "") + ' à Dakar)</span></h3><table class="t"><tr><th class="l">Fournisseur</th><th>Achats</th><th>P.U. moyen</th><th>Dernier P.U.</th><th>Délai moyen</th><th>Montant total</th></tr>' +
        fs.map(function (f, i) { var x = m[f]; return '<tr><td class="l">' + esc(f) + (i === 0 && fs.length > 1 ? " " + badge("vert", "le moins cher") : "") + "</td><td>" + x.pu.length + "</td><td>" + fmt(moy(x.pu)) + "</td><td>" + fmt(x.dpu) + (x.dernier ? ' <span class="hint">' + fr(x.dernier) + "</span>" : "") + "</td><td>" + (x.delai.length ? fmt(moy(x.delai), 1) + " j" : "—") + "</td><td>" + fmt(x.mt) + "</td></tr>"; }).join("") + "</table>";
    });
    return h + "</div>";
  }

  /* =====================================================
     7. PAGE ARCHIVES, REX ET APPRENTISSAGE
     ===================================================== */
  function anneeDe(p) { var r = p.rex; return ((r && (r.dates.finReelle || r.dates.reception)) || p.dateArchive || p.info.date || "").slice(0, 4); }
  function typeDe(p) { return (p.mode === "rapide" ? "Petits travaux" : "Chantier") + ((p.marche || {}).type === "public" ? " public" : ""); }
  function pageArchives() {
    X.ui.sub.archives = X.ui.sub.archives || "base";
    var h = '<div class="head"><h1>Archives, REX et apprentissage</h1><p>Chaque chantier clôturé est archivé avec ses dates, ses montants et son retour d\'expérience (REX), calculé automatiquement. L\'application en tire des corrections de prix, de cadences et de pertes, que vous validez.</p></div>';
    h += X.tabs("archives", [["base", "Archives"], ["rex", "REX du projet actif"], ["appr", "Apprentissage" + (suggestions().length ? " (" + suggestions().length + ")" : "")], ["ext", "Données externes"]]);
    return h + ({ base: arcBase, rex: arcRex, appr: arcAppr, ext: function () { return window.OUT ? OUT.externesHTML() : ""; } }[X.ui.sub.archives] || arcBase)();
  }
  function filtres() { X.ui.arc = X.ui.arc || { an: "", type: "", region: "", txt: "" }; return X.ui.arc; }
  function arcBase() {
    var s = S(), f = filtres(), arch = s.projects.filter(function (p) { return p.archive; });
    var liste = arch.filter(function (p) { var t = (p.info.nom + " " + p.info.client + " " + p.info.ville).toLowerCase(); return (!f.an || anneeDe(p) === f.an) && (!f.type || typeDe(p) === f.type) && (!f.region || p.info.region === f.region) && (!f.txt || t.indexOf(f.txt.toLowerCase()) >= 0); });
    var aClot = s.projects.filter(function (p) { return !p.archive && (p.statut === "termine" || p.statut === "chantier"); });
    var h = "";
    if (aClot.length) h += '<div class="card"><h2>Chantiers à clôturer</h2><p class="hint">À la fin d\'un chantier (après le PV de réception) : « Clôturer et archiver » calcule le REX et range le projet dans les archives. Vous pourrez toujours le rouvrir.</p><table class="t"><tr><th class="l">Projet</th><th class="l">Statut</th><th>Réception</th><th></th></tr>' +
      aClot.map(function (p) { return '<tr><td class="l">' + esc(p.info.nom) + '</td><td class="l">' + (p.statut === "termine" ? "Terminé" : "En cours") + "</td><td>" + (p.reception && p.reception.date && p.statut === "termine" ? fr(p.reception.date) : "—") + '</td><td><button class="btn sm' + (p.statut === "termine" ? " p" : "") + '" data-clot="' + p.id + '">Clôturer et archiver</button></td></tr>'; }).join("") + "</table></div>";
    var R = liste.map(function (p) { return p.rex; }).filter(Boolean), aLh = R.filter(function (r) { return r.ecartDelai != null; });
    var ca = R.reduce(function (a, r) { return a + n(r.fin.ca); }, 0), mg = R.filter(function (r) { return r.fin.margeReellePct != null; });
    h += '<div class="kpis">' + X.kpi("Chantiers archivés", liste.length + (liste.length !== arch.length ? " / " + arch.length : ""), "selon les filtres") + X.kpi("Chiffre d'affaires", fmt(ca / 1e6, 1) + " M", "FCFA HT réalisés") +
      X.kpi("Marge réelle moyenne", mg.length ? fmt(moy(mg.map(function (r) { return r.fin.margeReellePct; })), 1) + " %" : "—", mg.length ? "sur " + mg.length + " chantier(s) avec dépenses saisies" : "dépenses à saisir") +
      X.kpi("Livrés à l'heure", aLh.length ? Math.round(100 * aLh.filter(function (r) { return r.ecartDelai <= 0; }).length / aLh.length) + " %" : "—", aLh.length ? "retard moyen " + fmt(moy(aLh.map(function (r) { return Math.max(0, r.ecartDelai); })), 1) + " j" : "") + "</div>";
    var ans = arch.map(anneeDe).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort().reverse(), types = arch.map(typeDe).filter(function (x, i, a) { return a.indexOf(x) === i; });
    h += '<div class="card"><div class="bar-btn"><label>Année <select data-af="an"><option value="">Toutes</option>' + ans.map(function (a) { return "<option" + (a === f.an ? " selected" : "") + ">" + a + "</option>"; }).join("") + '</select></label><label>Type <select data-af="type"><option value="">Tous</option>' + types.map(function (a) { return "<option" + (a === f.type ? " selected" : "") + ">" + esc(a) + "</option>"; }).join("") + '</select></label><label>Région <select data-af="region"><option value="">Toutes</option>' + Object.keys(D.REGIONS).map(function (a) { return "<option" + (a === f.region ? " selected" : "") + ">" + a + "</option>"; }).join("") + '</select></label><input type="text" data-af="txt" placeholder="Rechercher (nom, client, ville)" value="' + esc(f.txt) + '"><button class="btn" id="csvArc">Exporter en tableur (CSV)</button></div>';
    if (!liste.length) h += '<p class="hint">' + (arch.length ? "Aucun chantier ne correspond aux filtres." : "Aucun chantier archivé pour l'instant. Ils apparaîtront ici au fur et à mesure de vos clôtures.") + "</p>";
    else h += '<table class="t"><tr><th class="l">Projet</th><th class="l">Client</th><th class="l">Lieu</th><th class="l">Type</th><th>Étude</th><th>Début réel</th><th>Fin réelle</th><th>Promis</th><th>Écart délai</th><th>Montant HT</th><th>Marge réelle</th><th></th></tr>' +
      liste.map(function (p) {
        var r = p.rex || { dates: {}, fin: {} }, d = r.dates, e = r.ecartDelai;
        return '<tr><td class="l"><b>' + esc(p.info.nom) + '</b></td><td class="l">' + esc(p.info.client) + '</td><td class="l">' + esc(p.info.ville || p.info.region) + '</td><td class="l">' + esc(typeDe(p)) + "</td><td>" + fr(d.etude) + "</td><td>" + fr(d.debutReel) + "</td><td>" + fr(d.finReelle) + "</td><td>" + fr(d.promis) + "</td><td>" + (e == null ? "—" : e > 0 ? badge("rouge", "+" + e + " j") : badge("vert", e === 0 ? "à l'heure" : e + " j")) + "</td><td>" + fmt(r.fin.marcheHT) + "</td><td>" + (r.fin.margeReellePct == null ? "—" : fmt(r.fin.margeReellePct, 1) + " %") + '</td><td><button class="btn sm" data-arex="' + p.id + '">REX</button> <button class="btn sm" data-aouv="' + p.id + '">Ouvrir</button> <button class="btn sm" data-arouv="' + p.id + '">Désarchiver</button></td></tr>';
      }).join("") + "</table>";
    return h + "</div>";
  }
  function csvArchives() {
    var lignes = [["Projet", "Client", "Ville", "Région", "Type", "Date étude", "Début prévu", "Début réel", "Fin prévue", "Fin réelle", "Livraison promise", "Écart délai (j)", "Marché HT", "Facturé HT", "Dépenses", "Marge prévue %", "Marge réelle %", "Surface m2", "Réserves", "Rapports terrain"]];
    S().projects.filter(function (p) { return p.archive; }).forEach(function (p) {
      var r = p.rex || { dates: {}, fin: {}, qualite: {} }, d = r.dates;
      lignes.push([p.info.nom, p.info.client, p.info.ville, p.info.region, typeDe(p), d.etude, d.debutPrevu, d.debutReel, d.finPrevue, d.finReelle, d.promis, r.ecartDelai, Math.round(n(r.fin.marcheHT)), Math.round(n(r.fin.factureHT)), Math.round(n(r.fin.depenses)), r.fin.margePrevuePct != null ? r.fin.margePrevuePct.toFixed(1) : "", r.fin.margeReellePct != null ? r.fin.margeReellePct.toFixed(1) : "", Math.round(n(r.surface)), r.qualite.reserves, r.qualite.rapports]);
    });
    var csv = "﻿" + lignes.map(function (l) { return l.map(function (v) { v = v == null ? "" : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(";"); }).join("\r\n");
    X.saveFile(new Blob([csv], { type: "text/csv" }), "Archives_2AM_" + today() + ".csv");
  }
  function arcRex() {
    var p = P(), r = p.rex;
    var h = '<div class="bar-btn"><button class="btn p" id="rexCalc">' + (r ? "Recalculer le REX" : "Calculer le REX maintenant") + "</button>" + (r ? '<button class="btn" id="rexPdf">Fiche REX (PDF)</button>' : "") + (!p.archive ? '<button class="btn" data-clot="' + p.id + '">Clôturer et archiver</button>' : "") + '<span class="hint">Projet : <b>' + esc(p.info.nom) + "</b>" + (r ? " · REX du " + fr(r.date) : "") + "</span></div>";
    if (!r) return h + '<div class="card"><p>Le REX compare ce qui était prévu à ce qui s\'est réellement passé : dates, durée de chaque tâche, journées de main-d\'œuvre par métier, consommations de matériaux, prix d\'achat, dépenses et marge, réserves.</p><p class="hint">Il se calcule automatiquement à la clôture du chantier. Plus les rapports terrain et les achats sont complets, plus le REX est précis.</p></div>';
    var d = r.dates;
    h += '<div class="kpis">' + X.kpi("Écart sur la date promise", r.ecartDelai == null ? "—" : (r.ecartDelai > 0 ? "+" : "") + r.ecartDelai + " j", "promis " + fr(d.promis) + " · livré " + fr(d.finReelle)) + X.kpi("Durée réelle", r.dureeReelle == null ? "—" : r.dureeReelle + " j", "prévue " + (r.dureePrevue == null ? "—" : r.dureePrevue + " j")) +
      X.kpi("Marge réelle", r.fin.margeReellePct == null ? "—" : fmt(r.fin.margeReellePct, 1) + " %", "prévue " + fmt(r.fin.margePrevuePct, 1) + " %") + X.kpi("Rapports terrain", r.qualite.rapports, Math.round(100 * r.couverture) + " % des jours de chantier couverts") + "</div>";
    h += '<div class="card"><h2>Ce qu\'il faut retenir (calculé automatiquement)</h2>' + (r.conclusions.length ? "<ul>" + r.conclusions.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>" : '<p class="hint">Pas assez de données pour conclure.</p>') + "</div>";
    h += '<div class="card"><h2>Vos observations</h2><label class="f wide"><span>Ce qui a bien marché</span>' + inp("rex.notes.positif", { area: true, rows: 2 }) + '</label><label class="f wide"><span>Ce qui a posé problème</span>' + inp("rex.notes.negatif", { area: true, rows: 2 }) + '</label><label class="f wide"><span>À faire autrement la prochaine fois</span>' + inp("rex.notes.actions", { area: true, rows: 2 }) + "</label></div>";
    h += '<div class="grid2"><div class="card"><h2>Dates</h2><table class="t">' + [["Étude", d.etude], ["Début prévu", d.debutPrevu], ["Début réel", d.debutReel], ["Fin prévue (référence)", d.finPrevue], ["Livraison promise", d.promis], ["Fin réelle / réception", d.finReelle]].map(function (x) { return '<tr><td class="l">' + x[0] + "</td><td>" + fr(x[1]) + "</td></tr>"; }).join("") + "</table></div>" +
      '<div class="card"><h2>Finances (HT)</h2><table class="t">' + [["Marché", r.fin.marcheHT], ["Facturé", r.fin.factureHT], ["Déboursé sec prévu", r.fin.dsPrevu], ["Dépenses réelles", r.fin.depenses], ["Marge réelle", r.fin.margeReelle], ["Encaissé (TTC)", r.fin.encaisse]].map(function (x) { return '<tr><td class="l">' + x[0] + "</td><td>" + (x[1] == null ? "—" : fmt(x[1])) + "</td></tr>"; }).join("") + "</table></div></div>";
    if (r.taches.length) h += '<div class="card"><h2>Durée des tâches (jours ouvrés)</h2><table class="t"><tr><th class="l">Tâche</th><th class="l">Métier</th><th>Prévu</th><th>Réel</th><th>Écart</th></tr>' + r.taches.map(function (t) { return '<tr><td class="l">' + esc(t.nom) + '</td><td class="l">' + esc(LIBM[t.metier] || "—") + "</td><td>" + t.prevu + "</td><td>" + t.reel + "</td><td>" + (t.ratio > 1.1 ? badge("rouge", "+" + Math.round(100 * (t.ratio - 1)) + " %") : t.ratio < 0.9 ? badge("vert", Math.round(100 * (t.ratio - 1)) + " %") : "≈") + "</td></tr>"; }).join("") + "</table></div>";
    if (r.mo.length) h += '<div class="card"><h2>Main-d\'œuvre par métier</h2><table class="t"><tr><th class="l">Métier</th><th>Journées théoriques</th><th>Journées déclarées</th><th>Rapport réel / prévu</th><th class="l">Source</th></tr>' + r.mo.map(function (m) { return '<tr><td class="l">' + esc(m.nom) + "</td><td>" + fmt(m.theo) + "</td><td>" + fmt(m.reel) + "</td><td>" + m.ratio.toFixed(2) + '</td><td class="l">' + esc(m.source) + "</td></tr>"; }).join("") + "</table></div>";
    if (r.mat.length) h += '<div class="card"><h2>Matériaux</h2><table class="t"><tr><th class="l">Matériau</th><th>Théorique</th><th>Consommé</th><th>Écart</th></tr>' + r.mat.map(function (m) { return '<tr><td class="l">' + esc(m.nom) + "</td><td>" + fmt(m.theo, 2) + " " + esc(m.u) + "</td><td>" + fmt(m.reel, 2) + " " + esc(m.u) + "</td><td>" + (m.ratio > 1 ? "+" : "") + Math.round(100 * (m.ratio - 1)) + " %</td></tr>"; }).join("") + "</table></div>";
    if (r.prix.length) h += '<div class="card"><h2>Prix d\'achat réels</h2><table class="t"><tr><th class="l">Matériau</th><th>Bibliothèque</th><th>Payé (moyenne)</th><th>Écart</th><th>Achats</th></tr>' + r.prix.map(function (x) { return '<tr><td class="l">' + esc(x.nom) + "</td><td>" + fmt(x.biblio) + "</td><td>" + fmt(x.reel) + "</td><td>" + (x.ratio > 1 ? "+" : "") + Math.round(100 * (x.ratio - 1)) + " %</td><td>" + x.n + "</td></tr>"; }).join("") + "</table></div>";
    return h;
  }
  function arcAppr() {
    var s = S(), sg = suggestions(), nbRex = s.projects.filter(function (p) { return p.rex; }).length, disp = dispersion();
    var h = '<div class="kpis">' + X.kpi("REX disponibles", nbRex, "chantiers clôturés") + X.kpi("Suggestions", sg.length, "à valider") + X.kpi("Corrections appliquées", s.appr.journal.length, "depuis le début") + X.kpi("Dispersion des durées", disp.appris ? "± " + Math.round(100 * disp.sigma) + " %" : "par défaut", disp.appris ? "apprise sur " + disp.n + " tâches" : "5 tâches mesurées minimum") + "</div>";
    h += '<div class="card"><h2>Comment l\'application apprend</h2><p class="hint">À chaque chantier clôturé, le REX mesure l\'écart entre le prévu et le réel. Les corrections proposées sont <b>prudentes</b> : la valeur actuelle compte comme deux chantiers, donc un seul chantier atypique ne bouleverse pas vos prix. Les prix d\'achat apprennent dès le premier achat renseigné (6 derniers achats, ramenés au prix de Dakar). Rien n\'est modifié sans votre accord. Les marchés déjà figés ne changent pas ; les devis non figés et les plannings sont recalculés.</p></div>';
    h += '<div class="card"><h2>Corrections proposées</h2>' + (sg.length ? '<div class="bar-btn"><button class="btn p" id="apTout">Tout appliquer</button></div><table class="t"><tr><th class="l">Type</th><th class="l">Paramètre</th><th>Actuel</th><th class="l">Observé</th><th>Proposé</th><th class="l">Effet</th><th></th></tr>' + sg.map(function (x, i) {
      return '<tr><td class="l">' + esc(x.type) + '</td><td class="l">' + esc(x.nom) + ' <span class="hint">' + esc(x.u) + "</span></td><td>" + (x.type === "Productivité" ? x.cur.toFixed(2) : fmt(x.cur)) + '</td><td class="l">' + x.obs.slice(0, 8).map(function (v) { return x.type === "Productivité" ? v.toFixed(2) : fmt(v); }).join(" · ") + (x.obs.length > 8 ? " …" : "") + ' <span class="hint">(' + x.obs.length + (x.next ? ", dont " + x.next + " externe(s)" : "") + ")</span></td><td><b>" + (x.type === "Productivité" ? x.prop.toFixed(2) : fmt(x.prop)) + '</b></td><td class="l small">' + esc(x.effet) + '</td><td><button class="btn sm p" data-ap="' + i + '">Appliquer</button> <button class="btn sm" data-ign="' + i + '">Ignorer</button></td></tr>';
    }).join("") + "</table>" : '<p class="hint">Aucune correction à proposer pour le moment. ' + (nbRex ? "Vos paramètres sont cohérents avec vos chantiers." : "Clôturez vos premiers chantiers (avec rapports terrain et achats) pour démarrer l'apprentissage.") + "</p>") + "</div>";
    if (s.appr.journal.length) h += '<div class="card"><h2>Journal des corrections</h2><table class="t"><tr><th>Date</th><th class="l">Paramètre</th><th>Avant</th><th>Après</th><th>Chantiers / achats</th><th></th></tr>' + s.appr.journal.map(function (j, i) { return "<tr><td>" + fr(j.date) + '</td><td class="l">' + esc(j.nom) + "</td><td>" + fmt(j.avant, j.avant < 10 ? 2 : 0) + "</td><td>" + fmt(j.apres, j.apres < 10 ? 2 : 0) + "</td><td>" + j.n + '</td><td><button class="btn sm" data-annul="' + i + '">Annuler</button></td></tr>'; }).join("") + "</table></div>";
    var pr = s.ent.productivite, ks = Object.keys(pr).filter(function (k) { return pr[k] !== 1; });
    if (ks.length) h += '<div class="card"><h2>Cadences apprises en vigueur</h2><p>' + ks.map(function (k) { return esc(LIBM[k] || k) + " : × " + n(pr[k]).toFixed(2); }).join(" · ") + '</p><p class="hint">× 1,20 = ce métier met 20 % de temps de plus que la cadence théorique sur vos chantiers.</p></div>';
    return h;
  }
  function postArchives() {
    X.bindTabs("archives"); X.linkGo();
    if (X.ui.sub.archives === "ext" && window.OUT) return OUT.postExternes();
    var s = S(), b;
    document.querySelectorAll("[data-af]").forEach(function (el) { el.onchange = function () { filtres()[el.dataset.af] = el.value; X.renderPage(); }; });
    document.querySelectorAll("[data-clot]").forEach(function (bt) { bt.onclick = function () {
      if (bt.dataset.c !== "1") { bt.dataset.c = "1"; bt.textContent = "Confirmer la clôture"; return; }
      var p = s.projects.filter(function (x) { return x.id === bt.dataset.clot; })[0]; cloturer(p);
      if (s.active === p.id) { var autre = s.projects.filter(function (x) { return !x.archive; })[0]; if (!autre) { autre = D.projetVide(); s.projects.push(autre); X.setStateRaw(s); s = S(); } s.active = autre.id; }
      X.save(); X.renderTop(); X.ui.sub.archives = "base"; X.renderPage(); X.toast("Chantier clôturé : REX calculé et archivé");
    }; });
    document.querySelectorAll("[data-arex]").forEach(function (bt) { bt.onclick = function () { s.active = bt.dataset.arex; X.save(); X.renderTop(); X.ui.sub.archives = "rex"; X.renderPage(); }; });
    document.querySelectorAll("[data-aouv]").forEach(function (bt) { bt.onclick = function () { s.active = bt.dataset.aouv; X.save(); X.renderTop(); X.go("dash"); X.toast("Projet archivé ouvert en consultation : vous pouvez regénérer tous ses documents"); }; });
    document.querySelectorAll("[data-arouv]").forEach(function (bt) { bt.onclick = function () { var p = s.projects.filter(function (x) { return x.id === bt.dataset.arouv; })[0]; p.archive = false; X.save(); X.renderTop(); X.renderPage(); X.toast("Projet sorti des archives (son REX est conservé)"); }; });
    if ((b = $("csvArc"))) b.onclick = csvArchives;
    if ((b = $("rexCalc"))) b.onclick = function () { var p = P(); p.rex = calculerREX(p); X.save(); X.renderPage(); X.toast("REX calculé"); };
    if ((b = $("rexPdf"))) b.onclick = pdfREX;
    var sg = suggestions();
    document.querySelectorAll("[data-ap]").forEach(function (bt) { bt.onclick = function () { appliquer(sg[+bt.dataset.ap]); X.save(); X.renderPage(); X.toast("Correction appliquée"); }; });
    document.querySelectorAll("[data-ign]").forEach(function (bt) { bt.onclick = function () { var x = sg[+bt.dataset.ign]; s.appr.ignore[x.cle + "=" + x.prop] = 1; X.save(); X.renderPage(); }; });
    if ((b = $("apTout"))) b.onclick = function () { sg.forEach(appliquer); X.save(); X.renderPage(); X.toast(sg.length + " correction(s) appliquée(s)"); };
    document.querySelectorAll("[data-annul]").forEach(function (bt) { bt.onclick = function () { annuler(+bt.dataset.annul); X.save(); X.renderPage(); X.toast("Correction annulée"); }; });
  }
  function pdfREX() {
    var h = APP._pdf().h, p = P(), r = p.rex, doc = h.doc0(), titre = "RETOUR D'EXPÉRIENCE (REX)", sous = "Établi le " + fr(r.date);
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, typeDe(p)), d = r.dates;
    y = h.table(doc, { startY: y, theme: "plain", body: [["Début prévu / réel", fr(d.debutPrevu) + " / " + fr(d.debutReel)], ["Livraison promise / réelle", fr(d.promis) + " / " + fr(d.finReelle)], ["Écart sur la date promise", r.ecartDelai == null ? "-" : r.ecartDelai + " jours"], ["Marché HT / dépenses réelles", fmt(r.fin.marcheHT) + " / " + fmt(r.fin.depenses) + " FCFA"], ["Marge prévue / réelle", fmt(r.fin.margePrevuePct, 1) + " % / " + (r.fin.margeReellePct == null ? "-" : fmt(r.fin.margeReellePct, 1) + " %")], ["Réserves à la réception", r.qualite.reserves + ""]].map(function (x) { return [h.t(x[0]), h.t(x[1])]; }), columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } } }, titre, sous) + 4;
    function bloc(t, txt) { if (!txt) return; if (y > 250) { doc.addPage(); h.header(doc, titre, sous); y = 40; } doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(h.t(t), 14, y); doc.setFont("helvetica", "normal"); doc.setFontSize(9); var l = doc.splitTextToSize(h.t(txt), 182); doc.text(l, 14, y + 5); y += l.length * 4.3 + 9; }
    bloc("Ce qu'il faut retenir", r.conclusions.map(function (c) { return "- " + c; }).join("\n"));
    bloc("Ce qui a bien marché", r.notes.positif); bloc("Ce qui a posé problème", r.notes.negatif); bloc("À faire autrement la prochaine fois", r.notes.actions);
    if (r.taches.length) y = h.table(doc, { startY: y, head: [["Tâche", "Prévu (j)", "Réel (j)", "Écart"]], body: r.taches.map(function (t) { return [h.t(t.nom), t.prevu, t.reel, Math.round(100 * (t.ratio - 1)) + " %"]; }), columnStyles: { 0: { cellWidth: 110 } } }, titre, sous) + 5;
    if (r.mat.length) y = h.table(doc, { startY: y, head: [["Matériau", "Théorique", "Consommé", "Écart"]], body: r.mat.map(function (m) { return [h.t(m.nom), h.t(fmt(m.theo, 2) + " " + m.u), h.t(fmt(m.reel, 2) + " " + m.u), Math.round(100 * (m.ratio - 1)) + " %"]; }), columnStyles: { 0: { cellWidth: 90 } } }, titre, sous) + 5;
    h.footers(doc, "REX"); X.saveFile(doc.output("blob"), "REX_" + X.slug(p.info.nom) + ".pdf");
  }

  /* ---------------- Démarrage ---------------- */
  document.addEventListener("click", function (e) {
    var id = e.target && e.target.id;
    if (id === "bkChoisir") choisirDossier();
    if (id === "bkActiver") reactiver();
  });
  APP.reg("archives", pageArchives, postArchives);
  setTimeout(initSauvegarde, 0);

  return { apresEnregistrement: apresEnregistrement, sauvegardeHTML: sauvegardeHTML, postSauvegarde: postSauvegarde, dashHTML: dashHTML, importer: importer, exporter: exporter,
    envoyer: envoyer, partagerFichier: partagerFichier, messageFacture: messageFacture, numeroWA: numeroWA,
    calculerREX: calculerREX, cloturer: cloturer, suggestions: suggestions, appliquer: appliquer, annuler: annuler, dispersion: dispersion,
    simuler: simuler, risqueHTML: risqueHTML, fournisseursHTML: fournisseursHTML, _bk: BK };
})();
