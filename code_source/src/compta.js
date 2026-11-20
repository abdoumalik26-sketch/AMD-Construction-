/* =========================================================
   TABAX — Comptabilité simplifiée (onglets de « Finances et comptabilité »)
   · Régime fiscal (CGU / réel) : TVA appliquée ou non sur devis et factures
   · Journal de caisse et de banque, rempli automatiquement
   · Frais généraux de l'entreprise et marge nette par chantier
   · TVA du mois (régime réel) / suivi du seuil CGU
   · Résultat de l'année expliqué simplement + dossier Excel pour le comptable
   Les comptes SYSCOHADA indiqués sont indicatifs : à valider par un comptable.
   ========================================================= */
var COMPTA = (function () {
  var X = APP.X, PL = PLAN, esc = X.esc, fmt = X.fmt, inp = X.inp;
  var $ = function (id) { return document.getElementById(id); };
  function S() { return X.S(); }
  function fr(s) { return PL.fr(s); }
  function n(v) { v = parseFloat(v); return isFinite(v) ? v : 0; }
  function today() { return PL.d2s(new Date()); }
  function badge(niv, t) { return '<span class="badge ' + niv + '">' + esc(t) + "</span>"; }
  function C() { var s = S(); s.compta = s.compta || {}; var c = s.compta; c.fg = c.fg || []; c.tvaDecl = c.tvaDecl || {}; c.soldes = c.soldes || {}; c.annee = c.annee || today().slice(0, 4); return c; }
  var REGIMES = [["reel", "Régime du réel (TVA 18 % facturée et reversée chaque mois)"], ["cgu", "Contribution Globale Unique – CGU (pas de TVA sur les factures)"]];
  var CATS = [
    ["loyer", "Loyer bureau / dépôt", "6222"], ["energie", "Électricité, eau", "605"], ["carburant", "Carburant", "6053"], ["telecom", "Téléphone, internet", "628"],
    ["assurance", "Assurances", "625"], ["entretien", "Entretien véhicules et matériel", "624"], ["location", "Location de matériel", "6222"], ["fournitures", "Fournitures de bureau", "6055"],
    ["honoraires", "Honoraires (comptable, juriste…)", "6324"], ["banque", "Frais bancaires et mobile money", "631"], ["transport", "Transports et déplacements", "618"],
    ["pub", "Publicité, site, cartes de visite", "627"], ["salaires", "Salaires du bureau", "661"], ["social", "Charges sociales (IPRES, CSS)", "664"], ["impots", "Impôts et taxes", "64"], ["divers", "Autres frais", "658"]
  ];
  function libCat(k) { var c = CATS.filter(function (x) { return x[0] === k; })[0]; return c || CATS[CATS.length - 1]; }
  function compteTreso(mode) { return /esp/i.test(mode || "") ? ["571", "Caisse"] : /wave|orange|mobile/i.test(mode || "") ? ["521", "Mobile money"] : ["521", "Banque"]; }

  /* ---------------- Régime fiscal ---------------- */
  function estCGU() { return S().ent.regime === "cgu"; }
  function changerRegime(r) {
    var e = S().ent;
    if (r === "cgu" && e.regime !== "cgu") { e.tvaReel = n(e.tva) || 18; e.tva = 0; }
    if (r !== "cgu" && e.regime === "cgu") e.tva = n(e.tvaReel) || 18;
    e.regime = r;
  }
  function mentionTVA() { return estCGU() ? "TVA non applicable : entreprise relevant de la Contribution Globale Unique (CGU)." : ""; }
  function regimeHTML() {
    var e = S().ent, ca = caAnnuelTTC(today().slice(0, 4));
    return '<div class="card"><h2>Régime fiscal</h2><div class="form"><label class="f"><span>Régime de l\'entreprise</span><select id="regSel">' + REGIMES.map(function (r) { return '<option value="' + r[0] + '"' + ((e.regime || "reel") === r[0] ? " selected" : "") + ">" + esc(r[1]) + "</option>"; }).join("") + '</select></label></div>' +
      '<p class="hint">' + (estCGU() ? "Vos devis et factures sont établis <b>sans TVA</b>, avec la mention « TVA non applicable (CGU) ». Chiffre d'affaires encaissé cette année : <b>" + fmt(ca) + " FCFA</b> (seuil de la CGU : 50 M FCFA TTC pour une entreprise individuelle de services et travaux)." : "Vos devis et factures comportent la TVA à " + e.tva + " %. La TVA encaissée appartient à l'État : elle est reversée chaque mois (onglet TVA de Finances et comptabilité).") + " Faites confirmer votre régime par le centre des impôts (DGID) ou votre comptable.</p></div>";
  }
  function postRegime() {
    var s = $("regSel"); if (!s) return;
    s.onchange = function () { changerRegime(this.value); X.save(); X.renderPage(); X.toast(this.value === "cgu" ? "Régime CGU : la TVA est retirée des nouveaux devis et factures" : "Régime du réel : TVA " + S().ent.tva + " % appliquée"); };
  }

  /* ---------------- Collecte des mouvements ---------------- */
  function aPayer(d) { return d.type === "situation" ? n(d.net) : n(d.ttc); }
  function mouvements(annee) {
    var s = S(), L = [];
    s.projects.forEach(function (p) {
      if (/exemple/i.test(p.info.nom || "")) return;
      var nomP = p.info.nom, cli = p.info.client || "";
      (p.factu.docs || []).forEach(function (d) {
        var ratioTVA = aPayer(d) > 0 ? n(d.tva) / aPayer(d) : 0;
        (d.paiements || []).forEach(function (x, i) {
          var t = compteTreso(x.mode);
          L.push({ id: "enc-" + p.id + "-" + d.num + "-" + i, date: x.date, piece: d.num, lib: "Encaissement facture " + d.num + (cli ? " – " + cli : ""), chantier: nomP, compte: "705", compteLib: "Travaux facturés", treso: t[0], moyen: x.mode || t[1], recette: n(x.mt), depense: 0, tva: n(x.mt) * ratioTVA, src: "facture" });
        });
      });
      (p.factu.achats || []).forEach(function (a, i) {
        var st = /t[aâ]cheron|sous[- ]?trait|main.d/i.test((a.lib || "") + " " + (a.four || ""));
        L.push({ id: "ach-" + p.id + "-" + i, ref: { p: p, a: a }, date: a.date, piece: "", lib: (a.lib || "Achat") + (a.four ? " – " + a.four : ""), chantier: nomP, compte: st ? "621" : "604", compteLib: st ? "Sous-traitance / tâcherons" : "Achats de matériaux et fournitures", treso: "521", moyen: a.mode || "—", recette: 0, depense: n(a.mt), tva: a.tvaDed ? n(a.mt) * 18 / 118 : 0, tvaDed: !!a.tvaDed, src: "achat" });
      });
      ((p.suivi || {}).rapports || []).forEach(function (r) {
        (r.dep || []).forEach(function (x, i) {
          var carb = /gasoil|gazoil|essence|carburant/i.test(x.lib || "");
          L.push({ id: "cai-" + r.id + "-" + i, date: r.date, piece: "", lib: (x.lib || "Dépense de caisse") + " (caisse chantier" + (r.auteur ? ", " + r.auteur : "") + ")", chantier: nomP, compte: carb ? "6053" : "605", compteLib: carb ? "Carburant" : "Autres achats (caisse chantier)", treso: "571", moyen: "Espèces", recette: 0, depense: n(x.mt), tva: 0, src: "caisse" });
        });
      });
    });
    C().fg.forEach(function (f, i) {
      var c = libCat(f.cat), t = compteTreso(f.mode);
      L.push({ id: "fg-" + i, ref: { fg: f }, date: f.date, piece: f.piece || "", lib: f.lib || c[1], chantier: "Frais généraux", compte: c[2], compteLib: c[1], treso: t[0], moyen: f.mode || t[1], recette: 0, depense: n(f.mt), tva: f.tvaDed ? n(f.mt) * 18 / 118 : 0, tvaDed: !!f.tvaDed, src: "fg" });
    });
    return L.filter(function (x) { return x.date && (!annee || x.date.slice(0, 4) === annee); }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function caAnnuelTTC(annee) { return mouvements(annee).reduce(function (a, x) { return a + x.recette; }, 0); }
  function factureHT(p, annee) {   // chiffre d'affaires HT facturé dans l'année (acomptes + bases HT des situations)
    return (p.factu.docs || []).filter(function (d) { return (d.date || "").slice(0, 4) === annee; }).reduce(function (a, d) { return a + (d.type === "acompte" ? n(d.ht) : d.type === "situation" ? n(d.baseHT) : 0); }, 0);
  }
  function nbMoisFG(an) {   // mois écoulés depuis le premier frais général saisi dans l'année
    var d = C().fg.filter(function (f) { return (f.date || "").slice(0, 4) === an; }).map(function (f) { return f.date; }).sort()[0];
    if (!d) return 1; var fin = an === today().slice(0, 4) ? +today().slice(5, 7) : 12; return Math.max(1, fin - (+d.slice(5, 7)) + 1);
  }
  function annees() { var a = {}; a[today().slice(0, 4)] = 1; mouvements().forEach(function (x) { a[x.date.slice(0, 4)] = 1; }); return Object.keys(a).sort().reverse(); }
  function selAnnee() { var c = C(); return '<label class="hint">Année <select id="cAn">' + annees().map(function (a) { return "<option" + (a === c.annee ? " selected" : "") + ">" + a + "</option>"; }).join("") + "</select></label>"; }

  /* ---------------- Onglet : Journal de caisse et de banque ---------------- */
  function journalHTML() {
    var c = C(), L = mouvements(c.annee), mois = X.ui.cMois || "", Lf = L.filter(function (x) { return !mois || x.date.slice(5, 7) === mois; });
    var rec = Lf.reduce(function (a, x) { return a + x.recette; }, 0), dep = Lf.reduce(function (a, x) { return a + x.depense; }, 0);
    var MOIS = ["", "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    var h = '<div class="card"><h2>Journal de caisse et de banque</h2><p class="hint">Toutes les entrées et sorties d\'argent de l\'entreprise, au même endroit. Il se remplit tout seul avec vos encaissements de factures, vos achats de chantier, les dépenses de caisse des rapports terrain et vos frais généraux. C\'est la base de la comptabilité de trésorerie prévue par l\'OHADA pour les petites entreprises.</p>' +
      '<div class="bar-btn">' + selAnnee() + '<label class="hint">Mois <select id="cMois"><option value="">Toute l\'année</option>' + MOIS.slice(1).map(function (m, i) { var v = ("0" + (i + 1)).slice(-2); return '<option value="' + v + '"' + (v === mois ? " selected" : "") + ">" + m + "</option>"; }).join("") + '</select></label><button class="btn p" id="cXls">Dossier pour le comptable (Excel)</button></div>' +
      '<div class="kpis">' + X.kpi("Entrées d'argent", fmt(rec), "FCFA encaissés") + X.kpi("Sorties d'argent", fmt(dep), "FCFA payés") + X.kpi("Solde de la période", fmt(rec - dep), rec - dep >= 0 ? "plus d'entrées que de sorties" : "plus de sorties que d'entrées") + X.kpi("Opérations", Lf.length, "") + "</div>";
    if (!Lf.length) return h + '<p class="hint">Aucune opération sur cette période. Les encaissements se saisissent dans l\'onglet Factures (colonne « Encaisser »), les achats dans « Dépenses du chantier », les frais du bureau dans « Frais généraux ».</p></div>';
    var solde = 0;
    h += '<div style="overflow-x:auto"><table class="t"><tr><th>Date</th><th class="l">Libellé</th><th class="l">Chantier</th><th class="l">Compte</th><th class="l">Moyen</th><th>Entrée</th><th>Sortie</th><th>Solde cumulé</th></tr>' + Lf.map(function (x) {
      solde += x.recette - x.depense;
      return "<tr><td>" + fr(x.date) + '</td><td class="l small">' + esc(x.lib) + '</td><td class="l small">' + esc(x.chantier) + '</td><td class="l small">' + esc(x.compte + " " + x.compteLib) + '</td><td class="l small">' + esc(x.moyen) + "</td><td>" + (x.recette ? fmt(x.recette) : "") + "</td><td>" + (x.depense ? fmt(x.depense) : "") + "</td><td>" + fmt(solde) + "</td></tr>";
    }).join("") + "</table></div>";
    return h + '<p class="hint">Numéros de comptes SYSCOHADA indicatifs, à faire valider par votre comptable. Le projet exemple est exclu.</p></div>';
  }

  /* ---------------- Onglet : Frais généraux ---------------- */
  function fgHTML() {
    var c = C(), s = S(), an = c.annee, F = c.fg, tot = F.filter(function (f) { return (f.date || "").slice(0, 4) === an; }).reduce(function (a, f) { return a + n(f.mt); }, 0);
    var reels = s.projects.filter(function (p) { return !/exemple/i.test(p.info.nom || ""); });
    var caHT = reels.reduce(function (a, p) { return a + factureHT(p, an); }, 0), taux = caHT > 0 ? tot / caHT : 0;
    var h = '<div class="card"><h2>Frais généraux de l\'entreprise</h2><p class="hint">Ce que coûte l\'entreprise même sans chantier : loyer, téléphone, carburant de votre véhicule, assurance, comptable… Ces frais doivent être couverts par vos chantiers : l\'application calcule la part que chaque chantier doit supporter, pour connaître votre <b>vraie marge</b>.</p>' +
      '<div class="bar-btn">' + selAnnee() + '<button class="btn p" id="fgAdd">+ Ajouter un frais</button></div>' +
      '<div class="kpis">' + X.kpi("Frais généraux " + an, fmt(tot), "FCFA") + X.kpi("Par mois (moyenne)", fmt(tot / nbMoisFG(an)), "FCFA, depuis le premier frais saisi") + X.kpi("Poids sur le chiffre d'affaires", caHT ? fmt(100 * taux, 1) + " %" : "—", caHT ? "à couvrir par la marge des chantiers" : "aucune facture cette année") + X.kpi("Coefficient frais généraux (Paramètres)", s.ent.fg + " %", "utilisé dans vos prix") + "</div>";
    if (caHT && Math.abs(100 * taux - n(s.ent.fg)) > 3) h += '<div class="note">Vos frais généraux réels représentent <b>' + fmt(100 * taux, 1) + " %</b> de votre chiffre d'affaires, alors que vos prix en prévoient <b>" + s.ent.fg + " %</b> (Paramètres › coefficient K). " + (100 * taux > n(s.ent.fg) ? "Vos prix sont trop bas pour couvrir vos frais : augmentez le coefficient frais généraux." : "Vous avez de la marge de manœuvre sur vos prix.") + "</div>";
    h += '<div style="overflow-x:auto"><table class="t edit"><tr><th>Date</th><th class="l">Nature</th><th class="l">Libellé</th><th>Montant payé</th><th class="l">Moyen</th><th>Facture avec TVA</th><th></th></tr>' + F.map(function (f, i) {
      if ((f.date || "").slice(0, 4) !== an) return "";
      var b = "compta.fg." + i;
      return '<tr><td><input type="date" data-fgdt="' + i + '" value="' + esc(f.date || "") + '"></td><td class="l"><select data-fgc="' + i + '">' + CATS.map(function (k) { return '<option value="' + k[0] + '"' + (f.cat === k[0] ? " selected" : "") + ">" + esc(k[1]) + "</option>"; }).join("") + '</select></td><td class="l"><input type="text" data-fgl="' + i + '" value="' + esc(f.lib || "") + '"></td><td><input type="number" data-fgm="' + i + '" value="' + (f.mt || "") + '" style="width:110px"></td><td class="l"><select data-fgmo="' + i + '">' + ["Espèces", "Virement", "Wave", "Orange Money", "Chèque"].map(function (m) { return "<option" + (f.mode === m ? " selected" : "") + ">" + m + "</option>"; }).join("") + '</select></td><td><input type="checkbox" data-fgt="' + i + '"' + (f.tvaDed ? " checked" : "") + '></td><td><button class="x" data-fgd="' + i + '">✕</button></td></tr>';
    }).join("") + "</table></div></div>";
    // marge nette par chantier
    var lignes = reels.map(function (p) {
      var ca = factureHT(p, an), dir = mouvements(an).filter(function (x) { return x.chantier === p.info.nom && x.depense; }).reduce(function (a, x) { return a + x.depense; }, 0);
      return { nom: p.info.nom, ca: ca, dir: dir, fg: ca * taux, net: ca - dir - ca * taux };
    }).filter(function (x) { return x.ca || x.dir; });
    h += '<div class="card"><h2>Marge nette par chantier (' + an + ")</h2>" + (lignes.length ? '<table class="t"><tr><th class="l">Chantier</th><th>Facturé HT</th><th>Dépenses directes</th><th>Part de frais généraux</th><th>Marge nette</th></tr>' + lignes.map(function (x) { return '<tr><td class="l">' + esc(x.nom) + "</td><td>" + fmt(x.ca) + "</td><td>" + fmt(x.dir) + "</td><td>" + fmt(x.fg) + "</td><td><b>" + fmt(x.net) + "</b> " + (x.ca ? (x.net >= 0 ? badge("vert", fmt(100 * x.net / x.ca, 1) + " %") : badge("rouge", fmt(100 * x.net / x.ca, 1) + " %")) : "") + "</td></tr>"; }).join("") + '</table><p class="hint">Marge nette = facturé HT − dépenses payées pour le chantier − part des frais généraux (au prorata du chiffre d\'affaires). Les dépenses d\'un chantier en cours peuvent être en avance sur sa facturation.</p>' : '<p class="hint">Aucune facture ni dépense de chantier cette année.</p>') + "</div>";
    return h;
  }

  /* ---------------- Onglet : TVA ---------------- */
  function tvaHTML() {
    var c = C(), an = c.annee, s = S();
    if (estCGU()) {
      var ca = caAnnuelTTC(an), pct = 100 * ca / 50e6;
      return '<div class="card"><h2>TVA</h2>' + regimeHTML() + '<div class="kpis">' + X.kpi("Encaissé en " + an, fmt(ca), "FCFA TTC") + X.kpi("Seuil de la CGU", "50 M FCFA", "TTC par an") + X.kpi("Utilisation du seuil", fmt(pct, 0) + " %", pct >= 80 ? "attention, vous approchez du seuil" : "") + "</div>" +
        (pct >= 80 ? '<div class="note">Vous approchez du seuil de la CGU. Au-delà, vous passerez au régime du réel : TVA 18 % sur vos factures et déclaration mensuelle. Parlez-en dès maintenant à votre comptable.</div>' : "") + "</div>";
    }
    var L = mouvements(an), mois = {};
    L.forEach(function (x) { var m = x.date.slice(0, 7); mois[m] = mois[m] || { col: 0, ded: 0 }; if (x.recette) mois[m].col += x.tva; else mois[m].ded += x.tva; });
    var ks = Object.keys(mois).sort();
    var h = regimeHTML() + '<div class="card"><h2>TVA à reverser</h2><p class="hint">La TVA que vos clients vous paient n\'est pas à vous : vous la reversez à l\'État chaque mois, avant le 15 du mois suivant, en déduisant la TVA que vous avez vous-même payée sur des factures en règle. Conseil : mettez-la de côté sur un compte séparé dès l\'encaissement.</p><div class="bar-btn">' + selAnnee() + "</div>";
    h += '<table class="t"><tr><th class="l">Mois</th><th>TVA encaissée</th><th>TVA payée récupérable</th><th>À reverser</th><th>Date limite</th><th>Déclarée</th></tr>' + (ks.length ? ks.map(function (m) {
      var x = mois[m], due = Math.max(0, x.col - x.ded), lim = PL.addDays(PL.addDays(m + "-01", 32).slice(0, 7) + "-01", 14), decl = !!c.tvaDecl[m], retard = !decl && due > 0 && today() > lim;
      return '<tr><td class="l">' + m.slice(5) + "/" + m.slice(0, 4) + "</td><td>" + fmt(x.col) + "</td><td>" + fmt(x.ded) + "</td><td><b>" + fmt(due) + "</b>" + (x.ded > x.col ? ' <span class="hint">(crédit de TVA ' + fmt(x.ded - x.col) + ")</span>" : "") + "</td><td>" + fr(lim) + (retard ? " " + badge("rouge", "en retard") : "") + '</td><td><input type="checkbox" data-tvd="' + m + '"' + (decl ? " checked" : "") + "></td></tr>";
    }).join("") : '<tr><td colspan="6" class="l hint">Aucune opération cette année.</td></tr>') + "</table>";
    var ded = L.filter(function (x) { return x.depense && (x.src === "achat" || x.src === "fg"); });
    h += '<h3 style="margin-top:14px">Dépenses : la facture comporte-t-elle de la TVA récupérable ?</h3><p class="hint">Cochez uniquement les achats faits avec une facture en règle (NINEA du fournisseur, TVA 18 % indiquée). Les dépenses de caisse sans facture ne donnent pas droit à récupération.</p><div style="overflow-x:auto"><table class="t"><tr><th>Date</th><th class="l">Dépense</th><th>Montant TTC</th><th>TVA récupérable</th></tr>' + ded.map(function (x, i) { return "<tr><td>" + fr(x.date) + '</td><td class="l small">' + esc(x.lib) + "</td><td>" + fmt(x.depense) + '</td><td><input type="checkbox" data-tvr="' + i + '"' + (x.tvaDed ? " checked" : "") + "> " + (x.tvaDed ? fmt(x.tva) : "") + "</td></tr>"; }).join("") + "</table></div></div>";
    X.ui._ded = ded;
    return h;
  }

  /* ---------------- Onglet : Résultat de l'année ---------------- */
  function resultatHTML() {
    var c = C(), an = c.annee, L = mouvements(an), s = S();
    var enc = L.reduce(function (a, x) { return a + x.recette; }, 0), dep = L.reduce(function (a, x) { return a + x.depense; }, 0);
    var depCh = L.filter(function (x) { return x.src !== "fg"; }).reduce(function (a, x) { return a + x.depense; }, 0), fg = dep - depCh;
    var tvaCol = L.reduce(function (a, x) { return a + (x.recette ? x.tva : 0); }, 0), tvaDed = L.reduce(function (a, x) { return a + (x.depense ? x.tva : 0); }, 0);
    var res = enc - dep - Math.max(0, tvaCol - tvaDed), sol = c.soldes[an] || {}, depart = n(sol.caisse) + n(sol.banque);
    var creances = 0; s.projects.forEach(function (p) { if (/exemple/i.test(p.info.nom || "")) return; (p.factu.docs || []).forEach(function (d) { var r = aPayer(d) - (d.paiements || []).reduce(function (a, x) { return a + n(x.mt); }, 0); if (r > 1) creances += r; }); });
    var moisFG = fg / nbMoisFG(an), tresoFin = depart + enc - dep;
    // graphique mensuel
    var M = []; for (var i = 1; i <= 12; i++) { var k = an + "-" + ("0" + i).slice(-2); M.push({ e: L.filter(function (x) { return x.date.slice(0, 7) === k; }).reduce(function (a, x) { return a + x.recette; }, 0), d: L.filter(function (x) { return x.date.slice(0, 7) === k; }).reduce(function (a, x) { return a + x.depense; }, 0) }); }
    var mx = Math.max.apply(null, M.map(function (m) { return Math.max(m.e, m.d); }).concat([1])), W = 640, Hh = 140;
    var svg = '<svg viewBox="0 0 ' + W + " " + (Hh + 24) + '" width="100%" style="max-width:680px">' + M.map(function (m, i) { var x = 14 + i * 52, he = Hh * m.e / mx, hd = Hh * m.d / mx; return '<rect x="' + x + '" y="' + (Hh - he) + '" width="20" height="' + he + '" fill="#2b4a8c"><title>Entrées ' + fmt(m.e) + '</title></rect><rect x="' + (x + 22) + '" y="' + (Hh - hd) + '" width="20" height="' + hd + '" fill="#e8892b"><title>Sorties ' + fmt(m.d) + '</title></rect><text x="' + (x + 21) + '" y="' + (Hh + 16) + '" font-size="11" text-anchor="middle" fill="#666">' + ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i] + "</text>"; }).join("") + "</svg>";
    var h = '<div class="card"><h2>Votre année ' + an + ' en clair</h2><div class="bar-btn">' + selAnnee() + '<button class="btn p" id="cXls">Dossier pour le comptable (Excel)</button></div>' +
      '<div class="kpis">' + X.kpi("Argent encaissé", fmt(enc), "FCFA reçus de vos clients") + X.kpi("Argent dépensé", fmt(dep), "chantiers " + fmt(depCh) + " + frais généraux " + fmt(fg)) + (estCGU() ? "" : X.kpi("TVA due à l'État", fmt(Math.max(0, tvaCol - tvaDed)), "incluse dans l'argent encaissé")) + X.kpi("Ce qui vous reste vraiment", fmt(res), res >= 0 ? "résultat de trésorerie" : "vous avez dépensé plus que gagné") + "</div>" + svg + '<p class="hint"><span style="color:#2b4a8c">■</span> entrées · <span style="color:#e8892b">■</span> sorties, par mois</p></div>';
    var conseils = [];
    if (!estCGU() && tvaCol - tvaDed > 0) conseils.push("Sur l'argent encaissé, " + fmt(tvaCol - tvaDed) + " FCFA de TVA appartiennent à l'État : ne les comptez pas comme votre argent.");
    if (creances > 0) conseils.push("Vos clients vous doivent encore " + fmt(creances) + " FCFA (factures émises non payées) : relancez-les dans l'onglet Factures.");
    if (moisFG > 0) conseils.push("Votre entreprise coûte environ " + fmt(moisFG) + " FCFA par mois de frais généraux. " + (tresoFin > 0 ? "Votre trésorerie estimée couvre environ " + fmt(tresoFin / moisFG, 1) + " mois de ces frais." : ""));
    if (res < 0) conseils.push("Vous avez plus dépensé qu'encaissé : vérifiez que vos acomptes sont bien demandés au démarrage de chaque chantier et que vos prix couvrent vos frais.");
    conseils.push("Gardez toutes vos factures et reçus (photo dans les rapports ou dans Frais généraux) : votre comptable en aura besoin.");
    h += '<div class="card"><h2>Ce qu\'il faut comprendre</h2><ul>' + conseils.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul></div>";
    h += '<div class="card"><h2>Trésorerie</h2><div class="form"><label class="f"><span>Argent en caisse au 1er janvier ' + an + '</span><input type="number" data-sol="caisse" value="' + (sol.caisse || "") + '"></label><label class="f"><span>Argent en banque / mobile money au 1er janvier ' + an + '</span><input type="number" data-sol="banque" value="' + (sol.banque || "") + '"></label></div>' +
      '<div class="kpis">' + X.kpi("Trésorerie de départ", fmt(depart), "FCFA") + X.kpi("Trésorerie estimée aujourd'hui", fmt(tresoFin), "départ + entrées − sorties") + X.kpi("Factures non encore payées", fmt(creances), "FCFA à recevoir") + "</div>" +
      '<p class="hint">Comptabilité de trésorerie simplifiée (entrées et sorties d\'argent), adaptée aux petites entreprises. Elle ne remplace pas les états financiers établis par un comptable (bilan, compte de résultat SYSCOHADA), mais elle lui fournit un dossier propre.</p></div>';
    return h;
  }

  /* ---------------- Export Excel pour le comptable ---------------- */
  function exporter() {
    if (typeof XLSX === "undefined") { X.toast("Export indisponible"); return; }
    var c = C(), an = c.annee, L = mouvements(an), s = S(), wb = XLSX.utils.book_new();
    var j = [["Date", "Pièce", "Libellé", "Chantier", "Compte", "Intitulé du compte", "Compte de trésorerie", "Moyen", "Entrée (FCFA)", "Sortie (FCFA)", "Dont TVA"]];
    L.forEach(function (x) { j.push([fr(x.date), x.piece, x.lib, x.chantier, x.compte, x.compteLib, x.treso, x.moyen, Math.round(x.recette) || "", Math.round(x.depense) || "", Math.round(x.tva) || ""]); });
    var ws = XLSX.utils.aoa_to_sheet(j); ws["!cols"] = [{ wch: 11 }, { wch: 12 }, { wch: 50 }, { wch: 24 }, { wch: 8 }, { wch: 34 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 11 }];
    XLSX.utils.book_append_sheet(wb, ws, "Journal");
    var rc = {}; L.forEach(function (x) { var k = x.compte + " " + x.compteLib; rc[k] = rc[k] || [0, 0]; rc[k][0] += x.recette; rc[k][1] += x.depense; });
    var r = [["Compte", "Entrées", "Sorties"]]; Object.keys(rc).sort().forEach(function (k) { r.push([k, Math.round(rc[k][0]), Math.round(rc[k][1])]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), "Récap par compte");
    var f = [["N°", "Date", "Chantier", "Client", "Type", "HT", "TVA", "TTC / net à payer", "Encaissé", "Reste dû"]];
    s.projects.forEach(function (p) { if (/exemple/i.test(p.info.nom || "")) return; (p.factu.docs || []).forEach(function (d) { if ((d.date || "").slice(0, 4) !== an) return; var pay = (d.paiements || []).reduce(function (a, x) { return a + n(x.mt); }, 0); f.push([d.num, fr(d.date), p.info.nom, p.info.client || "", d.type, Math.round(d.type === "situation" ? n(d.baseHT) : n(d.ht)), Math.round(n(d.tva)), Math.round(aPayer(d)), Math.round(pay), Math.round(aPayer(d) - pay)]); }); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(f), "Factures");
    var g = [["Date", "Nature", "Compte", "Libellé", "Montant", "Moyen", "TVA récupérable"]];
    c.fg.forEach(function (x) { if ((x.date || "").slice(0, 4) !== an) return; var k = libCat(x.cat); g.push([fr(x.date), k[1], k[2], x.lib || "", Math.round(n(x.mt)), x.mode || "", x.tvaDed ? "oui" : "non"]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(g), "Frais généraux");
    var info = [["Entreprise", s.ent.nom], ["Responsable", s.ent.responsable], ["NINEA", s.ent.ninea || ""], ["RCCM", s.ent.rccm || ""], ["Régime fiscal", estCGU() ? "CGU" : "Réel (TVA " + s.ent.tva + " %)"], ["Exercice", an], ["Établi le", fr(today())], ["", ""], ["Comptes SYSCOHADA indicatifs, générés par TABAX : à valider par le comptable.", ""]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), "Informations");
    X.saveFile(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Dossier_comptable_" + an + "_" + X.slug(s.ent.nom) + ".xlsx");
  }

  /* ---------------- Liaison ---------------- */
  function post(sub) {
    var c = C(), b;
    if ((b = $("cAn"))) b.onchange = function () { c.annee = this.value; X.save(); X.renderPage(); };
    if ((b = $("cMois"))) b.onchange = function () { X.ui.cMois = this.value; X.renderPage(); };
    document.querySelectorAll("#cXls").forEach(function (el) { el.onclick = exporter; });
    postRegime();
    if (sub === "fg") {
      $("fgAdd").onclick = function () { c.fg.push({ date: today(), cat: "carburant", lib: "", mt: 0, mode: "Espèces", tvaDed: false }); X.save(); X.renderPage(); };
      var maj = function (sel, fn) { document.querySelectorAll(sel).forEach(function (el) { el.onchange = function () { fn(c.fg[+Object.values(el.dataset)[0]], el); X.save(); if (el.type !== "text") X.renderPage(); }; }); };
      maj("[data-fgc]", function (f, el) { f.cat = el.value; }); maj("[data-fgl]", function (f, el) { f.lib = el.value; }); maj("[data-fgm]", function (f, el) { f.mt = n(el.value); });
      maj("[data-fgmo]", function (f, el) { f.mode = el.value; }); maj("[data-fgdt]", function (f, el) { f.date = el.value; }); maj("[data-fgt]", function (f, el) { f.tvaDed = el.checked; });
      document.querySelectorAll("[data-fgd]").forEach(function (el) { el.onclick = function () { c.fg.splice(+el.dataset.fgd, 1); X.save(); X.renderPage(); }; });
    }
    if (sub === "tva") {
      document.querySelectorAll("[data-tvd]").forEach(function (el) { el.onchange = function () { if (el.checked) c.tvaDecl[el.dataset.tvd] = today(); else delete c.tvaDecl[el.dataset.tvd]; X.save(); X.renderPage(); }; });
      document.querySelectorAll("[data-tvr]").forEach(function (el) { el.onchange = function () { var x = X.ui._ded[+el.dataset.tvr], r = x.ref; if (r.a) r.a.tvaDed = el.checked; if (r.fg) r.fg.tvaDed = el.checked; X.save(); X.renderPage(); }; });
    }
    if (sub === "bilan") document.querySelectorAll("[data-sol]").forEach(function (el) { el.onchange = function () { c.soldes[c.annee] = c.soldes[c.annee] || {}; c.soldes[c.annee][el.dataset.sol] = n(el.value); X.save(); X.renderPage(); }; });
  }
  // Alertes pour le tableau de bord
  function alertesHTML() {
    var c = C(), out = [], j = today(), m = PL.addDays(j.slice(0, 7) + "-01", -1).slice(0, 7);
    if (!estCGU()) {
      var L = mouvements(m.slice(0, 4)).filter(function (x) { return x.date.slice(0, 7) === m; }), due = L.reduce(function (a, x) { return a + (x.recette ? x.tva : -x.tva); }, 0);
      if (due > 0 && !c.tvaDecl[m]) out.push("TVA de " + m.slice(5) + "/" + m.slice(0, 4) + " à déclarer et reverser avant le 15 : " + fmt(due) + " FCFA (Finances et comptabilité › TVA).");
    } else { var ca = caAnnuelTTC(j.slice(0, 4)); if (ca >= 40e6) out.push("Vous avez encaissé " + fmt(ca) + " FCFA cette année : vous approchez du seuil de la CGU (50 M FCFA). Voyez votre comptable."); }
    return out.length ? '<div class="note">' + out.map(esc).join("<br>") + "</div>" : "";
  }
  var TABS = [["journal", "Journal de caisse"], ["fg", "Frais généraux"], ["tva", "TVA"], ["bilan", "Résultat de l'année"]];
  function page(sub) { return ({ journal: journalHTML, fg: fgHTML, tva: tvaHTML, bilan: resultatHTML }[sub] || journalHTML)(); }
  return { TABS: TABS, page: page, post: post, regimeHTML: regimeHTML, postRegime: postRegime, mentionTVA: mentionTVA, estCGU: estCGU, changerRegime: changerRegime, mouvements: mouvements, alertesHTML: alertesHTML, exporter: exporter };
})();
