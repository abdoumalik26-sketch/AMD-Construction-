/* =========================================================
   2AM CONSTRUCTION — Types de chantier
   · Petits travaux : devis rapide sans métré
   · Marché public : procédure indicative, cautions, pièces du DAO
   · Procès-verbal de réception (tous chantiers)
   ========================================================= */
var TYP = (function () {
  var X = APP.X, Cc = CALC, PL = PLAN, D = DATA, esc = X.esc, fmt = X.fmt, inp = X.inp, fld = X.fld;
  var $ = function (id) { return document.getElementById(id); };
  function P() { return X.P(); }
  function S() { return X.S(); }
  function fr(s) { return PL.fr(s); }
  function today() { return PL.d2s(new Date()); }
  function uid() { return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  /* ---------------- PETITS TRAVAUX ---------------- */
  function pageRapide() {
    var p = P(), q = X.Q(), parId = {}, ouv = S().ouv;
    q.lignes.forEach(function (l) { parId[l.id] = l; });
    var h = '<div class="head"><h1>Devis rapide · petits travaux</h1><p>Pour les interventions courtes (réparation, carrelage d\'une pièce, peinture, clôture, plomberie…) : pas de métré, vous saisissez directement les quantités. Le prix des ouvrages de la bibliothèque est calculé automatiquement ; pour une ligne libre, vous mettez votre prix.</p></div>';
    h += '<div class="note">Ce projet est en mode <b>petits travaux</b>. Pour un chantier complet chiffré depuis le plan, changez la « Méthode de chiffrage » dans <a href="#" data-go="projets">Projets</a>.</div>';
    var opts = function (code) {
      var o = '<option value="">— Ligne libre (mon prix) —</option>';
      D.LOTS.forEach(function (L) {
        var ks = Object.keys(ouv).filter(function (k) { return ouv[k].lot === L[0]; });
        if (!ks.length) return;
        o += '<optgroup label="' + esc(L[1]) + '">' + ks.map(function (k) { return '<option value="' + k + '"' + (k === code ? " selected" : "") + ">" + esc(k + " · " + ouv[k].d) + "</option>"; }).join("") + "</optgroup>";
      });
      return o;
    };
    h += '<div class="card"><h2>Lignes du devis</h2><table class="t edit"><tr><th class="l">Ouvrage</th><th class="l">Désignation</th><th class="l">Localisation</th><th>Unité</th><th>Quantité</th><th>P.U. HT</th><th>Jours</th><th>Montant HT</th><th></th></tr>';
    (p.rapide || []).forEach(function (r, i) {
      var b = "rapide." + i, l = parId[r.id], o = r.code && ouv[r.code];
      h += '<tr><td class="l"><select data-rcode="' + i + '" style="max-width:220px">' + opts(r.code) + "</select>" +
        (!o ? '<br><select data-b="' + b + '.lot" style="max-width:220px;margin-top:3px">' + D.LOTS.map(function (L) { return '<option value="' + L[0] + '"' + (L[0] === (r.lot || "L12") ? " selected" : "") + ">" + esc(L[1]) + "</option>"; }).join("") + "</select>" : "") + "</td>" +
        '<td class="l">' + inp(b + ".d", { text: true, ph: o ? o.d : "Ex. : reprise de fissures" }) + "</td>" +
        '<td class="l">' + inp(b + ".loc", { text: true, ph: "Salon, façade…" }) + "</td>" +
        "<td>" + (o ? esc(o.u) : inp(b + ".u", { text: true, w: "52px", ph: "FF" })) + "</td>" +
        "<td>" + inp(b + ".q", { w: "80px" }) + "</td>" +
        "<td>" + inp(b + ".pu", { w: "100px", ph: o && l ? fmt(l.puCalc) : "prix" }) + "</td>" +
        "<td>" + inp(b + ".jours", { w: "56px", ph: o ? "auto" : "1" }) + "</td>" +
        "<td><b>" + (l ? fmt(l.m) : "—") + '</b></td><td><button class="x" data-rdel="' + i + '">✕</button></td></tr>';
    });
    h += "</table>" + (!(p.rapide || []).length ? '<p class="hint">Aucune ligne. Ajoutez un ouvrage de la bibliothèque ou une ligne libre.</p>' : "") +
      '<div class="bar-btn" style="margin-top:10px"><button class="btn p" id="addRL">+ Ouvrage de la bibliothèque</button><button class="btn" id="addRF">+ Ligne libre</button></div>' +
      '<p class="hint">P.U. vide = prix calculé par la bibliothèque (déboursé × K). « Jours » = durée estimée ; vide = calculée à partir de la main-d\'œuvre.</p></div>';
    h += '<div class="grid2"><div class="card"><h2>Total</h2><table class="t"><tr><td class="l">Total HT</td><td><b>' + fmt(q.ht) + "</b> FCFA</td></tr><tr><td class='l'>TVA " + S().ent.tva + " %</td><td>" + fmt(q.tva) + " FCFA</td></tr><tr><td class='l'><b>Total TTC</b></td><td><b>" + fmt(q.ttc) + "</b> FCFA</td></tr><tr><td class='l'>Marge brute prévue</td><td>" + fmt(q.ht - q.ds) + " FCFA</td></tr></table>" +
      '<div class="bar-btn" style="margin-top:10px"><a class="btn p" href="#" data-go="prix:devis">Préparer le devis client (PDF) →</a></div></div>' +
      '<div class="card"><h2>Bonnes pratiques petits travaux</h2><ul class="hint" style="line-height:1.6;margin:0;padding-left:18px"><li>Faites signer le devis « bon pour accord » avant de commencer.</li><li>Encaissez l\'acompte prévu dans les Paramètres (' + S().ent.acompte + ' %).</li><li>Prenez des photos avant et après (Suivi terrain).</li><li>Terminez par un procès-verbal de réception signé (OPC › Réception).</li><li>Travaux de gros œuvre, clôture de plus de 2 m ou modification de façade : vérifiez l\'autorisation de construire à la mairie.</li></ul></div></div>';
    return h;
  }
  function postRapide() {
    var p = P();
    X.linkGo();
    $("addRL").onclick = function () { var k = "8.1", o = S().ouv[k]; p.rapide.push({ id: uid(), code: k, lot: o.lot, d: "", loc: "", u: o.u, q: 1, pu: "", jours: "" }); X.save(); X.renderPage(); };
    $("addRF").onclick = function () { p.rapide.push({ id: uid(), code: "", lot: "L12", d: "", loc: "", u: "FF", q: 1, pu: 0, jours: 1 }); X.save(); X.renderPage(); };
    document.querySelectorAll("[data-rcode]").forEach(function (el) {
      el.onchange = function () { var r = p.rapide[+el.dataset.rcode], o = S().ouv[el.value]; r.code = el.value; if (o) { r.lot = o.lot; r.u = o.u; r.pu = ""; } X.save(); X.renderPage(); };
    });
    document.querySelectorAll("[data-rdel]").forEach(function (b) { b.onclick = function () { p.rapide.splice(+b.dataset.rdel, 1); X.save(); X.renderPage(); }; });
  }

  /* ---------------- MARCHÉ PUBLIC ---------------- */
  var AUTORITES = [["etat", "État, ministère ou agence"], ["commune", "Commune ou collectivité territoriale"], ["etab", "Établissement public, société nationale, autre"]];
  var PIECES = [
    ["Dossier administratif", [
      ["lettre", "Lettre de soumission signée (modèle du DAO)"], ["pouvoir", "Pouvoir du signataire, si ce n'est pas le gérant"],
      ["ninea", "NINEA et registre du commerce (RCCM)"], ["fiscal", "Attestation de régularité fiscale (quitus fiscal)"],
      ["ipres", "Attestation IPRES"], ["css", "Attestation de la Caisse de sécurité sociale"], ["itravail", "Attestation de l'Inspection du travail"],
      ["agrement", "Agrément ou certificat de qualification BTP, si exigé"], ["caution", "Caution de soumission, si exigée par le DAO"]]],
    ["Offre technique", [
      ["memoire", "Méthodologie / mémoire technique", "memoires"], ["planning", "Planning d'exécution", "planning"],
      ["personnel", "Personnel clé : CV, diplômes, attestations"], ["materiel", "Liste du matériel et justificatifs (factures, location)"],
      ["references", "Références de travaux similaires (attestations de bonne exécution)"], ["visite", "Attestation de visite de site, si obligatoire"]]],
    ["Offre financière", [
      ["bpu", "Bordereau des prix unitaires (BPU)", "prix:bpu"], ["dqe", "Devis quantitatif et estimatif (DQE)", "prix:dqe"],
      ["sd", "Sous-détails des prix, si demandés", "prix:sd"], ["ca", "Chiffre d'affaires / états financiers des dernières années"], ["banque", "Attestation de capacité financière (banque)"]]],
    ["Dépôt", [
      ["copies", "Original et copies dans le nombre demandé, paraphés"], ["depot", "Offre déposée avant la date et l'heure limites"]]]
  ];
  function procedure(m, ttc) {
    var M = ttc / 1e6;
    if (m.autorite === "etat") return M >= 70 ? ["Appel d'offres ouvert", "Montant estimé ≥ 70 M FCFA : appel d'offres ouvert pour les travaux de l'État."] :
      ["DRP", "Sous 70 M FCFA : demande de renseignements et de prix (simple, à compétition restreinte ou ouverte selon le montant). Les DRP passent souvent par la plateforme Kermel."];
    if (m.autorite === "commune") return M < 50 ? ["Publicité simplifiée / demande de prix", "Sous 50 M FCFA TTC : publicité simplifiée possible, consultation d'au moins 3 candidats."] :
      ["Seuils propres à la collectivité", "Au-dessus de 50 M FCFA : se référer à l'avis et aux seuils applicables à la collectivité."];
    return ["Seuils de la catégorie de l'autorité", "Les seuils dépendent de la catégorie de l'autorité contractante : se référer à l'avis d'appel à la concurrence."];
  }
  function marcheHTML() {
    var p = P(), m = p.marche, q = X.Q(), e = S().ent;
    if (m.type !== "public") return '<div class="card"><h2>Marché public</h2><p>Ce projet est déclaré pour un <b>client privé</b> (particulier, entreprise, diaspora) : votre devis signé fait contrat, le Code des marchés publics ne s\'applique pas.</p><p class="hint">Si le client est l\'État, une commune ou un établissement public, choisissez « Marché public » dans la fiche du projet : cette page affichera la procédure, les cautions et la liste des pièces du dossier.</p></div>';
    var base = m.montantEstime > 0 ? +m.montantEstime : q.ttc, pr = procedure(m, base), seuil = base >= 100e6;
    var be = seuil ? base * (+m.tauxBE || 0) / 100 : 0, rg = q.ht * (+e.retenue || 0) / 100;
    var tot = 0, ok = 0; PIECES.forEach(function (g) { g[1].forEach(function (x) { tot++; if (m.check[x[0]]) ok++; }); });
    var jr = m.dateDepot ? PL.diff(today(), m.dateDepot) : null;
    var h = '<div class="card"><h2>Consultation</h2><div class="form">' +
      fld("Autorité contractante", "marche.autorite", { options: AUTORITES }) + fld("Nom de l'autorité", "marche.nomAutorite", { text: true, ph: "Mairie de …" }) +
      fld("Référence de l'avis / du DAO", "marche.ref", { text: true }) + fld("Montant estimé du marché (TTC)", "marche.montantEstime", {}, "Laisser 0 pour utiliser le montant de votre étude de prix.") +
      fld("Date limite de dépôt", "marche.dateDepot", { date: true }) + fld("Heure limite", "marche.heureDepot", { text: true, ph: "10h00" }) +
      fld("Validité des offres (jours)", "marche.validite") + fld("Taux de la caution de bonne exécution (%)", "marche.tauxBE", {}, "Taux indiqué dans le DAO.") + "</div></div>";
    h += '<div class="kpis">' + X.kpi("Procédure indicative", esc(pr[0]), esc(pr[1])) +
      X.kpi("Caution de soumission", seuil ? "Si le DAO l'exige" : "Non requise", seuil ? "Montant fixé par le DAO" : "Sous 100 M FCFA TTC pour des travaux") +
      X.kpi("Caution de bonne exécution", seuil ? fmt(be) + " FCFA" : "Non obligatoire", seuil ? (m.tauxBE || 0) + " % du marché, selon le DAO" : "Obligatoire à partir de 100 M FCFA TTC") +
      X.kpi("Retenue de garantie", fmt(rg) + " FCFA", e.retenue + " % du HT (Paramètres), libérée selon le marché") +
      X.kpi("Dossier prêt", ok + " / " + tot, "pièces cochées") +
      X.kpi("Dépôt", m.dateDepot ? fr(m.dateDepot) : "—", jr == null ? "date à renseigner" : jr < 0 ? "date dépassée" : "dans " + jr + " jour(s)") + "</div>";
    if (jr != null && jr >= 0 && jr <= 7 && ok < tot) h += '<div class="note">Dépôt dans <b>' + jr + " jour(s)</b> et il reste <b>" + (tot - ok) + "</b> pièce(s) à préparer. Les attestations (fiscale, IPRES, sécurité sociale) peuvent prendre plusieurs jours : lancez-les en premier.</div>";
    h += '<div class="card"><h2>Pièces du dossier (liste type)</h2><p class="hint">Liste type des appels à la concurrence au Sénégal. <b>La liste exacte est toujours celle du DAO</b> : ajoutez-y ce qu\'il demande en plus.</p><div class="grid2">' +
      PIECES.map(function (g) {
        return '<div><h3 style="margin:8px 0 4px">' + esc(g[0]) + "</h3>" + g[1].map(function (x) {
          return '<label style="display:flex;gap:8px;align-items:flex-start;padding:3px 0"><input type="checkbox" data-pc="' + x[0] + '"' + (m.check[x[0]] ? " checked" : "") + "><span>" + esc(x[1]) + (x[2] ? ' · <a href="#" data-go="' + x[2] + '">ouvrir dans l\'application</a>' : "") + "</span></label>";
        }).join("") + "</div>";
      }).join("") + '</div><label class="f wide" style="margin-top:10px"><span>Pièces supplémentaires demandées par le DAO</span>' + inp("marche.autres", { area: true, rows: 3 }) + "</label>" +
      '<div class="bar-btn" style="margin-top:10px"><button class="btn p" id="pdfCheck">PDF de la liste de contrôle</button></div></div>';
    h += '<p class="hint">Repères : Code des marchés publics (décret 2022-2295) et arrêtés d\'application. Indications données à titre d\'aide : l\'avis d\'appel à la concurrence et le DAO font foi. Pour un premier marché, faites relire votre offre par un conseil.</p>';
    return h;
  }
  function postMarche() {
    var p = P();
    X.linkGo();
    document.querySelectorAll("[data-pc]").forEach(function (el) { el.onchange = function () { p.marche.check[el.dataset.pc] = el.checked; X.save(); X.renderPage(); }; });
    var b = $("pdfCheck"); if (b) b.onclick = pdfCheck;
  }
  function pdfCheck() {
    var h = APP._pdf().h, p = P(), m = p.marche, doc = h.doc0(), titre = "DOSSIER DE CANDIDATURE", sous = (m.ref ? "Réf. " + m.ref + " · " : "") + (m.dateDepot ? "Dépôt le " + fr(m.dateDepot) + (m.heureDepot ? " à " + m.heureDepot : "") : "");
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, m.nomAutorite || ""), body = [];
    PIECES.forEach(function (g) { body.push(h.grp(g[0], 2)); g[1].forEach(function (x) { body.push([h.t(x[1]), m.check[x[0]] ? "Prête" : "A FAIRE"]); }); });
    (m.autres || "").split("\n").filter(Boolean).forEach(function (l) { body.push([h.t(l), ""]); });
    h.table(doc, { startY: y, head: [["Pièce", "Statut"]], body: body, columnStyles: { 0: { cellWidth: 150 }, 1: { halign: "center" } },
      didParseCell: function (d) { if (d.section === "body" && d.column.index === 1 && d.cell.raw === "A FAIRE") { d.cell.styles.textColor = [190, 40, 40]; d.cell.styles.fontStyle = "bold"; } } }, titre, sous);
    h.footers(doc, "Dossier de candidature"); X.saveFile(doc.output("blob"), "Dossier_candidature_" + X.slug(p.info.nom) + ".pdf");
  }

  /* ---------------- PROCÈS-VERBAL DE RÉCEPTION ---------------- */
  function receptionHTML() {
    var p = P(), r = p.reception, ouv = p.opc.reserves.filter(function (x) { return !x.levee; });
    var h = '<div class="card"><h2>Procès-verbal de réception</h2><p class="hint">À signer avec le client à la fin des travaux, même pour un petit chantier. La date de réception sert de point de départ aux garanties et à la libération de la retenue de garantie.</p><div class="form">' +
      fld("N° du PV", "reception.num", { text: true }) + fld("Date de la visite de réception", "reception.date", { date: true }) +
      fld("Lieu", "reception.lieu", { text: true, ph: p.info.adresse || p.info.ville || "" }) +
      fld("Décision", "reception.decision", { options: [["sans", "Réception prononcée sans réserve"], ["avec", "Réception prononcée avec réserves"], ["refus", "Réception refusée / ajournée"]] }) +
      fld("Délai de levée des réserves (jours)", "reception.delai") + fld("Référence du devis ou du marché", "reception.ref", { text: true, ph: (p.devis && p.devis.num) || "" }) +
      fld("Représentant du maître d'ouvrage", "reception.mo", { text: true, ph: p.info.client || "" }) + fld("Maître d'œuvre (si présent)", "reception.moe", { text: true }) +
      fld("Représentant de l'entreprise", "reception.ent", { text: true, ph: S().ent.responsable }) + "</div>" +
      '<label class="f wide"><span>Observations / motif (en cas de refus)</span>' + inp("reception.obs", { area: true, rows: 3 }) + "</label>";
    h += '<p style="margin-top:10px">' + (r.decision === "avec" ? "Les <b>" + ouv.length + "</b> réserve(s) ouverte(s) de l'onglet Réserves seront jointes au PV." : r.decision === "sans" && ouv.length ? '<span class="badge orange">Attention</span> ' + ouv.length + " réserve(s) sont encore ouvertes dans l'onglet Réserves : choisissez « avec réserves » ou levez-les." : "") + "</p>" +
      '<div class="bar-btn"><button class="btn p" id="pdfPV">Générer le PDF du procès-verbal</button>' + (r.decision === "sans" || r.decision === "avec" ? '<button class="btn" id="pvTermine">Marquer le chantier comme terminé</button>' : "") + "</div></div>";
    return h;
  }
  function postReception() {
    $("pdfPV").onclick = pdfPV;
    var t = $("pvTermine"); if (t) t.onclick = function () { var p = P(); p.statut = "termine"; if (p.reception.date) p.dateReception = p.reception.date; X.save(); X.toast("Chantier marqué comme terminé"); X.renderPage(); };
  }
  function pdfPV() {
    var h = APP._pdf().h, p = P(), r = p.reception, e = S().ent, doc = h.doc0(), titre = "PROCÈS-VERBAL DE RÉCEPTION" + (r.num ? " N° " + r.num : ""), sous = "Visite du " + fr(r.date);
    h.header(doc, titre, sous); var y = h.blocProjet(doc, 35, r.mo ? "Représenté par : " + r.mo : "");
    var ref = r.ref || (p.devis && p.devis.num) || "";
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    var intro = doc.splitTextToSize(h.t("Le " + fr(r.date) + (r.lieu ? ", à " + r.lieu : "") + ", il a été procédé, en présence des soussignés, à la visite de réception des travaux désignés ci-dessus, exécutés par l'entreprise " + e.nom + (ref ? " au titre du devis / marché n° " + ref : "") + "."), 182);
    doc.text(intro, 14, y); y += intro.length * 4.6 + 4;
    y = h.table(doc, { startY: y, theme: "plain", body: [["Maître d'ouvrage", r.mo || p.info.client || "-"], ["Entreprise", e.nom + " - " + (r.ent || e.responsable || "")]].concat(r.moe ? [["Maître d'oeuvre", r.moe]] : []).map(function (x) { return [h.t(x[0]), h.t(x[1])]; }), columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } } }, titre, sous) + 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(h.t("Après examen des ouvrages, le maître d'ouvrage décide :"), 14, y); y += 7;
    var dl = +r.delai || 30;
    [["sans", "de prononcer la réception sans réserve ;"], ["avec", "de prononcer la réception avec les réserves listées ci-après, que l'entreprise s'engage à lever dans un délai de " + dl + " jours ;"], ["refus", "de ne pas prononcer la réception (ajournement), pour les motifs indiqués ci-après."]].forEach(function (c) {
      doc.setDrawColor(60, 60, 60); doc.rect(16, y - 3.4, 4, 4); if (r.decision === c[0]) { doc.setFont("helvetica", "bold"); doc.text("X", 16.9, y - 0.2); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); var tx = doc.splitTextToSize(h.t(c[1]), 170); doc.text(tx, 24, y); y += tx.length * 4.6 + 2.5;
    });
    if (r.decision !== "refus") { doc.setFont("helvetica", "normal"); doc.text(h.t("La réception prend effet à la date du " + fr(r.date) + "."), 14, y + 2); y += 8; }
    if (r.decision === "avec") {
      var R = p.opc.reserves.filter(function (x) { return !x.levee; });
      doc.setFont("helvetica", "bold"); doc.text(h.t("Réserves (" + R.length + ")"), 14, y + 2);
      y = h.table(doc, { startY: y + 4, head: [["N°", "Localisation", "Description", "Levée avant le"]], body: R.length ? R.map(function (x, i) { return [i + 1, h.t(x.loc), h.t(x.desc), fr(PL.addDays(r.date, dl))]; }) : [["", "", h.t("(aucune réserve saisie)"), ""]], columnStyles: { 2: { cellWidth: 95 } } }, titre, sous) + 5;
    }
    if (r.obs) { doc.setFont("helvetica", "bold"); doc.text("Observations", 14, y + 2); doc.setFont("helvetica", "normal"); var ob = doc.splitTextToSize(h.t(r.obs), 182); doc.text(ob, 14, y + 7); y += ob.length * 4.6 + 9; }
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5);
    var g = doc.splitTextToSize(h.t("La date de réception constitue le point de départ des délais de garantie et de la responsabilité du constructeur prévus par la réglementation en vigueur. La retenue de garantie éventuelle est libérée dans les conditions prévues au devis ou au marché."), 182);
    if (y + g.length * 4 + 45 > 280) { doc.addPage(); h.header(doc, titre, sous); y = 40; }
    doc.text(g, 14, y + 2); y += g.length * 4 + 8;
    var cols = [["Le maître d'ouvrage", r.mo || p.info.client || ""], ["L'entreprise", r.ent || e.responsable || ""]].concat(r.moe ? [["Le maître d'oeuvre", r.moe]] : []), w = (182 - (cols.length - 1) * 5) / cols.length;
    cols.forEach(function (c, i) {
      var x = 14 + i * (w + 5); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(h.t(c[0]), x + 1, y); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(h.t(c[1] + " (lu et approuvé, signature)"), x + 1, y + 4, { maxWidth: w - 2 });
      doc.setDrawColor(180, 180, 180); doc.rect(x, y + 7, w, 26);
    });
    h.footers(doc, "PV de réception"); X.saveFile(doc.output("blob"), "PV_reception_" + X.slug(p.info.nom) + ".pdf");
  }

  return { pageRapide: pageRapide, postRapide: postRapide, marcheHTML: marcheHTML, postMarche: postMarche, receptionHTML: receptionHTML, postReception: postReception, pdfPV: pdfPV, procedure: procedure };
})();
