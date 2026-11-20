/* =========================================================================
   TABAX – Notifications et rapport du lundi
   · Notifications du navigateur (alertes rouges et orange : retards, commandes,
     stock bas, factures impayées, tâcherons payés en avance, sauvegarde)
   · Rapport hebdomadaire de tous les chantiers en cours (PDF + WhatsApp),
     mis en avant chaque lundi
   ========================================================================= */
var HEBDO = (function () {
  "use strict";
  var X = APP.X, PL = PLAN, S = function () { return X.S(); }, $ = function (id) { return document.getElementById(id); };
  var esc = X.esc, fmt = X.fmt;
  function n(v) { v = parseFloat(v); return isFinite(v) ? v : 0; }
  function jour() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function fr(d) { return d ? d.split("-").reverse().join("/") : "-"; }
  function lundi(d) { var x = new Date(d + "T12:00:00"), k = (x.getDay() + 6) % 7; return PL.addDays(d, -k); }
  function chantiers() { return S().projects.filter(function (p) { return !p.archive && p.statut === "chantier" && !/exemple/i.test(p.info.nom); }); }

  /* ---------------- Toutes les alertes ---------------- */
  function alertes() {
    var s = S(), j = jour(), A = [];
    try { A = PL.alertes(s.projects.filter(function (p) { return !/exemple/i.test(p.info.nom); }), X.ST(), j, s.ent); } catch (e) { A = []; }
    s.projects.forEach(function (p) {
      if (p.archive || /exemple/i.test(p.info.nom) || !window.CHT) return;
      CHT.alertesStock(p).forEach(function (x) { A.push({ niv: "orange", projet: p.info.nom, pid: p.id, type: "Stock", msg: x.nom + " : il reste " + fmt(Math.max(0, x.stock), 1) + " " + x.u + (x.jours != null ? " (≈ " + fmt(Math.max(0, x.jours)) + " jours)" : "") + ". Recommandez." }); });
      (p.tacherons || []).forEach(function (t) { var m = CHT.montantTach(t), pa = CHT.payeTach(p, t.id); if (m > 0 && 100 * pa / m > n(t.avancement) + 5) A.push({ niv: "orange", projet: p.info.nom, pid: p.id, type: "Tâcheron", msg: (t.nom || "Tâcheron") + " : payé " + fmt(100 * pa / m) + " % pour " + fmt(t.avancement) + " % de travail fait." }); });
      (p.materiel || []).forEach(function (m) { if (m.etat === "panne") A.push({ niv: "orange", projet: p.info.nom, pid: p.id, type: "Matériel", msg: (m.nom || "Matériel") + " en panne." }); });
    });
    var sv = s.sauvegarde || {}; if (s.projects.some(function (p) { return !/exemple/i.test(p.info.nom); }) && (!sv.derniere || PL.diff(sv.derniere.slice(0, 10), j) > 7)) A.push({ niv: "orange", projet: "Entreprise", type: "Sauvegarde", msg: sv.derniere ? "Dernière sauvegarde il y a " + PL.diff(sv.derniere.slice(0, 10), j) + " jours." : "Aucune sauvegarde de vos données n'a encore été faite." });
    return A;
  }

  /* ---------------- Notifications ---------------- */
  function supporte() { return "Notification" in window; }
  function cle(a) { return (a.pid || "") + "|" + a.type + "|" + a.msg.slice(0, 60); }
  function notifier(titre, corps, tag) {
    var opt = { body: corps, tag: tag || "tabax", icon: "icone-192.png", badge: "icone-192.png" };
    try {
      var direct = function () { try { new Notification(titre, opt); } catch (e) {} };
      if (navigator.serviceWorker && navigator.serviceWorker.controller) return Promise.race([navigator.serviceWorker.ready, new Promise(function (r) { setTimeout(r, 1500); })]).then(function (reg) { if (reg && reg.showNotification) return reg.showNotification(titre, opt); direct(); }).catch(direct);
      direct();
    } catch (e) {}
  }
  function verifier(force) {
    var s = S(), nf = s.notif = s.notif || {}; if (!nf.actif || !supporte() || Notification.permission !== "granted") return;
    var j = jour(); if (nf.jour !== j) { nf.jour = j; nf.vues = []; }
    var A = alertes().filter(function (a) { return a.niv === "rouge" || a.niv === "orange"; }), nouv = A.filter(function (a) { return nf.vues.indexOf(cle(a)) < 0; });
    if (nouv.length || force) {
      var L = (nouv.length ? nouv : A).slice().sort(function (a, b) { return a.niv === b.niv ? 0 : a.niv === "rouge" ? -1 : 1; });
      if (L.length) notifier("TABAX : " + L.length + " point" + (L.length > 1 ? "s" : "") + " à surveiller", L.slice(0, 3).map(function (a) { return "• " + (a.projet ? a.projet + " – " : "") + a.msg; }).join("\n"), "tabax-alertes");
      else if (force) notifier("TABAX", "Aucune alerte en cours. Tout est sous contrôle.", "tabax-alertes");
      nouv.forEach(function (a) { nf.vues.push(cle(a)); });
    }
    var lu = lundi(j); if (j === lu && nf.hebdo !== lu && chantiers().length) { nf.hebdo = lu; notifier("TABAX : c'est lundi", "Votre rapport de la semaine est prêt (" + chantiers().length + " chantier" + (chantiers().length > 1 ? "s" : "") + "). Ouvrez le tableau de bord.", "tabax-hebdo"); }
    X.save();
  }
  var minuterie = null;
  function demarrer() { if (minuterie) return; setTimeout(function () { verifier(); }, 4000); minuterie = setInterval(function () { verifier(); }, 30 * 60 * 1000); }
  function paramsHTML() {
    var s = S(), nf = s.notif || {}, perm = supporte() ? Notification.permission : "absent";
    return '<div class="card"><h2>Notifications</h2><p class="hint">TABAX vous prévient sur cet appareil (ordinateur ou téléphone) dès qu\'un point demande votre attention : tâche critique en retard, commande à passer, stock presque vide, facture impayée, tâcheron payé en avance, sauvegarde oubliée. Et chaque lundi matin, votre rapport de la semaine.</p>' +
      (perm === "absent" ? '<div class="note">Ce navigateur ne gère pas les notifications. Utilisez Chrome ou Edge.</div>' :
        perm === "denied" ? '<div class="note rouge">Les notifications sont bloquées pour TABAX dans ce navigateur. Cliquez sur le cadenas à gauche de l\'adresse, puis autorisez les notifications.</div>' :
          '<div class="bar-btn"><label><input type="checkbox" id="nfOn"' + (nf.actif && perm === "granted" ? " checked" : "") + '> Recevoir les alertes sur cet appareil</label>' + (nf.actif && perm === "granted" ? '<button class="btn sm" id="nfTest">Tester maintenant</button>' : "") + "</div>") +
      '<p class="hint">Les notifications arrivent quand TABAX est ouvert, même en arrière-plan ou réduit dans la barre des tâches. Pour les recevoir application fermée, il faudra un service d\'envoi en ligne (à ajouter plus tard avec le compte en ligne).</p></div>';
  }
  function postParams() {
    var c = $("nfOn"); if (c) c.onchange = function () {
      var s = S(); s.notif = s.notif || {};
      if (!this.checked) { s.notif.actif = false; X.save(); X.renderPage(); return; }
      Notification.requestPermission().then(function (r) { s.notif.actif = r === "granted"; s.notif.vues = []; X.save(); X.renderPage(); if (r === "granted") { X.toast("Notifications activées"); verifier(true); demarrer(); } else X.toast("Notifications refusées par le navigateur"); });
    };
    var t = $("nfTest"); if (t) t.onclick = function () { S().notif.vues = []; verifier(true); };
  }

  /* ---------------- Rapport de la semaine ---------------- */
  function semaine(p, j) {
    var q = CALC.dqe(p, X.ST()), d1 = PL.addDays(lundi(j), -7), d2 = PL.addDays(d1, 6), n1 = PL.addDays(d2, 1), n2 = PL.addDays(n1, 6);
    var F = PL.prevision(p, q, j), F0 = PL.prevision(p, q, PL.addDays(d1, -1)), F1 = PL.prevision(p, q, d2), idx0 = {}; F0.taches.forEach(function (t) { idx0[t.id] = t; });
    var poids = function (FF) { var tot = 0, fait = 0; FF.taches.forEach(function (t) { var w = Math.max(1, t.dur); tot += w; fait += w * t.pct / 100; }); return tot ? 100 * fait / tot : 0; };
    var prevuPct = (function () { var tot = 0, f = 0; F.base.taches.forEach(function (t) { var w = Math.max(1, t.dur); tot += w; if (j >= t.fin) f += w; else if (j >= t.debut) f += w * (PL.joursOuvres(t.debut, j, F.cfg) / Math.max(1, t.dur)); }); return tot ? 100 * f / tot : 0; })();
    var avances = F1.taches.map(function (t) { var a = idx0[t.id] ? idx0[t.id].pct : 0; return { nom: t.nom, de: a, a: t.pct }; }).filter(function (x) { return x.a > x.de + 0.5; });
    var R = ((p.suivi || {}).rapports || []).filter(function (r) { return r.date >= d1 && r.date <= d2; });
    var eff = R.length ? R.reduce(function (s, r) { return s + Object.keys(r.eff || {}).reduce(function (a, k) { return a + n(r.eff[k]); }, 0); }, 0) / R.length : 0;
    var inc = R.filter(function (r) { return (r.incidents || "").trim(); }).map(function (r) { return fr(r.date) + " : " + r.incidents.trim(); });
    var dep = ((p.factu || {}).achats || []).filter(function (a) { return a.date >= d1 && a.date <= d2; }).reduce(function (s, a) { return s + n(a.mt); }, 0) + R.reduce(function (s, r) { return s + (r.dep || []).reduce(function (a, x) { return a + n(x.mt); }, 0); }, 0);
    var enc = 0; (((p.factu || {}).docs) || []).forEach(function (d) { (d.paiements || []).forEach(function (x) { if (x.date >= d1 && x.date <= d2) enc += n(x.mt); }); });
    var avenir = F.taches.filter(function (t) { return t.pct < 100 && t.pDebut <= n2 && t.pFin >= n1; }).map(function (t) { return { nom: t.nom, debut: t.pDebut, fin: t.pFin, pct: t.pct, crit: t.critique, equipe: t.equipe, metier: t.metier }; });
    var cmd = []; F.taches.forEach(function (t) { if (t.pct === 0 && t.appro) t.appro.forEach(function (c) { if (((p.opc || {}).commandes || {})[t.id + "|" + c]) return; var av = PL.addDays(t.pDebut, -(PL.APPRO[c] || 7) - 2); if (av <= n2) cmd.push({ cat: c, pour: t.nom, avant: av }); }); });
    var res = ((p.opc || {}).reserves || []).filter(function (r) { return !r.levee; });
    var crit = PL.critiqueReel(F), idf = {}; F.taches.forEach(function (t) { idf[t.id] = t; });
    return { p: p, d1: d1, d2: d2, n1: n1, n2: n2, reel: poids(F), prevu: Math.min(100, prevuPct), fin: F.fin, livraison: p.info.dateLivraison, avances: avances, nbRap: R.length, eff: eff, inc: inc, dep: dep, enc: enc, avenir: avenir, cmd: cmd, res: res, crit: crit.slice(0, 4).map(function (id) { return idf[id] && idf[id].nom; }).filter(Boolean), al: alertes().filter(function (a) { return a.pid === p.id; }) };
  }
  function pdfSemaine() {
    var C = chantiers(); if (!C.length) return X.toast("Aucun chantier en cours (statut « Chantier en cours »)");
    var h = APP._pdf().h, j = jour(), doc = h.doc0(), titre = "RAPPORT DE LA SEMAINE", W = C.map(function (p) { return semaine(p, j); }), sous = "Semaine du " + fr(W[0].d1) + " au " + fr(W[0].d2);
    h.header(doc, titre, sous);
    var y = h.table(doc, { startY: 40, head: [["Chantier", "Avancement réel", "Prévu", "Fin prévue", "Livraison promise", "Dépenses semaine", "Encaissé semaine", "Alertes"]], body: W.map(function (w) { var r = w.livraison ? PL.diff(w.fin, w.livraison) : null; return [h.t(w.p.info.nom), fmt(w.reel) + " %", fmt(w.prevu) + " %", fr(w.fin) + (r != null && r < 0 ? h.t(" (" + (-r) + " j de retard)") : ""), fr(w.livraison), h.f(w.dep), h.f(w.enc), String(w.al.filter(function (a) { return a.niv === "rouge"; }).length) + h.t(" rouge(s)")]; }), styles: { fontSize: 8 } }, titre, sous) + 6;
    W.forEach(function (w) {
      doc.addPage(); var st = w.p.info.nom; h.header(doc, titre, st); y = 40;
      var sec = function (t) { if (y > 262) { doc.addPage(); h.header(doc, titre, st); y = 40; } doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(30, 30, 30); doc.text(h.t(t), 14, y); y += 2; };
      var tab = function (head, body, o) { y = h.table(doc, Object.assign({ startY: y + 1, head: [head], body: body }, o || {}), titre, st) + 6; };
      var txt = function (t) { doc.setFont("helvetica", "normal"); doc.setFontSize(9); var L = doc.splitTextToSize(h.t(t), 182); doc.text(L, 14, y + 4); y += L.length * 4.2 + 6; };
      var ecart = w.reel - w.prevu;
      sec("En bref"); txt("Avancement réel " + fmt(w.reel) + " % pour " + fmt(w.prevu) + " % prévu (" + (ecart >= 0 ? "en avance de " : "en retard de ") + fmt(Math.abs(ecart)) + " points). Fin prévue le " + fr(w.fin) + (w.livraison ? " pour une livraison promise le " + fr(w.livraison) : "") + ". " + w.nbRap + " rapport(s) de chantier cette semaine, effectif moyen " + fmt(w.eff, 1) + " personnes. Dépenses : " + fmt(w.dep) + " FCFA ; encaissements : " + fmt(w.enc) + " FCFA." + (w.crit.length ? " Chemin critique actuel : " + w.crit.join(" > ") + "…" : ""));
      sec("Travail réalisé la semaine passée"); if (w.avances.length) tab(["Tâche", "Avancement début de semaine", "Fin de semaine"], w.avances.map(function (a) { return [h.t(a.nom), fmt(a.de) + " %", fmt(a.a) + " %"]; })); else txt("Aucun avancement déclaré dans les rapports de chantier de la semaine.");
      if (w.inc.length) { sec("Incidents signalés"); txt(w.inc.join("\n")); }
      sec("Programme de la semaine du " + fr(w.n1) + " au " + fr(w.n2)); if (w.avenir.length) tab(["Tâche", "Début", "Fin", "Fait", "Critique"], w.avenir.map(function (t) { return [h.t(t.nom), fr(t.debut), fr(t.fin), fmt(t.pct) + " %", t.crit ? "OUI" : ""]; })); else txt("Aucune tâche prévue.");
      if (w.cmd.length) { sec("Commandes à passer"); tab(["Fourniture", "Pour la tâche", "Commander avant le"], w.cmd.map(function (c) { return [h.t(c.cat), h.t(c.pour), fr(c.avant)]; })); }
      if (w.res.length) { sec("Réserves à lever (" + w.res.length + ")"); tab(["Localisation", "Description", "Responsable", "Avant le"], w.res.slice(0, 15).map(function (r) { return [h.t(r.loc || "-"), h.t(r.desc || "-"), h.t(r.resp || "-"), fr(r.ech)]; })); }
      if (w.al.length) { sec("Points de vigilance"); tab(["Niveau", "Sujet", "Détail"], w.al.slice(0, 15).map(function (a) { return [a.niv === "rouge" ? "URGENT" : a.niv === "orange" ? h.t("À suivre") : "Info", h.t(a.type), h.t(a.msg)]; }), { columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 26 } } }); }
    });
    h.footers(doc, titre); X.saveFile(doc.output("blob"), "Rapport_semaine_" + W[0].d1 + ".pdf");
    var s = S(); s.notif = s.notif || {}; s.notif.hebdoFait = lundi(j); X.save();
  }
  function messageSemaine() {
    var j = jour(), W = chantiers().map(function (p) { return semaine(p, j); });
    return "*Rapport de la semaine – " + S().ent.nom + "*\nSemaine du " + fr((W[0] || {}).d1) + " au " + fr((W[0] || {}).d2) + "\n\n" + W.map(function (w) { return "*" + w.p.info.nom + "* : " + fmt(w.reel) + " % fait (prévu " + fmt(w.prevu) + " %), fin prévue le " + fr(w.fin) + ". Semaine à venir : " + (w.avenir.slice(0, 3).map(function (t) { return t.nom; }).join(", ") || "rien de prévu") + "."; }).join("\n");
  }
  function dashHTML() {
    if (window.SYNC && SYNC.estCollab()) return "";
    var C = chantiers(), j = jour(), lu = lundi(j), s = S(), nf = s.notif || {}; if (!C.length) return "";
    var estLundi = j === lu, fait = nf.hebdoFait === lu;
    return '<div class="card"' + (estLundi && !fait ? ' style="border:2px solid #2b4a8c"' : "") + '><h2>Rapport de la semaine' + (estLundi && !fait ? ' <span class="badge orange">c\'est lundi : il est prêt</span>' : "") + '</h2><p class="hint">Tous vos chantiers en cours (' + C.length + ") : travail fait la semaine passée, programme de la semaine, commandes, réserves et points de vigilance. À lire chaque lundi matin et à partager avec votre équipe.</p>" +
      '<div class="bar-btn"><button class="btn p" id="hbPdf">Rapport de la semaine (PDF)</button><button class="btn" id="hbWa">Résumé par WhatsApp</button>' + (supporte() && !(nf.actif && Notification.permission === "granted") ? '<button class="btn" data-go="params">Activer les notifications</button>' : "") + "</div></div>";
  }
  function apresRendu(page) {
    var b; if ((b = $("hbPdf"))) b.onclick = pdfSemaine;
    if ((b = $("hbWa"))) b.onclick = function () { var msg = messageSemaine(); if (window.PIL) PIL.envoyer(pdfSemaine, "", msg); else pdfSemaine(); };
    if (page === "params") postParams();
    document.querySelectorAll("#content [data-go='params']").forEach(function (x) { x.onclick = function (e) { e.preventDefault(); X.go("params"); }; });
    demarrer();
  }
  return { alertes: alertes, verifier: verifier, paramsHTML: paramsHTML, dashHTML: dashHTML, apresRendu: apresRendu, pdfSemaine: pdfSemaine, semaine: semaine, messageSemaine: messageSemaine };
})();
