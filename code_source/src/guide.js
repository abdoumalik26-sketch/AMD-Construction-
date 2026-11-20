/* =========================================================================
   TABAX – Prise en main
   · Assistant de bienvenue au premier lancement (entreprise, régime, 1er projet)
   · Liste « Bien démarrer » sur le tableau de bord
   · Bouton « ? » d'aide sur chaque page
   · Suppression du projet exemple en un clic
   ========================================================================= */
var GUIDE = (function () {
  "use strict";
  var X = function () { return APP.X; }, S = function () { return APP.X.S(); }, $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return APP.X.esc(s); };

  /* ---------------- Aide par page ---------------- */
  var AIDE = {
    dash: ["Tableau de bord", "La vue d'ensemble de l'entreprise et du projet actif.", ["Les alertes en haut vous disent ce qui demande votre attention aujourd'hui (factures, TVA, commandes, sécurité).", "Les chiffres clés sont ceux du projet choisi dans la liste en haut de l'écran.", "Changez de projet avec la liste déroulante en haut : toutes les pages suivent."], "Ouvrez TABAX chaque matin : en 30 secondes vous savez où agir."],
    projets: ["Projets", "Chaque chantier ou petit travail est un projet : il porte son devis, son planning, son suivi et ses documents.", ["« Nouveau chantier » : pour un bâtiment chiffré à partir du plan (métré complet).", "« Petits travaux » : pour une réparation ou un petit lot chiffré en quelques lignes.", "Remplissez la fiche : client, téléphone, ville, date de livraison promise.", "Passez le statut à « Chantier en cours » le jour du démarrage : le suivi et les alertes s'activent."], "Pour un client public, choisissez « Marché public » : l'onglet donne la procédure et les pièces du dossier."],
    metres: ["Métrés / devis rapide", "Les quantités de l'ouvrage, niveau par niveau, ou les lignes d'un devis rapide.", ["Saisissez les dimensions lues sur le plan : TABAX calcule béton, acier, coffrage, maçonnerie, enduits…", "Vérifiez chaque niveau avant de passer aux prix.", "En petits travaux, choisissez un modèle puis ajustez les quantités."], "Un métré juste, c'est un devis juste : prenez le temps sur les fondations et les planchers."],
    prix: ["Études de prix", "Le prix de vente de chaque ouvrage, à partir de vos coûts réels.", ["Bibliothèque : mettez VOS prix de matériaux, de main-d'œuvre et de matériel.", "Sous-détails : la composition de chaque ouvrage (quantités par unité).", "Coefficient K : vos frais généraux, aléas et bénéfice.", "Devis : le document à envoyer au client (PDF ou WhatsApp)."], "Les prix fournis au départ sont indicatifs (Dakar) : remplacez-les par ceux de vos fournisseurs."],
    planning: ["Planning", "Le calendrier des travaux, calculé à partir des quantités et de vos équipes.", ["Les barres rouges forment le chemin critique : un jour perdu sur elles est un jour perdu sur la livraison.", "Les flèches montrent l'enchaînement des tâches.", "« Et si… » : testez l'effet d'un retard avant de prendre une décision.", "Ajustez la durée ou l'équipe d'une tâche dans le tableau du bas.", "« Figer » enregistre le planning de référence pour comparer plus tard."], "Mettez vos meilleures équipes et commandez en avance pour les tâches critiques."],
    opc: ["OPC et anticipation", "Ce qu'il faut préparer dans les prochains jours pour ne pas bloquer le chantier.", ["Les commandes à passer avant une date, selon les délais de livraison.", "Les points d'arrêt qualité à faire valider (fouilles, ferraillage…).", "L'avancement réel saisi met à jour la date de fin prévue.", "Le lien de suivi permet au client de voir l'avancement sans compte."], "Regardez cette page chaque lundi pour organiser la semaine."],
    terrain: ["Suivi terrain", "Le journal de chantier : ce qui a été fait, par qui, avec quoi.", ["Un rapport par jour : effectifs, avancement des tâches, météo, problèmes.", "Ajoutez des photos : elles sont datées et rangées avec le rapport.", "Plans et réserves : placez chaque réserve à l'endroit exact sur le plan."], "Le chef de chantier peut remplir les rapports depuis son téléphone avec son propre compte."],
    qhse: ["Sécurité (QHSE)", "Prévenir les accidents et garder la trace de ce qui a été fait.", ["La causerie et la check-list du jour avant de démarrer.", "Déclarez tout incident, même sans blessé : c'est ainsi qu'on évite le suivant.", "Le plan de prévention et le registre se sortent en PDF pour les contrôles."], "Urgences : pompiers 18, police 17, gendarmerie 123, SAMU 1515."],
    appro: ["Approvisionnements", "Les quantités de matériaux à acheter et quand.", ["Les besoins totaux du projet (ciment, acier, sable, gravier…).", "Le calendrier d'achat suit le planning.", "Bons de commande : envoyez-les en PDF ou WhatsApp, puis cliquez « Livré » à la réception.", "Stock : ce qui reste sur le chantier, avec une alerte avant la rupture.", "Matériel : engins propres ou loués, coût de location et pannes."], "Commandez le fer et le ciment quelques jours avant le coulage, pas le jour même."],
    factu: ["Finances et comptabilité", "L'argent du chantier et de l'entreprise, expliqué simplement.", ["Situations et factures : ce que le client doit payer, et les relances.", "Dépenses : notez chaque achat avec son lot.", "Tâcherons : contrat, avance, paiements et reste à payer ; le contrat se signe à l'écran.", "Trésorerie : savoir à l'avance si vous manquerez d'argent.", "Comptabilité : journal, frais généraux, TVA à reverser et bilan, sans jargon."], "La TVA encaissée n'est pas à vous : déclarez-la et payez-la avant le 15 du mois suivant."],
    memoires: ["Mémoires techniques", "Les documents pour répondre à un appel d'offres.", ["Méthodologie, moyens humains et matériels, planning, sécurité.", "Les textes se remplissent à partir du projet : relisez-les et adaptez-les."], "Un mémoire adapté au chantier gagne plus souvent qu'un mémoire générique."],
    archives: ["Archives, REX et apprentissage", "La mémoire de l'entreprise, chantier après chantier.", ["Clôturez un chantier terminé : TABAX compare le prévu et le réel (retour d'expérience).", "Les rendements constatés améliorent les prochains devis et plannings.", "Importez les données de chantiers que d'autres vous confient pour enrichir la base."], "Plus vous clôturez de chantiers, plus les estimations deviennent justes."],
    params: ["Paramètres", "Votre entreprise, vos documents et votre compte.", ["Coordonnées, NINEA, RCCM, logo, signature et cachet : ils apparaissent sur tous vos documents.", "Régime fiscal : réel (TVA 18 %) ou CGU (sans TVA).", "Compte en ligne et équipe : invitez vos chefs de chantier.", "Sauvegarde : gardez une copie de vos données sur votre ordinateur."], "Faites une sauvegarde au moins une fois par semaine."]
  };
  function modal(html, large) {
    fermer();
    var d = document.createElement("div"); d.id = "gModal";
    d.style.cssText = "position:fixed;inset:0;background:rgba(15,25,45,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:5vh 12px;overflow:auto";
    d.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:' + (large ? 640 : 540) + 'px;width:100%;padding:22px 24px;box-shadow:0 12px 40px rgba(0,0,0,.25);position:relative"><button id="gX" aria-label="Fermer" style="position:absolute;right:10px;top:8px;border:0;background:none;font-size:24px;cursor:pointer;color:#667">×</button>' + html + "</div>";
    d.onclick = function (e) { if (e.target === d) fermer(); };
    document.body.appendChild(d); $("gX").onclick = fermer;
    return d;
  }
  function fermer() { var m = $("gModal"); if (m) m.remove(); }
  function aide(page) {
    var a = AIDE[page]; if (!a) return;
    modal('<h2 style="margin:0 0 6px">' + esc(a[0]) + '</h2><p style="color:#445">' + esc(a[1]) + '</p><ol style="padding-left:20px;line-height:1.55">' + a[2].map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ol><div class="note" style="margin:10px 0 0">💡 ' + esc(a[3]) + '</div><p style="margin:14px 0 0;text-align:right"><button class="btn" id="gRevoir">Revoir l\'assistant de démarrage</button></p>');
    $("gRevoir").onclick = function () { assistant(0); };
  }

  /* ---------------- Projet exemple ---------------- */
  function estExemple(p) { return /exemple/i.test((p.info && p.info.nom) || ""); }
  function aExemple() { return S().projects.some(estExemple); }
  function supprimerExemples(silencieux) {
    var s = S(), n = s.projects.filter(estExemple).length; if (!n) return;
    s.projects = s.projects.filter(function (p) { return !estExemple(p); });
    if (!s.projects.length) { var v = DATA.projetVide(); s.projects.push(v); }
    if (!s.projects.some(function (p) { return p.id === s.active; })) s.active = s.projects[0].id;
    s.demo = false; X().save(); X().renderTop();
    if (!silencieux) { X().renderPage(); X().toast(n > 1 ? n + " projets exemple supprimés" : "Projet exemple supprimé"); }
  }

  /* ---------------- Assistant de bienvenue ---------------- */
  var w = {}, dejaOuvert = false;
  function assistant(etape) {
    var e = S().ent, s = S();
    if (etape === 0) w = { nom: e.nom || "", tel: e.tel || "", adresse: e.adresse || "", email: e.email || "", ninea: e.ninea || "", regime: e.regime || "reel", debut: "chantier", supEx: true };
    var pts = '<div style="display:flex;gap:6px;margin:0 0 14px">' + [0, 1, 2, 3].map(function (i) { return '<span style="flex:1;height:4px;border-radius:2px;background:' + (i <= etape ? "#2b4a8c" : "#dde2ea") + '"></span>'; }).join("") + "</div>";
    var h = pts, inpt = function (k, l, ph) { return '<label class="f" style="display:block;margin:0 0 10px"><span>' + l + '</span><input data-w="' + k + '" value="' + esc(w[k]) + '" placeholder="' + (ph || "") + '" style="width:100%"></label>'; };
    if (etape === 0) h += '<h2 style="margin:0 0 8px">Bienvenue dans TABAX</h2><p>TABAX vous accompagne du devis à la réception : métré, prix, planning avec chemin critique, suivi de chantier, sécurité, factures et comptabilité.</p><p>En <b>3 petites étapes</b>, on prépare l\'application pour votre entreprise. Vous pourrez tout modifier ensuite dans Paramètres.</p>';
    if (etape === 1) h += '<h2 style="margin:0 0 8px">1. Votre entreprise</h2><p class="hint">Ces informations apparaissent sur vos devis, factures et PV.</p>' + inpt("nom", "Nom de l'entreprise") + inpt("tel", "Téléphone", "+221 …") + inpt("adresse", "Adresse") + inpt("email", "E-mail") + inpt("ninea", "NINEA (facultatif)");
    if (etape === 2) h += '<h2 style="margin:0 0 8px">2. Votre régime fiscal</h2>' + [["reel", "Régime du réel", "Vos factures comportent la TVA à 18 %, que vous reversez chaque mois à l'État. C'est le cas des sociétés (SARL, SA, SUARL) et des entreprises qui dépassent 50 M FCFA de chiffre d'affaires."], ["cgu", "Contribution Globale Unique (CGU)", "Pour une entreprise individuelle de moins de 50 M FCFA TTC de chiffre d'affaires par an : vos factures sont sans TVA, avec un impôt unique calculé sur le chiffre d'affaires."]].map(function (r) { return '<label style="display:flex;gap:10px;align-items:flex-start;border:1px solid ' + (w.regime === r[0] ? "#2b4a8c" : "#dde2ea") + ';border-radius:8px;padding:10px 12px;margin:0 0 8px;cursor:pointer"><input type="radio" name="wReg" value="' + r[0] + '"' + (w.regime === r[0] ? " checked" : "") + '><span><b>' + r[1] + '</b><br><span class="hint">' + r[2] + "</span></span></label>"; }).join("") + '<p class="hint">En cas de doute, demandez à votre centre des impôts (DGID) ou à votre comptable.</p>';
    if (etape === 3) h += '<h2 style="margin:0 0 8px">3. Par quoi commencer ?</h2>' + [["chantier", "Créer mon premier chantier", "Un bâtiment chiffré à partir du plan (villa, immeuble…)."], ["rapide", "Faire un devis de petits travaux", "Réparation, carrelage, peinture, clôture… en quelques lignes."], ["explorer", "Explorer d'abord l'exemple", "Une villa R+1 fictive déjà remplie pour découvrir toutes les pages."]].map(function (r) { return '<label style="display:flex;gap:10px;align-items:flex-start;border:1px solid ' + (w.debut === r[0] ? "#2b4a8c" : "#dde2ea") + ';border-radius:8px;padding:10px 12px;margin:0 0 8px;cursor:pointer"><input type="radio" name="wDeb" value="' + r[0] + '"' + (w.debut === r[0] ? " checked" : "") + '><span><b>' + r[1] + '</b><br><span class="hint">' + r[2] + "</span></span></label>"; }).join("") + (aExemple() ? '<label style="display:block;margin:6px 0 0"><input type="checkbox" id="wSup"' + (w.supEx && w.debut !== "explorer" ? " checked" : "") + (w.debut === "explorer" ? " disabled" : "") + "> Supprimer le projet exemple</label>" : "");
    h += '<div style="display:flex;justify-content:space-between;margin-top:16px">' + (etape ? '<button class="btn" id="wPrev">← Retour</button>' : '<button class="btn" id="wSkip">Plus tard</button>') + '<button class="btn p" id="wNext">' + (etape === 3 ? "Terminer" : etape === 0 ? "Commencer" : "Suivant →") + "</button></div>";
    var md = modal(h), plusTard = function () { s.guide.vu = true; X().save(); fermer(); };
    $("gX").onclick = plusTard; md.onclick = function (ev) { if (ev.target === md) plusTard(); };
    document.querySelectorAll("[data-w]").forEach(function (i) { i.oninput = function () { w[i.dataset.w] = i.value; }; });
    document.querySelectorAll("[name=wReg]").forEach(function (i) { i.onchange = function () { w.regime = i.value; assistant(2); }; });
    document.querySelectorAll("[name=wDeb]").forEach(function (i) { i.onchange = function () { w.debut = i.value; assistant(3); }; });
    if ($("wSup")) $("wSup").onchange = function () { w.supEx = this.checked; };
    if ($("wSkip")) $("wSkip").onclick = function () { s.guide.vu = true; X().save(); fermer(); };
    if ($("wPrev")) $("wPrev").onclick = function () { assistant(etape - 1); };
    $("wNext").onclick = function () {
      if (etape === 1 && !String(w.nom).trim()) { X().toast("Indiquez au moins le nom de l'entreprise"); return; }
      if (etape < 3) return assistant(etape + 1);
      ["nom", "tel", "adresse", "email", "ninea"].forEach(function (k) { if (String(w[k]).trim()) e[k] = String(w[k]).trim(); });
      if (window.COMPTA) COMPTA.changerRegime(w.regime); else e.regime = w.regime;
      s.guide.vu = true; s.guide.regime = true;
      fermer();
      if (w.debut === "explorer") { var ex = s.projects.filter(estExemple)[0]; if (ex) s.active = ex.id; X().save(); X().renderTop(); X().go("dash"); X().toast("Bonne découverte ! Le bouton « ? » de chaque page explique son rôle."); return; }
      var p = DATA.projetVide(); if (w.debut === "rapide") { p.mode = "rapide"; p.info.nom = "Petits travaux"; }
      s.projects.push(p); s.active = p.id; s.demo = false;
      if (w.supEx && aExemple()) supprimerExemples(true);
      X().setStateRaw(s); X().save(); X().renderTop();
      X().go(w.debut === "rapide" ? "metres" : "projets"); X().toast(w.debut === "rapide" ? "Choisissez un modèle et ajustez les lignes" : "Remplissez la fiche de votre chantier");
    };
  }

  /* ---------------- Liste « Bien démarrer » ---------------- */
  function etapes() {
    var s = S(), e = s.ent, g = s.guide;
    return [
      ["Coordonnées de l'entreprise", !!(e.nom && e.tel), "params"],
      ["NINEA et RCCM", !!(e.ninea && e.rccm), "params"],
      ["Logo, signature et cachet", !!(e.logo && (e.signature || e.cachet)), "params"],
      ["Régime fiscal choisi", !!g.regime, "params"],
      ["Vos prix vérifiés dans la bibliothèque", !!g.prix, "prix:biblio"],
      ["Premier vrai projet créé", s.projects.some(function (p) { return !estExemple(p); }), "projets"],
      ["Projet exemple supprimé", !aExemple(), "supEx"],
      ["Première sauvegarde", !!(s.sauvegarde && s.sauvegarde.derniere), "params"]
    ];
  }
  function dashHTML() {
    var s = S(); if (s.guide.masque || (window.SYNC && SYNC.estCollab())) return "";
    var E = etapes(), ok = E.filter(function (x) { return x[1]; }).length; if (ok === E.length) return "";
    return '<div class="card"><h2>Bien démarrer avec TABAX <span style="font-weight:400;color:#667;font-size:13px">' + ok + "/" + E.length + '</span></h2><div style="height:6px;background:#e6eaf1;border-radius:3px;margin:4px 0 10px"><div style="height:6px;border-radius:3px;background:#2e8b57;width:' + Math.round(100 * ok / E.length) + '%"></div></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px 18px">' +
      E.map(function (x) { return '<div style="display:flex;align-items:center;gap:8px;padding:3px 0"><span style="width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;' + (x[1] ? "background:#2e8b57;color:#fff" : "border:2px solid #c3cad6") + '">' + (x[1] ? "✓" : "") + '</span><span style="flex:1;' + (x[1] ? "color:#889;text-decoration:line-through" : "") + '">' + x[0] + "</span>" + (x[1] ? "" : '<button class="btn sm" data-gg="' + x[2] + '">' + (x[2] === "supEx" ? "Supprimer" : "Faire") + "</button>") + "</div>"; }).join("") +
      '</div><p style="margin:10px 0 0"><button class="btn sm" id="gAssist">Relancer l\'assistant</button> <button class="btn sm" id="gMasq">Masquer cette liste</button></p></div>';
  }

  /* ---------------- Branchement après chaque affichage ---------------- */
  function apresRendu(page) {
    var s = S(); s.guide = s.guide || {};
    // bouton « ? »
    var h1 = document.querySelector("#content .head h1");
    if (h1 && AIDE[page] && !h1.querySelector(".gHelp")) {
      var b = document.createElement("button"); b.className = "gHelp"; b.type = "button"; b.title = "Aide : à quoi sert cette page ?"; b.textContent = "?";
      b.style.cssText = "margin-left:10px;width:26px;height:26px;border-radius:50%;border:1.5px solid #2b4a8c;background:#fff;color:#2b4a8c;font-weight:700;font-size:14px;cursor:pointer;vertical-align:middle";
      b.onclick = function () { aide(page); }; h1.appendChild(b);
    }
    if (page === "prix" && (APP.X.ui.sub.prix === "biblio") && !s.guide.prix) { s.guide.prix = true; X().save(); }
    if (page === "params" && !s.guide.regime && $("regSel")) $("regSel").addEventListener("change", function () { s.guide.regime = true; X().save(); });
    // bouton « supprimer l'exemple » sur la page Projets
    if (page === "projets" && aExemple()) { var bar = document.querySelector("#content .bar-btn"); if (bar && !$("supEx")) { var x = document.createElement("button"); x.className = "btn danger"; x.id = "supEx"; x.textContent = "Supprimer le projet exemple"; x.onclick = function () { if (x.dataset.c !== "1") { x.dataset.c = "1"; x.textContent = "Confirmer : supprimer l'exemple"; return; } supprimerExemples(); }; bar.appendChild(x); } }
    // tableau de bord
    document.querySelectorAll("[data-gg]").forEach(function (b) { b.onclick = function () { var v = b.dataset.gg; if (v === "supEx") return supprimerExemples(); var k = v.split(":"); X().go(k[0], k[1]); }; });
    if ($("gAssist")) $("gAssist").onclick = function () { assistant(0); };
    if ($("gMasq")) $("gMasq").onclick = function () { s.guide.masque = true; X().save(); X().renderPage(); };
    if ($("gSupEx")) $("gSupEx").onclick = function () { supprimerExemples(); };
    // premier lancement
    if (!s.guide.vu && !dejaOuvert && !(window.SYNC && SYNC.estCollab()) && !/suivi=/.test(location.hash)) { dejaOuvert = true; setTimeout(function () { assistant(0); }, 300); }
  }

  return { apresRendu: apresRendu, dashHTML: dashHTML, aide: aide, assistant: assistant, supprimerExemples: supprimerExemples, AIDE: AIDE, fermer: fermer };
})();
if (typeof module !== "undefined") module.exports = GUIDE;
