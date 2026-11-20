/* =========================================================================
   TABAX – Gestion du chantier
   · Tâcherons : contrat, avances, reste à payer, contrat PDF signé à l'écran
     (chaque paiement devient une dépense du chantier → comptabilité, compte 621)
   · Bons de commande fournisseurs (PDF / WhatsApp), réception → stock + dépense
   · Stock du chantier : entrées (livraisons) – sorties (rapports terrain)
   · Matériel et engins : propres ou loués, coût de location, pannes
   · Plans du chantier avec réserves placées sur le plan
   ========================================================================= */
var CHT = (function () {
  "use strict";
  var X = APP.X, PL = PLAN, P = function () { return X.P(); }, S = function () { return X.S(); }, $ = function (id) { return document.getElementById(id); };
  var esc = X.esc, fmt = X.fmt, inp = X.inp;
  function n(v) { v = parseFloat(v); return isFinite(v) ? v : 0; }
  function jour() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function fr(d) { return d ? d.split("-").reverse().join("/") : "-"; }
  function uid(p) { return (p || "i") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function lotNom(id) { var L = DATA.LOTS.filter(function (x) { return x[0] === id; })[0]; return L ? L[1] : ""; }
  function lotSel(path, val) { return '<select data-b="' + path + '" style="max-width:170px"><option value="">— lot —</option>' + DATA.LOTS.map(function (L) { return '<option value="' + L[0] + '"' + (val === L[0] ? " selected" : "") + ">" + esc(L[1]) + "</option>"; }).join("") + "</select>"; }
  function sel(path, val, opts, rr) { return '<select data-b="' + path + '"' + (rr ? ' class="rr"' : "") + ">" + opts.map(function (o) { return '<option value="' + o[0] + '"' + (val === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>"; }
  function badge(c, t) { return '<span class="badge ' + c + '">' + esc(t) + "</span>"; }
  function ensure(p) {
    p.tacherons = p.tacherons || []; p.bons = p.bons || []; p.materiel = p.materiel || []; p.plans = p.plans || [];
    p.stock = p.stock || { mvts: [], seuils: {} }; p.stock.mvts = p.stock.mvts || []; p.stock.seuils = p.stock.seuils || {};
    p.factu = p.factu || {}; p.factu.achats = p.factu.achats || []; p.opc = p.opc || {}; p.opc.reserves = p.opc.reserves || [];
    return p;
  }
  function rerender() { document.querySelectorAll("#content [data-b].rr").forEach(function (el) { el.addEventListener("change", function () { setTimeout(X.renderPage, 0); }); }); }
  function confirmer(b, txt, fn) { if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = txt; return; } fn(); }
  function ajouterDepense(p, o) { p.factu.achats.push(Object.assign({ date: jour(), four: "", lib: "", lot: "", res: "", qte: "", mt: 0, delai: "" }, o)); }
  function pdfH() { return APP._pdf().h; }

  /* =======================================================================
     TÂCHERONS
     ======================================================================= */
  function payeTach(p, id) { return p.factu.achats.filter(function (a) { return a.tach === id; }).reduce(function (s, a) { return s + n(a.mt); }, 0); }
  function montantTach(t) { return t.mode === "unitaire" ? n(t.pu) * n(t.qte) : n(t.montant); }
  function tachHTML() {
    var p = ensure(P()), T = p.tacherons;
    var tot = T.reduce(function (s, t) { return s + montantTach(t); }, 0), pay = T.reduce(function (s, t) { return s + payeTach(p, t.id); }, 0);
    var h = '<div class="card"><h2>Tâcherons et sous-traitants du chantier</h2><p class="hint">Un contrat par tâcheron : prix convenu, avance, paiements au fur et à mesure du travail fait. Chaque paiement saisi ici devient une <b>dépense du chantier</b> (et passe en comptabilité, compte 621). Vous voyez d\'un coup d\'œil si vous avez payé plus que le travail réalisé.</p>' +
      '<div class="kpis">' + X.kpi("Contrats", T.length, "tâcherons sur ce chantier") + X.kpi("Montant des contrats", fmt(tot), "FCFA") + X.kpi("Déjà payé", fmt(pay), "FCFA · " + fmt(tot ? 100 * pay / tot : 0) + " %") + X.kpi("Reste à payer", fmt(tot - pay), "FCFA") + "</div>" +
      '<button class="btn p" id="tAdd">+ Nouveau contrat de tâcheron</button></div>';
    T.forEach(function (t, i) {
      var b = "tacherons." + i, m = montantTach(t), pa = payeTach(p, t.id), pctP = m ? 100 * pa / m : 0, av = n(t.avancement), trop = m > 0 && pctP > av + 5;
      var pays = p.factu.achats.filter(function (a) { return a.tach === t.id; });
      var sg = (p.signatures || {})["tach_" + t.id];
      h += '<div class="card"><h2>' + esc(t.nom || "Tâcheron sans nom") + (t.metier ? ' <span style="font-weight:400;color:#667">· ' + esc(t.metier) + "</span>" : "") + " " + (m && pa >= m - 1 ? badge("vert", "soldé") : trop ? badge("rouge", "payé plus que le travail fait") : "") + "</h2>" +
        '<div class="form">' +
        '<label class="f"><span>Nom et prénom</span>' + inp(b + ".nom", { text: true }) + "</label>" +
        '<label class="f"><span>Téléphone</span>' + inp(b + ".tel", { text: true }) + "</label>" +
        '<label class="f"><span>N° pièce d\'identité (CNI)</span>' + inp(b + ".cni", { text: true }) + "</label>" +
        '<label class="f"><span>Métier</span>' + inp(b + ".metier", { text: true, ph: "Maçon, ferrailleur, carreleur…" }) + "</label>" +
        '<label class="f wide"><span>Travaux confiés</span>' + inp(b + ".objet", { text: true, ph: "Ex. maçonnerie en agglos de 15 du RDC et du R+1" }) + "</label>" +
        '<label class="f"><span>Lot</span>' + lotSel(b + ".lot", t.lot) + "</label>" +
        '<label class="f"><span>Mode de prix</span>' + sel(b + ".mode", t.mode || "forfait", [["forfait", "Forfait (prix global)"], ["unitaire", "Prix unitaire × quantité"]], true) + "</label>" +
        (t.mode === "unitaire" ? '<label class="f"><span>Prix unitaire (FCFA)</span>' + inp(b + ".pu", { cls: "rr" }) + '</label><label class="f"><span>Quantité</span>' + inp(b + ".qte", { cls: "rr" }) + '</label><label class="f"><span>Unité</span>' + inp(b + ".unite", { text: true, ph: "m², ml, u…" }) + "</label>" : '<label class="f"><span>Montant du forfait (FCFA)</span>' + inp(b + ".montant", { cls: "rr" }) + "</label>") +
        '<label class="f"><span>Début</span>' + inp(b + ".debut", { date: true }) + '</label><label class="f"><span>Fin prévue</span>' + inp(b + ".fin", { date: true }) + "</label>" +
        '<label class="f"><span>Avance au démarrage (%)</span>' + inp(b + ".avancePct") + '</label><label class="f"><span>Retenue de garantie (%)</span>' + inp(b + ".retenue") + "</label>" +
        '<label class="f"><span>Pénalité de retard (FCFA / jour)</span>' + inp(b + ".penalite") + "</label>" +
        '<label class="f"><span>Avancement constaté (%)</span>' + inp(b + ".avancement", { cls: "rr" }) + "</label>" +
        "</div>" +
        '<div class="kpis">' + X.kpi("Montant du contrat", fmt(m), "FCFA" + (t.mode === "unitaire" ? " (" + fmt(t.qte) + " " + esc(t.unite || "u") + " × " + fmt(t.pu) + ")" : "")) + X.kpi("Payé", fmt(pa), "FCFA · " + fmt(pctP) + " % du contrat") + X.kpi("Travail fait", fmt(av) + " %", "soit " + fmt(m * av / 100) + " FCFA") + X.kpi("Reste à payer", fmt(m - pa), "FCFA") + "</div>" +
        (trop ? '<div class="note rouge">Vous avez payé <b>' + fmt(pctP) + " %</b> du contrat pour <b>" + fmt(av) + " %</b> de travail fait : ne versez plus rien avant que le travail rattrape les paiements.</div>" : "") +
        '<h3 style="margin:10px 0 4px">Paiements</h3>' + (pays.length ? '<table class="t"><tr><th>Date</th><th class="l">Libellé</th><th>Mode</th><th>Montant</th></tr>' + pays.map(function (a) { return "<tr><td>" + fr(a.date) + '</td><td class="l">' + esc(a.lib) + "</td><td>" + esc(a.mode || "—") + "</td><td>" + fmt(a.mt) + "</td></tr>"; }).join("") + "</table>" : '<p class="hint">Aucun paiement pour l\'instant.</p>') +
        '<div class="bar-btn"><input type="number" min="0" placeholder="Montant (FCFA)" id="tMt' + i + '" style="width:150px"><select id="tMo' + i + '"><option>Espèces</option><option>Wave</option><option>Orange Money</option><option>Virement</option><option>Chèque</option></select><input id="tLi' + i + '" placeholder="' + (pays.length ? "Paiement selon avancement" : "Avance au démarrage") + '" style="width:220px"><button class="btn p" data-tpay="' + i + '">Enregistrer le paiement</button></div>' +
        '<div style="margin-top:8px">' + (window.OUT ? OUT.signatureHTML("tach_" + t.id, "Signature du tâcheron sur le contrat") : "") + "</div>" +
        '<div class="bar-btn"><button class="btn" data-tpdf="' + i + '">Contrat PDF' + (sg ? " (signé)" : "") + '</button><button class="btn" data-twa="' + i + '">Envoyer par WhatsApp</button><button class="btn danger" data-tdel="' + i + '">Supprimer ce contrat</button></div></div>';
    });
    return h;
  }
  function postTach() {
    var p = ensure(P()); rerender(); if (window.OUT) OUT.lierSignatures();
    $("tAdd").onclick = function () { p.tacherons.push({ id: uid("t"), nom: "", tel: "", metier: "", objet: "", lot: "", mode: "forfait", montant: 0, debut: jour(), fin: "", avancePct: 30, retenue: 5, penalite: 0, avancement: 0 }); X.save(); X.renderPage(); };
    document.querySelectorAll("[data-tpay]").forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.tpay, t = p.tacherons[i], mt = n($("tMt" + i).value); if (mt <= 0) return X.toast("Indiquez le montant payé");
        var lib = ($("tLi" + i).value || "").trim() || (payeTach(p, t.id) ? "Paiement selon avancement" : "Avance au démarrage");
        ajouterDepense(p, { four: t.nom, lib: "Tâcheron : " + lib + (t.objet ? " – " + t.objet : ""), lot: t.lot || "", mt: mt, mode: $("tMo" + i).value, tach: t.id });
        X.save(); X.renderPage(); X.toast("Paiement enregistré dans les dépenses du chantier");
      };
    });
    document.querySelectorAll("[data-tdel]").forEach(function (b) { b.onclick = function () { confirmer(b, "Confirmer (les paiements restent dans les dépenses)", function () { p.tacherons.splice(+b.dataset.tdel, 1); X.save(); X.renderPage(); }); }; });
    document.querySelectorAll("[data-tpdf]").forEach(function (b) { b.onclick = function () { pdfContrat(+b.dataset.tpdf); }; });
    document.querySelectorAll("[data-twa]").forEach(function (b) {
      b.onclick = function () {
        var t = p.tacherons[+b.dataset.twa], m = montantTach(t), pa = payeTach(p, t.id);
        var msg = "Bonjour " + (t.nom || "") + ",\nVoici votre contrat pour le chantier « " + p.info.nom + " » : " + (t.objet || "") + ".\nMontant : " + fmt(m) + " FCFA. Déjà payé : " + fmt(pa) + " FCFA. Reste : " + fmt(m - pa) + " FCFA.\n" + S().ent.nom;
        if (window.PIL) PIL.envoyer(function () { pdfContrat(+b.dataset.twa); }, t.tel, msg); else pdfContrat(+b.dataset.twa);
      };
    });
  }
  function pdfContrat(i) {
    var h = pdfH(), p = ensure(P()), t = p.tacherons[i], e = S().ent, doc = h.doc0(), m = montantTach(t), titre = "CONTRAT DE TÂCHERONNAT", sous = p.info.nom;
    h.header(doc, titre, sous); var y = 40;
    var par = function (tit, txt) {
      if (y > 255) { doc.addPage(); h.header(doc, titre, sous); y = 40; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text(h.t(tit), 14, y); y += 4.6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); var L = doc.splitTextToSize(h.t(txt), 182); doc.text(L, 14, y); y += L.length * 4.2 + 3;
    };
    par("Entre les soussignés", "L'entreprise " + e.nom + (e.adresse ? ", " + e.adresse : "") + (e.ninea ? ", NINEA " + e.ninea : "") + (e.rccm ? ", RCCM " + e.rccm : "") + ", représentée par " + (e.responsable || "son gérant") + ", ci-après « l'Entreprise » ;\net " + (t.nom || "…") + (t.cni ? ", CNI n° " + t.cni : "") + (t.tel ? ", téléphone " + t.tel : "") + ", " + (t.metier ? t.metier.toLowerCase() : "tâcheron") + ", ci-après « le Tâcheron ».");
    par("Article 1 – Objet", "L'Entreprise confie au Tâcheron, qui l'accepte, l'exécution des travaux suivants : " + (t.objet || "…") + (t.lot ? " (lot : " + lotNom(t.lot) + ")" : "") + ", sur le chantier « " + p.info.nom + " »" + (p.info.adresse || p.info.ville ? " situé " + [p.info.adresse, p.info.ville].filter(Boolean).join(", ") : "") + ".");
    par("Article 2 – Prix", (t.mode === "unitaire" ? "Les travaux sont rémunérés au prix unitaire de " + fmt(t.pu) + " FCFA par " + (t.unite || "unité") + ", pour une quantité estimée de " + fmt(t.qte) + " " + (t.unite || "unités") + ", soit un montant estimé de " + fmt(m) + " FCFA. Le montant définitif sera calculé sur les quantités réellement exécutées et constatées contradictoirement." : "Les travaux sont rémunérés au forfait, pour un montant global de " + fmt(m) + " FCFA.") + " Ce prix comprend la main-d'œuvre et le petit outillage du Tâcheron. Les matériaux sont fournis par l'Entreprise, sauf accord écrit contraire.");
    par("Article 3 – Délais", "Les travaux commencent le " + fr(t.debut) + (t.fin ? " et doivent être terminés au plus tard le " + fr(t.fin) : "") + ". Le Tâcheron suit le planning et les instructions du chef de chantier." + (n(t.penalite) ? " Tout jour de retard non justifié entraîne une pénalité de " + fmt(t.penalite) + " FCFA, retenue sur les paiements." : ""));
    par("Article 4 – Paiements", (n(t.avancePct) ? "Une avance de " + fmt(t.avancePct) + " % (" + fmt(m * n(t.avancePct) / 100) + " FCFA) est versée au démarrage. " : "") + "Les paiements suivants sont faits selon l'avancement constaté par le chef de chantier, sans pouvoir dépasser la valeur du travail réalisé." + (n(t.retenue) ? " Une retenue de garantie de " + fmt(t.retenue) + " % est conservée jusqu'à la réception des travaux sans réserve." : "") + " Chaque paiement donne lieu à un reçu signé par le Tâcheron.");
    par("Article 5 – Obligations du Tâcheron", "Exécuter les travaux selon les plans, les règles de l'art et les consignes reçues ; reprendre à ses frais tout ouvrage mal exécuté ; respecter les horaires, la propreté du chantier et les consignes de sécurité ; porter et faire porter à son équipe les équipements de protection (casque, chaussures, gants) ; signaler sans délai tout problème ou accident.");
    par("Article 6 – Obligations de l'Entreprise", "Mettre à disposition les plans, les matériaux et l'accès au chantier en temps utile ; constater l'avancement et payer les sommes dues dans les conditions ci-dessus.");
    par("Article 7 – Résiliation et litiges", "En cas de manquement grave, l'une ou l'autre partie peut résilier le contrat après mise en demeure restée sans effet pendant 3 jours ; le travail réellement exécuté est alors payé. Les parties recherchent d'abord un règlement à l'amiable ; à défaut, le litige est porté devant le tribunal compétent du lieu du chantier.");
    var pays = p.factu.achats.filter(function (a) { return a.tach === t.id; });
    if (pays.length) { y = h.table(doc, { startY: y + 1, head: [["Paiements déjà effectués", "Date", "Mode", "Montant (FCFA)"]], body: pays.map(function (a) { return [h.t(a.lib), fr(a.date), h.t(a.mode || "-"), h.f(a.mt)]; }).concat([[{ content: h.t("Reste à payer"), colSpan: 3, styles: { fontStyle: "bold" } }, { content: h.f(m - payeTach(p, t.id)), styles: { fontStyle: "bold" } }]]) }, titre, sous) + 6; }
    if (y > 235) { doc.addPage(); h.header(doc, titre, sous); y = 40; }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(h.t("Fait en deux exemplaires, le " + fr(jour()) + "."), 14, y + 2); y += 8;
    [["Pour l'Entreprise", e.responsable || e.nom], ["Le Tâcheron", t.nom || ""]].forEach(function (c, k) {
      var x = 14 + k * 95; doc.setFont("helvetica", "bold"); doc.text(h.t(c[0]), x + 1, y); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(h.t(c[1] + " (lu et approuvé, signature)"), x + 1, y + 4); doc.setFontSize(9);
      doc.setDrawColor(180, 180, 180); doc.rect(x, y + 7, 87, 28);
      if (window.OUT) { if (k === 0) OUT.signerPDF(doc, x, y + 7, 87, 28, e.signature, e.cachet); else OUT.signerPDF(doc, x, y + 7, 87, 28, ((p.signatures || {})["tach_" + t.id] || {}).img, null); }
    });
    h.footers(doc, titre); X.saveFile(doc.output("blob"), "Contrat_tacheron_" + X.slug(t.nom || "sans_nom") + ".pdf");
  }

  /* =======================================================================
     STOCK, BONS DE COMMANDE, MATÉRIEL
     ======================================================================= */
  var STK = [["CIM", "Ciment", "sacs"], ["HA6", "Fer HA6", "kg"], ["HA8", "Fer HA8", "kg"], ["HA10", "Fer HA10", "kg"], ["HA12", "Fer HA12", "kg"], ["HA14", "Fer HA14", "kg"], ["HA16", "Fer HA16", "kg"], ["SAB", "Sable", "m³"], ["GRA", "Gravier", "m³"], ["AG15", "Agglos de 15", "u"], ["AG10", "Agglos de 10", "u"], ["AG20", "Agglos de 20", "u"], ["HOU16", "Hourdis", "u"], ["FIL", "Fil à ligaturer", "kg"], ["BOIS", "Bois de coffrage", "u"], ["CARR", "Carreaux", "m²"], ["PEINT", "Peinture", "kg"]];
  var STKi = {}; STK.forEach(function (s) { STKi[s[0]] = s; });
  function etatStock(p) {
    var E = {}, Sx = {}, cons = PL.consommations(p), j = jour(), d14 = PL.addDays(j, -14), c14 = {};
    p.stock.mvts.forEach(function (m) { var o = m.type === "sortie" ? Sx : E; o[m.res] = (o[m.res] || 0) + n(m.qte); });
    ((p.suivi || {}).rapports || []).forEach(function (r) { if (r.date >= d14 && r.date <= j) Object.keys(r.mat || {}).forEach(function (k) { c14[k] = (c14[k] || 0) + n(r.mat[k]); }); });
    return STK.map(function (s) {
      var k = s[0], ent = E[k] || 0, sor = (Sx[k] || 0) + (cons[k] || 0), st = ent - sor, jr = (c14[k] || 0) / 14, seuil = n(p.stock.seuils[k]);
      return { k: k, nom: s[1], u: s[2], ent: ent, sor: sor, stock: st, parJour: jr, jours: jr > 0 ? st / jr : null, seuil: seuil, alerte: (ent || sor) && (st < 0 || (seuil && st < seuil) || (jr > 0 && st / jr < 5)) };
    }).filter(function (x) { return x.ent || x.sor || x.seuil; });
  }
  function stockHTML() {
    var p = ensure(P()), E = etatStock(p), al = E.filter(function (x) { return x.alerte; });
    var h = '<div class="card"><h2>Stock du chantier</h2><p class="hint">Entrées : livraisons des bons de commande et entrées saisies ici. Sorties : matériaux consommés déclarés dans les rapports terrain, plus les sorties saisies ici (casse, vol, transfert). TABAX vous prévient quand il reste moins de 5 jours de consommation.</p>';
    if (al.length) h += '<div class="note rouge"><b>À recommander :</b> ' + al.map(function (x) { return esc(x.nom) + " (" + fmt(x.stock, 1) + " " + x.u + (x.jours != null ? ", ≈ " + fmt(Math.max(0, x.jours), 0) + " j" : "") + ")"; }).join(" · ") + "</div>";
    h += E.length ? '<table class="t"><tr><th class="l">Matériau</th><th>Entrées</th><th>Sorties</th><th>En stock</th><th>Conso / jour (14 j)</th><th>Tient encore</th><th>Seuil d\'alerte</th></tr>' + E.map(function (x) { return '<tr><td class="l">' + esc(x.nom) + "</td><td>" + fmt(x.ent, 1) + "</td><td>" + fmt(x.sor, 1) + '</td><td class="' + (x.stock < 0 ? "neg" : "") + '"><b>' + fmt(x.stock, 1) + "</b> " + x.u + " " + (x.alerte ? badge("rouge", "bas") : "") + "</td><td>" + (x.parJour ? fmt(x.parJour, 1) : "—") + "</td><td>" + (x.jours != null ? fmt(Math.max(0, x.jours), 0) + " j" : "—") + '</td><td><input type="number" min="0" data-seuil="' + x.k + '" value="' + (x.seuil || "") + '" style="width:80px"></td></tr>'; }).join("") + "</table>" : '<p class="hint">Aucun mouvement pour l\'instant. Réceptionnez un bon de commande ou saisissez une entrée ci-dessous.</p>';
    h += '<h3 style="margin:14px 0 4px">Saisir un mouvement</h3><div class="bar-btn"><select id="sTy"><option value="entree">Entrée (livraison, reste d\'un autre chantier)</option><option value="sortie">Sortie (casse, perte, transfert)</option></select><select id="sRes">' + STK.map(function (s) { return '<option value="' + s[0] + '">' + esc(s[1] + " (" + s[2] + ")") + "</option>"; }).join("") + '</select><input type="number" id="sQte" min="0" step="any" placeholder="Quantité" style="width:110px"><input id="sNote" placeholder="Note (facultatif)" style="width:200px"><button class="btn p" id="sAdd">Ajouter</button></div>';
    var M = p.stock.mvts.slice().reverse().slice(0, 30);
    if (M.length) h += '<table class="t"><tr><th>Date</th><th class="l">Mouvement</th><th>Quantité</th><th class="l">Origine</th><th></th></tr>' + M.map(function (m) { var s = STKi[m.res] || [m.res, m.res, ""], idx = p.stock.mvts.indexOf(m); return "<tr><td>" + fr(m.date) + '</td><td class="l">' + (m.type === "sortie" ? "Sortie" : "Entrée") + " · " + esc(s[1]) + "</td><td>" + fmt(m.qte, 1) + " " + s[2] + '</td><td class="l">' + esc(m.note || "") + '</td><td><button class="btn sm danger" data-sdel="' + idx + '">×</button></td></tr>'; }).join("") + "</table>";
    return h + "</div>";
  }
  function postStock() {
    var p = ensure(P());
    $("sAdd").onclick = function () { var q = n($("sQte").value); if (q <= 0) return X.toast("Indiquez une quantité"); p.stock.mvts.push({ date: jour(), type: $("sTy").value, res: $("sRes").value, qte: q, note: $("sNote").value }); X.save(); X.renderPage(); };
    document.querySelectorAll("[data-seuil]").forEach(function (el) { el.onchange = function () { p.stock.seuils[el.dataset.seuil] = n(el.value); X.save(); X.renderPage(); }; });
    document.querySelectorAll("[data-sdel]").forEach(function (b) { b.onclick = function () { p.stock.mvts.splice(+b.dataset.sdel, 1); X.save(); X.renderPage(); }; });
  }

  // ---- Bons de commande
  var CAT2RES = { "Fer à béton et ciment": ["CIM", "HA8", "HA10", "HA12", "FIL"], "Hourdis": ["HOU16"], "Carrelage et faïence": ["CARR"] };
  function numBon() { var s = S(); s.bcNum = (s.bcNum || 0) + 1; return "BC-" + jour().slice(0, 4) + "-" + ("00" + s.bcNum).slice(-3); }
  function dernierPU(res) { var pu = 0; S().projects.forEach(function (p) { (p.bons || []).forEach(function (b) { b.lignes.forEach(function (l) { if (l.res === res && n(l.pu)) pu = n(l.pu); }); }); }); return pu; }
  function totalBon(b) { return b.lignes.reduce(function (s, l) { return s + n(l.qte) * n(l.pu); }, 0); }
  function nouveauBon(cat, pour, livraison) {
    var p = ensure(P()), R = CAT2RES[cat];
    var lignes = R ? R.map(function (k) { return { res: k, des: STKi[k][1], u: STKi[k][2], qte: 0, pu: dernierPU(k) }; }) : [{ res: "", des: cat || "", u: "u", qte: 0, pu: 0 }];
    p.bons.push({ num: numBon(), date: jour(), four: "", tel: "", livraison: livraison || PL.addDays(jour(), 3), pour: pour || "", statut: "brouillon", lignes: lignes, note: "" });
    X.save(); X.ui.sub.appro = "bons"; X.go("appro", "bons"); X.toast("Bon de commande préparé : choisissez le fournisseur et les quantités");
  }
  function bonsHTML() {
    var p = ensure(P()), B = p.bons, four = {};
    S().projects.forEach(function (x) { (x.bons || []).forEach(function (b) { if (b.four) four[b.four] = b.tel || four[b.four] || ""; }); (x.factu && x.factu.achats || []).forEach(function (a) { if (a.four && !a.tach && !(a.four in four)) four[a.four] = ""; }); });
    var h = '<datalist id="dlFour">' + Object.keys(four).map(function (f) { return '<option value="' + esc(f) + '">'; }).join("") + "</datalist>";
    h += '<div class="card"><h2>Bons de commande</h2><p class="hint">Préparez le bon, envoyez-le au fournisseur en PDF ou par WhatsApp, puis cliquez « Livré » à la réception : les quantités entrent dans le stock et le montant dans les dépenses du chantier. Vous pouvez aussi créer un bon depuis OPC › Commandes à passer.</p><button class="btn p" id="bAdd">+ Nouveau bon de commande</button></div>';
    B.slice().reverse().forEach(function (bn) {
      var i = B.indexOf(bn), b = "bons." + i, tot = totalBon(bn), st = { brouillon: ["", "brouillon"], envoye: ["orange", "envoyé"], livre: ["vert", "livré le " + fr(bn.dateLivre)] }[bn.statut] || ["", bn.statut];
      h += '<div class="card"><h2>' + esc(bn.num) + " " + (st[0] ? badge(st[0], st[1]) : '<span class="tag">' + st[1] + "</span>") + (bn.pour ? ' <span style="font-weight:400;color:#667;font-size:13px">pour : ' + esc(bn.pour) + "</span>" : "") + "</h2>" +
        '<div class="form"><label class="f"><span>Fournisseur</span>' + inp(b + ".four", { text: true }).replace("<input", '<input list="dlFour"') + '</label><label class="f"><span>Téléphone (WhatsApp)</span>' + inp(b + ".tel", { text: true }) + '</label><label class="f"><span>Date de la commande</span>' + inp(b + ".date", { date: true }) + '</label><label class="f"><span>Livraison souhaitée le</span>' + inp(b + ".livraison", { date: true }) + "</label></div>" +
        '<table class="t edit"><tr><th class="l">Désignation</th><th>Article suivi en stock</th><th>Unité</th><th>Quantité</th><th>Prix unitaire</th><th>Montant</th><th></th></tr>' + bn.lignes.map(function (l, k) {
          var lb = b + ".lignes." + k;
          return '<tr><td class="l">' + inp(lb + ".des", { text: true }) + '</td><td><select data-b="' + lb + '.res" class="rr"><option value="">— non suivi —</option>' + STK.map(function (s) { return '<option value="' + s[0] + '"' + (l.res === s[0] ? " selected" : "") + ">" + esc(s[1]) + "</option>"; }).join("") + "</select></td><td>" + inp(lb + ".u", { text: true, w: "60px" }) + "</td><td>" + inp(lb + ".qte", { w: "80px", cls: "rr" }) + "</td><td>" + inp(lb + ".pu", { w: "100px", cls: "rr" }) + "</td><td>" + fmt(n(l.qte) * n(l.pu)) + '</td><td><button class="btn sm danger" data-bl="' + i + "|" + k + '">×</button></td></tr>';
        }).join("") + '<tr class="tot"><td colspan="5" class="l">Total</td><td>' + fmt(tot) + " FCFA</td><td></td></tr></table>" +
        '<label class="f wide"><span>Remarques pour le fournisseur</span>' + inp(b + ".note", { text: true, ph: "Ex. livraison sur chantier avant 10 h, appeler le chef de chantier" }) + "</label>" +
        '<div class="bar-btn"><button class="btn sm" data-bla="' + i + '">+ Ligne</button><button class="btn" data-bpdf="' + i + '">PDF</button><button class="btn" data-bwa="' + i + '">Envoyer par WhatsApp</button>' + (bn.statut !== "livre" ? '<button class="btn p" data-bliv="' + i + '">Livré : entrer en stock et en dépense</button>' : "") + '<button class="btn danger" data-bdel="' + i + '">Supprimer</button></div></div>';
    });
    return h;
  }
  function postBons() {
    var p = ensure(P()); rerender();
    $("bAdd").onclick = function () { nouveauBon("", ""); };
    document.querySelectorAll("[data-bla]").forEach(function (b) { b.onclick = function () { p.bons[+b.dataset.bla].lignes.push({ res: "", des: "", u: "u", qte: 0, pu: 0 }); X.save(); X.renderPage(); }; });
    document.querySelectorAll("[data-bl]").forEach(function (b) { b.onclick = function () { var a = b.dataset.bl.split("|"); p.bons[+a[0]].lignes.splice(+a[1], 1); X.save(); X.renderPage(); }; });
    document.querySelectorAll("[data-bdel]").forEach(function (b) { b.onclick = function () { confirmer(b, "Confirmer la suppression", function () { p.bons.splice(+b.dataset.bdel, 1); X.save(); X.renderPage(); }); }; });
    document.querySelectorAll("[data-bpdf]").forEach(function (b) { b.onclick = function () { var bn = p.bons[+b.dataset.bpdf]; pdfBon(bn); if (bn.statut === "brouillon") { bn.statut = "envoye"; X.save(); X.renderPage(); } }; });
    document.querySelectorAll("[data-bwa]").forEach(function (b) {
      b.onclick = function () {
        var bn = p.bons[+b.dataset.bwa], e = S().ent;
        var msg = "Bonjour" + (bn.four ? " " + bn.four : "") + ",\nVoici notre bon de commande " + bn.num + " pour le chantier « " + p.info.nom + " »" + (p.info.ville ? " (" + p.info.ville + ")" : "") + " :\n" + bn.lignes.filter(function (l) { return n(l.qte); }).map(function (l) { return "- " + l.des + " : " + fmt(l.qte) + " " + l.u; }).join("\n") + "\nLivraison souhaitée le " + fr(bn.livraison) + ".\nMerci de confirmer la disponibilité et le prix.\n" + e.nom + (e.tel ? " – " + e.tel : "");
        if (window.PIL) PIL.envoyer(function () { pdfBon(bn); }, bn.tel, msg); else pdfBon(bn);
        if (bn.statut === "brouillon") { bn.statut = "envoye"; X.save(); }
      };
    });
    document.querySelectorAll("[data-bliv]").forEach(function (b) {
      b.onclick = function () {
        var bn = p.bons[+b.dataset.bliv];
        confirmer(b, "Confirmer la livraison complète", function () {
          bn.statut = "livre"; bn.dateLivre = jour();
          bn.lignes.forEach(function (l) { if (l.res && n(l.qte)) p.stock.mvts.push({ date: jour(), type: "entree", res: l.res, qte: n(l.qte), note: "Livraison " + bn.num + (bn.four ? " – " + bn.four : "") }); });
          var tot = totalBon(bn); if (tot > 0) ajouterDepense(p, { four: bn.four, lib: "Livraison " + bn.num + " : " + bn.lignes.filter(function (l) { return n(l.qte); }).map(function (l) { return l.des; }).join(", "), mt: tot, bc: bn.num });
          X.save(); X.renderPage(); X.toast("Livraison enregistrée : stock et dépenses mis à jour");
        });
      };
    });
  }
  function pdfBon(bn) {
    var h = pdfH(), p = P(), e = S().ent, doc = h.doc0(), titre = "BON DE COMMANDE N° " + bn.num, sous = "Du " + fr(bn.date);
    h.header(doc, titre, sous); var y = 40;
    y = h.table(doc, { startY: y, theme: "plain", styles: { fontSize: 9.5, cellPadding: 1.4 }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 52 } }, body: [["Fournisseur", bn.four || "-"], ["Chantier", p.info.nom], ["Lieu de livraison", [p.info.adresse, p.info.ville].filter(Boolean).join(", ") || "-"], ["Livraison souhaitée le", fr(bn.livraison)], ["Contact", (e.responsable ? e.responsable + " – " : "") + (e.tel || "")]].map(function (r) { return [h.t(r[0]), h.t(r[1])]; }) }, titre, sous) + 4;
    var L = bn.lignes.filter(function (l) { return n(l.qte); });
    y = h.table(doc, { startY: y, head: [["Désignation", "Unité", "Quantité", "Prix unitaire", "Montant (FCFA)"]], body: L.map(function (l) { return [h.t(l.des), h.t(l.u), h.f(l.qte), n(l.pu) ? h.f(l.pu) : "", n(l.pu) ? h.f(n(l.qte) * n(l.pu)) : ""]; }).concat(totalBon(bn) ? [[{ content: "Total", colSpan: 4, styles: { fontStyle: "bold" } }, { content: h.f(totalBon(bn)), styles: { fontStyle: "bold" } }]] : []), columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } } }, titre, sous) + 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    var c = doc.splitTextToSize(h.t((bn.note ? bn.note + "\n" : "") + "La livraison est acceptée sur présentation d'un bon de livraison signé par notre représentant sur le chantier. La facture doit rappeler le numéro de ce bon de commande" + (e.ninea ? " et porter le NINEA du fournisseur" : "") + "."), 182);
    doc.text(c, 14, y); y += c.length * 4.2 + 6;
    if (y > 245) { doc.addPage(); h.header(doc, titre, sous); y = 40; }
    doc.setFont("helvetica", "bold"); doc.text(h.t("Pour " + e.nom), 120, y); doc.setDrawColor(180, 180, 180); doc.rect(118, y + 3, 78, 28);
    if (window.OUT) OUT.signerPDF(doc, 118, y + 3, 78, 28, e.signature, e.cachet);
    h.footers(doc, titre); X.saveFile(doc.output("blob"), bn.num + "_" + X.slug(bn.four || "fournisseur") + ".pdf");
  }

  // ---- Matériel et engins
  function coutMat(m) { if (m.type !== "location" || !m.debut) return 0; var f = m.fin && m.fin < jour() ? m.fin : jour(), j = Math.max(0, PL.diff(m.debut, f) + 1); return m.unite === "mois" ? n(m.tarif) * j / 30 : n(m.tarif) * j; }
  function payeMat(p, id) { return p.factu.achats.filter(function (a) { return a.mat === id; }).reduce(function (s, a) { return s + n(a.mt); }, 0); }
  function materielHTML() {
    var p = ensure(P()), M = p.materiel, loc = M.reduce(function (s, m) { return s + coutMat(m); }, 0), pay = M.reduce(function (s, m) { return s + payeMat(p, m.id); }, 0), panne = M.filter(function (m) { return m.etat === "panne"; }).length;
    var h = '<div class="card"><h2>Matériel et engins du chantier</h2><p class="hint">Bétonnière, vibreur, étais, échafaudage, camion… Notez ce qui est sur le chantier, à qui il appartient et son état. Pour le matériel loué, TABAX calcule le coût jour après jour : vous voyez quand il vaut mieux le rendre.</p>' +
      '<div class="kpis">' + X.kpi("Matériel sur le chantier", M.filter(function (m) { return !m.fin || m.fin >= jour(); }).length, "éléments") + X.kpi("Coût de location à ce jour", fmt(loc), "FCFA") + X.kpi("Location payée", fmt(pay), "FCFA · reste " + fmt(loc - pay)) + X.kpi("En panne", panne, panne ? "à faire réparer" : "tout fonctionne") + "</div>" +
      (M.length ? '<div style="overflow-x:auto"><table class="t edit"><tr><th class="l">Matériel</th><th>Propriété</th><th class="l">Loueur</th><th>Arrivé le</th><th>Rendu le</th><th>Tarif</th><th>Par</th><th>État</th><th>Coût à ce jour</th><th></th></tr>' + M.map(function (m, i) {
        var b = "materiel." + i, c = coutMat(m), rest = c - payeMat(p, m.id);
        return '<tr><td class="l">' + inp(b + ".nom", { text: true }) + "</td><td>" + sel(b + ".type", m.type, [["propre", "À nous"], ["location", "Loué"]], true) + '</td><td class="l">' + (m.type === "location" ? inp(b + ".four", { text: true }) : "—") + "</td><td>" + inp(b + ".debut", { date: true, cls: "rr" }) + "</td><td>" + inp(b + ".fin", { date: true, cls: "rr" }) + "</td><td>" + (m.type === "location" ? inp(b + ".tarif", { w: "90px", cls: "rr" }) : "—") + "</td><td>" + (m.type === "location" ? sel(b + ".unite", m.unite || "jour", [["jour", "jour"], ["mois", "mois"]], true) : "") + "</td><td>" + sel(b + ".etat", m.etat || "bon", [["bon", "Bon état"], ["panne", "En panne"], ["repar", "En réparation"]], true) + "</td><td>" + (m.type === "location" ? fmt(c) + (rest > 1 ? '<br><button class="btn sm" data-mpay="' + i + '">Payer ' + fmt(rest) + "</button>" : "") : "—") + '</td><td><button class="btn sm danger" data-mdel="' + i + '">×</button></td></tr>';
      }).join("") + "</table></div>" : "") + '<button class="btn p" id="mAdd">+ Ajouter du matériel</button></div>';
    return h;
  }
  function postMateriel() {
    var p = ensure(P()); rerender();
    $("mAdd").onclick = function () { p.materiel.push({ id: uid("m"), nom: "", type: "propre", four: "", debut: jour(), fin: "", tarif: 0, unite: "jour", etat: "bon" }); X.save(); X.renderPage(); };
    document.querySelectorAll("[data-mdel]").forEach(function (b) { b.onclick = function () { p.materiel.splice(+b.dataset.mdel, 1); X.save(); X.renderPage(); }; });
    document.querySelectorAll("[data-mpay]").forEach(function (b) { b.onclick = function () { var m = p.materiel[+b.dataset.mpay], r = coutMat(m) - payeMat(p, m.id); ajouterDepense(p, { four: m.four, lib: "Location " + (m.nom || "matériel"), mt: Math.round(r), mat: m.id }); X.save(); X.renderPage(); X.toast("Location enregistrée dans les dépenses"); }; });
  }

  /* =======================================================================
     PLANS ET RÉSERVES
     ======================================================================= */
  var placer = false;
  function lireImage(file, max) {
    return new Promise(function (res, rej) {
      var rd = new FileReader();
      rd.onload = function () { var img = new Image(); img.onload = function () { var sc = Math.min(1, (max || 2000) / Math.max(img.width, img.height)), cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); var c = cv.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height); res({ data: cv.toDataURL("image/jpeg", 0.85), w: cv.width, h: cv.height }); }; img.onerror = rej; img.src = rd.result; };
      rd.onerror = rej; rd.readAsDataURL(file);
    });
  }
  function resPlan(p, id) { return p.opc.reserves.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return x.r.plan === id; }); }
  function plansHTML() {
    var p = ensure(P()), L = p.plans, ui = X.ui; ui.plan = L.some(function (x) { return x.id === ui.plan; }) ? ui.plan : (L[0] || {}).id;
    var h = '<div class="card"><h2>Plans du chantier et réserves</h2><p class="hint">Ajoutez les plans (photo ou image JPG/PNG ; pour un PDF, faites une capture de la page). Touchez « Placer une réserve » puis l\'endroit exact sur le plan : la réserve est numérotée, suivie jusqu\'à sa levée et reprise dans la liste OPC et le PV de réception.</p>' +
      '<div class="bar-btn">' + L.map(function (pl) { var o = resPlan(p, pl.id).filter(function (x) { return !x.r.levee; }).length; return '<button class="btn' + (pl.id === ui.plan ? " p" : "") + '" data-pl="' + pl.id + '">' + esc(pl.nom) + (o ? " (" + o + ")" : "") + "</button>"; }).join("") + '<label class="btn">+ Ajouter un plan<input type="file" accept="image/*" id="plAdd" hidden></label></div>';
    var pl = L.filter(function (x) { return x.id === ui.plan; })[0];
    if (!pl) return h + '<p class="hint">Aucun plan pour l\'instant.</p></div>';
    var R = resPlan(p, pl.id);
    h += '<div class="bar-btn"><label>Nom du plan <input data-b="plans.' + L.indexOf(pl) + '.nom" value="' + esc(pl.nom) + '" class="rr" style="width:200px"></label><button class="btn ' + (placer ? "p" : "") + '" id="plPin">' + (placer ? "Touchez le plan à l'endroit de la réserve…" : "📍 Placer une réserve") + '</button><button class="btn" id="plPdf">PDF du plan avec les réserves</button><button class="btn danger" id="plDel">Supprimer ce plan</button></div>' +
      '<div id="plBox" style="position:relative;max-width:100%;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#f4f6f9;' + (placer ? "cursor:crosshair;outline:3px solid #c23b3b" : "") + '"><img id="plImg" alt="" style="display:block;width:100%;min-height:120px">' +
      R.map(function (x, k) { return '<span data-pin="' + x.i + '" title="' + esc(x.r.desc || "Réserve " + (k + 1)) + '" style="position:absolute;left:' + x.r.x + "%;top:" + x.r.y + '%;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:' + (x.r.levee ? "#2e8b57" : "#c23b3b") + ';color:#fff;font:700 12px/24px sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer">' + (k + 1) + "</span>"; }).join("") + "</div>";
    if (R.length) h += '<table class="t edit" style="margin-top:10px"><tr><th>N°</th><th class="l">Description</th><th class="l">Responsable</th><th>À lever avant le</th><th>Levée le</th><th></th></tr>' + R.map(function (x, k) { var b = "opc.reserves." + x.i, late = !x.r.levee && x.r.ech && x.r.ech < jour(); return '<tr id="rrow' + x.i + '"><td><b style="color:' + (x.r.levee ? "#2e8b57" : "#c23b3b") + '">' + (k + 1) + '</b></td><td class="l">' + inp(b + ".desc", { text: true, ph: "Ex. fissure en angle, enduit à reprendre" }) + '</td><td class="l">' + inp(b + ".resp", { text: true }) + "</td><td>" + inp(b + ".ech", { date: true }) + (late ? " " + badge("rouge", "en retard") : "") + "</td><td>" + inp(b + ".levee", { date: true, cls: "rr" }) + '</td><td><button class="btn sm danger" data-rpdel="' + x.i + '">×</button></td></tr>'; }).join("") + "</table>";
    return h + "</div>";
  }
  function postPlans() {
    var p = ensure(P()), ui = X.ui; rerender();
    document.querySelectorAll("[data-pl]").forEach(function (b) { b.onclick = function () { ui.plan = b.dataset.pl; placer = false; X.renderPage(); }; });
    var f = $("plAdd"); if (f) f.onchange = function () {
      var file = f.files[0]; if (!file) return;
      lireImage(file, 2200).then(function (im) { var id = uid("pl"); return X.photoPut(id, im.data).then(function () { p.plans.push({ id: id, nom: (file.name || "Plan").replace(/\.[^.]+$/, "").slice(0, 40), w: im.w, h: im.h }); ui.plan = id; X.save(); X.renderPage(); X.toast("Plan ajouté"); }); }).catch(function () { X.toast("Image illisible : utilisez un fichier JPG ou PNG"); });
    };
    var img = $("plImg"); if (img && ui.plan) X.photoGet(ui.plan).then(function (d) { if (d) img.src = d; });
    var pin = $("plPin"); if (pin) pin.onclick = function () { placer = !placer; X.renderPage(); };
    var box = $("plBox"); if (box) box.onclick = function (ev) {
      if (!placer || ev.target.dataset.pin) return;
      var r = box.getBoundingClientRect(), x = Math.round(1000 * (ev.clientX - r.left) / r.width) / 10, y = Math.round(1000 * (ev.clientY - r.top) / r.height) / 10;
      var pl = p.plans.filter(function (q) { return q.id === ui.plan; })[0];
      p.opc.reserves.push({ loc: pl ? pl.nom : "", desc: "", resp: "", ech: PL.addDays(jour(), 15), levee: "", photos: [], date: jour(), plan: ui.plan, x: x, y: y });
      placer = false; X.save(); X.renderPage();
      var rows = document.querySelectorAll("[id^=rrow]"), last = rows[rows.length - 1]; if (last) { var i = last.querySelector("input"); if (i) i.focus(); }
    };
    document.querySelectorAll("[data-pin]").forEach(function (s) { s.onclick = function (ev) { ev.stopPropagation(); var row = $("rrow" + s.dataset.pin); if (row) { row.scrollIntoView({ behavior: "smooth", block: "center" }); row.style.background = "#fff3c4"; var i = row.querySelector("input"); if (i) i.focus(); setTimeout(function () { row.style.background = ""; }, 1500); } }; });
    document.querySelectorAll("[data-rpdel]").forEach(function (b) { b.onclick = function () { p.opc.reserves.splice(+b.dataset.rpdel, 1); X.save(); X.renderPage(); }; });
    var del = $("plDel"); if (del) del.onclick = function () { confirmer(del, "Confirmer (les réserves sont gardées dans OPC)", function () { var id = ui.plan; p.plans = p.plans.filter(function (q) { return q.id !== id; }); p.opc.reserves.forEach(function (r) { if (r.plan === id) { delete r.plan; delete r.x; delete r.y; } }); if (X.photoDel) X.photoDel(id); ui.plan = null; X.save(); X.renderPage(); }); };
    var pdf = $("plPdf"); if (pdf) pdf.onclick = function () { pdfPlan(ui.plan); };
  }
  function pdfPlan(id) {
    var p = ensure(P()), pl = p.plans.filter(function (q) { return q.id === id; })[0]; if (!pl) return;
    X.photoGet(id).then(function (data) {
      var h = pdfH(), J = window.jspdf.jsPDF, paysage = (pl.w || 4) >= (pl.h || 3), doc = new J({ unit: "mm", format: "a4", orientation: paysage ? "landscape" : "portrait" });
      var W = paysage ? 297 : 210, Hh = paysage ? 210 : 297, titre = "PLAN ET RÉSERVES", sous = p.info.nom + " · " + pl.nom + " · situation au " + fr(jour());
      h.header(doc, titre, sous);
      var mw = W - 28, mh = Hh - 36 - 18, r = Math.min(mw / (pl.w || 1), mh / (pl.h || 1)), iw = (pl.w || 1) * r, ih = (pl.h || 1) * r, x0 = 14 + (mw - iw) / 2, y0 = 36;
      try { doc.addImage(data, "JPEG", x0, y0, iw, ih); } catch (e) {}
      var R = resPlan(p, id);
      R.forEach(function (x, k) { var cx = x0 + iw * x.r.x / 100, cy = y0 + ih * x.r.y / 100; if (x.r.levee) doc.setFillColor(46, 139, 87); else doc.setFillColor(194, 59, 59); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.6); doc.circle(cx, cy, 3, "FD"); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text(String(k + 1), cx, cy + 1, { align: "center" }); });
      doc.setTextColor(30, 30, 30);
      if (R.length) { doc.addPage("a4", "portrait"); h.header(doc, titre, sous); h.table(doc, { startY: 40, head: [["N°", "Description", "Responsable", "À lever avant le", "État"]], body: R.map(function (x, k) { return [k + 1, h.t(x.r.desc || "-"), h.t(x.r.resp || "-"), fr(x.r.ech), x.r.levee ? h.t("Levée le " + fr(x.r.levee)) : h.t("À lever")]; }) }, titre, sous); }
      h.footers(doc, titre); X.saveFile(doc.output("blob"), "Plan_reserves_" + X.slug(pl.nom) + ".pdf");
    });
  }

  /* ---------------- Approvisionnements : onglets ---------------- */
  var TABS_APPRO = [["besoins", "Besoins en matériaux"], ["bons", "Bons de commande"], ["stock", "Stock du chantier"], ["mat", "Matériel et engins"]];
  function pageAppro(sub) { return ({ bons: bonsHTML, stock: stockHTML, mat: materielHTML }[sub] || function () { return ""; })(); }
  function postAppro(sub) { ({ bons: postBons, stock: postStock, mat: postMateriel }[sub] || function () {})(); }
  function alertesStock(p) { ensure(p); return etatStock(p).filter(function (x) { return x.alerte; }); }

  return { tachHTML: tachHTML, postTach: postTach, plansHTML: plansHTML, postPlans: postPlans, TABS_APPRO: TABS_APPRO, pageAppro: pageAppro, postAppro: postAppro, nouveauBon: nouveauBon, alertesStock: alertesStock, payeTach: payeTach, montantTach: montantTach, coutMat: coutMat, ensure: ensure, pdfContrat: pdfContrat, pdfBon: pdfBon };
})();
