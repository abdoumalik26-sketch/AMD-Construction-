/* =========================================================
   2AM CONSTRUCTION — Outils
   · Signature à l'écran (devis, PV de réception) + signature et cachet de l'entreprise
   · Tableau de bord de l'entreprise (carnet de commandes, CA, encaissements)
   · Données externes : modèle Excel à envoyer à des confrères, import et
     rapprochement, utilisées (avec un poids réduit) pour l'apprentissage
   · Réponse à un appel d'offres : lecture du DQE / BPU Excel du DAO,
     rapprochement avec la bibliothèque, export Excel rempli
   ========================================================= */
var OUT = (function () {
  var X = APP.X, PL = PLAN, Cc = CALC, D = DATA, esc = X.esc, fmt = X.fmt;
  var $ = function (id) { return document.getElementById(id); };
  function S() { return X.S(); }
  function P() { return X.P(); }
  function fr(s) { return PL.fr(s); }
  function today() { return PL.d2s(new Date()); }
  function n(v) { if (typeof v === "string") v = v.replace(/\s/g, "").replace(",", "."); v = parseFloat(v); return isFinite(v) ? v : 0; }
  function badge(niv, t) { return '<span class="badge ' + niv + '">' + esc(t) + "</span>"; }

  /* =====================================================
     1. SIGNATURE À L'ÉCRAN
     ===================================================== */
  function signer(titre, cb) {
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;background:rgba(10,20,40,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px";
    ov.innerHTML = '<div style="background:#fff;border-radius:12px;padding:16px;width:100%;max-width:560px"><h2 style="margin:0 0 8px;font-size:16px">' + esc(titre) + '</h2><p class="hint" style="margin:0 0 8px">Signez dans le cadre avec le doigt ou la souris.</p><canvas id="sigCv" width="520" height="200" style="width:100%;border:1px dashed #9aa3b5;border-radius:8px;touch-action:none;background:#fafbfd"></canvas><div class="bar-btn" style="margin-top:10px"><button class="btn p" id="sigOk">Valider la signature</button><button class="btn" id="sigClr">Effacer</button><button class="btn" id="sigNo">Annuler</button></div></div>';
    document.body.appendChild(ov);
    var cv = $("sigCv"), cx = cv.getContext("2d"), dessin = false, vide = true;
    cx.lineWidth = 2.4; cx.lineCap = "round"; cx.strokeStyle = "#13204a";
    function pos(e) { var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * cv.width / r.width, (t.clientY - r.top) * cv.height / r.height]; }
    function deb(e) { e.preventDefault(); dessin = true; var p = pos(e); cx.beginPath(); cx.moveTo(p[0], p[1]); }
    function mv(e) { if (!dessin) return; e.preventDefault(); var p = pos(e); cx.lineTo(p[0], p[1]); cx.stroke(); vide = false; }
    function fin() { dessin = false; }
    ["mousedown", "touchstart", "pointerdown"].forEach(function (k) { cv.addEventListener(k, deb, { passive: false }); });
    ["mousemove", "touchmove", "pointermove"].forEach(function (k) { cv.addEventListener(k, mv, { passive: false }); });
    ["mouseup", "mouseleave", "touchend", "pointerup"].forEach(function (k) { cv.addEventListener(k, fin); });
    function fermer() { ov.remove(); }
    $("sigClr").onclick = function () { cx.clearRect(0, 0, cv.width, cv.height); vide = true; };
    $("sigNo").onclick = fermer;
    $("sigOk").onclick = function () { if (vide) { X.toast("Signez d'abord dans le cadre"); return; } var u = cv.toDataURL("image/png"); fermer(); cb(u); };
  }
  function signatureHTML(cle, libelle) {
    var p = P(), sg = p.signatures[cle];
    return '<div class="sigbox" style="display:inline-block;margin:6px 12px 6px 0;vertical-align:top"><div class="hint">' + esc(libelle) + "</div>" + (sg ? '<img src="' + sg.img + '" style="height:60px;border:1px solid var(--line);border-radius:6px;background:#fff;display:block"><div class="hint">' + esc(sg.nom || "") + " · " + fr(sg.date) + '</div><button class="btn sm" data-sigdel="' + cle + '">Effacer</button>' : '<button class="btn sm p" data-sig="' + cle + '" data-siglab="' + esc(libelle) + '">Signer à l\'écran</button>') + "</div>";
  }
  function lierSignatures() {
    var p = P();
    document.querySelectorAll("[data-sig]").forEach(function (b) { b.onclick = function () { var cle = b.dataset.sig; signer(b.dataset.siglab, function (img) { p.signatures[cle] = { img: img, date: today(), nom: cle.indexOf("Client") >= 0 || cle === "pvMO" ? (p.reception && p.reception.mo) || p.info.client || "" : "" }; X.save(); X.renderPage(); X.toast("Signature enregistrée : elle figurera sur le PDF"); }); }; });
    document.querySelectorAll("[data-sigdel]").forEach(function (b) { b.onclick = function () { delete p.signatures[b.dataset.sigdel]; X.save(); X.renderPage(); }; });
  }
  // Signature et cachet de l'entreprise (Paramètres)
  function entrepriseSigHTML() {
    var e = S().ent;
    return '<div class="card"><h2>Ma signature et mon cachet</h2><p class="hint">Ajoutés automatiquement sur les devis, factures et PV de réception.</p><div style="display:flex;gap:24px;flex-wrap:wrap"><div><div class="hint">Signature</div>' + (e.signature ? '<img src="' + e.signature + '" style="height:60px;border:1px solid var(--line);border-radius:6px;background:#fff;display:block"><button class="btn sm" id="entSigDel">Effacer</button>' : '<button class="btn sm p" id="entSig">Dessiner ma signature</button>') + '</div><div><div class="hint">Cachet (photo ou scan, fond blanc)</div>' + (e.cachet ? '<img src="' + e.cachet + '" style="height:70px;display:block"><button class="btn sm" id="entCachDel">Retirer</button>' : '<label class="btn sm">Ajouter le cachet<input type="file" accept="image/*" id="entCach" hidden></label>') + "</div></div></div>";
  }
  function postEntrepriseSig() {
    var e = S().ent, b;
    if ((b = $("entSig"))) b.onclick = function () { signer("Signature de " + (e.responsable || "l'entreprise"), function (img) { e.signature = img; X.save(); X.renderPage(); }); };
    if ((b = $("entSigDel"))) b.onclick = function () { e.signature = ""; X.save(); X.renderPage(); };
    if ((b = $("entCachDel"))) b.onclick = function () { e.cachet = ""; X.save(); X.renderPage(); };
    if ((b = $("entCach"))) b.onchange = function () {
      var f = this.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () { var im = new Image(); im.onload = function () { var k = Math.min(1, 300 / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = im.width * k; cv.height = im.height * k; cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); e.cachet = cv.toDataURL("image/png"); X.save(); X.renderPage(); }; im.src = rd.result; };
      rd.readAsDataURL(f);
    };
  }
  // Ajout des images dans un cadre de signature d'un PDF
  function imgPDF(doc, img, x, y, w, h) { if (!img) return; try { doc.addImage(img, /^data:image\/jpe?g/.test(img) ? "JPEG" : "PNG", x, y, w, h, undefined, "FAST"); } catch (e) {} }
  function signerPDF(doc, x, y, w, h, img, cachet) {   // cadre (x,y,w,h) : cachet à gauche, signature à droite
    if (cachet) imgPDF(doc, cachet, x + 2, y + 2, Math.min(h - 4, 24), Math.min(h - 4, 24));
    if (img) imgPDF(doc, img, x + w * 0.38, y + 3, w * 0.58, Math.min(h - 6, w * 0.58 * 200 / 520));
  }

  /* =====================================================
     2. TABLEAU DE BORD DE L'ENTREPRISE
     ===================================================== */
  function entrepriseHTML() {
    var s = S(), an = today().slice(0, 4), e = s.ent, dl = n(e.delaiPaiement) || 30;
    var reels = s.projects.filter(function (p) { return !/exemple/i.test(p.info.nom || ""); });
    var carnet = 0, caAn = 0, encAn = 0, reste = 0, echu = 0, devis = 0, nbDevis = 0, enCours = 0, termAn = 0, marges = [];
    reels.forEach(function (p) {
      var m = p.factu.marche, docs = p.factu.docs || [];
      var factHT = docs.reduce(function (a, d) { return a + (d.type === "situation" ? n(d.periodeHT) : 0); }, 0);
      if (m && !p.archive) carnet += Math.max(0, n(m.ht) - factHT);
      docs.forEach(function (d) {
        if ((d.date || "").slice(0, 4) === an) caAn += d.type === "acompte" ? n(d.ht) : d.type === "situation" ? n(d.periodeHT) : 0;
        var du = d.type === "situation" ? n(d.net) : n(d.ttc), pay = 0;
        (d.paiements || []).forEach(function (x) { pay += n(x.mt); if ((x.date || "").slice(0, 4) === an) encAn += n(x.mt); });
        if (du - pay > 1) { reste += du - pay; if (PL.addDays(d.date, dl) < today()) echu += du - pay; }
      });
      if (p.statut === "etude" && !p.archive) { var q = Cc.dqe(p, X.ST()); if (q.ttc > 0) { devis += q.ttc; nbDevis++; } }
      if (p.statut === "chantier" && !p.archive) { enCours++; var q2 = Cc.dqe(p, X.ST()); if (q2.ht) marges.push(100 * (q2.ht - q2.ds) / q2.ht); }
      if (p.rex && (p.rex.dates.finReelle || "").slice(0, 4) === an) termAn++;
    });
    var M = function (v) { return fmt(v / 1e6, 1) + " M"; };
    return '<div class="card"><h2>Mon entreprise en ' + an + '</h2><div class="kpis">' +
      X.kpi("Carnet de commandes", M(carnet), "FCFA HT restant à réaliser (marchés signés)") + X.kpi("Chiffre d'affaires facturé", M(caAn), "FCFA HT depuis le 1er janvier") +
      X.kpi("Encaissé", M(encAn), "FCFA depuis le 1er janvier") + X.kpi("Reste à encaisser", M(reste), echu > 1 ? "dont " + M(echu) + " en retard" : "aucun retard") +
      X.kpi("Devis en attente", nbDevis + " devis", M(devis) + " FCFA TTC") + X.kpi("Chantiers", enCours + " en cours", termAn + " terminé(s) cette année" + (marges.length ? " · marge prévue moy. " + fmt(marges.reduce(function (a, b) { return a + b; }, 0) / marges.length, 1) + " %" : "")) + "</div>" +
      repereHTML() + "</div>";
  }

  /* =====================================================
     3. DONNÉES EXTERNES (confrères, amis, études)
     ===================================================== */
  var STOP = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, en: 1, y: 1, compris: 1, pour: 1, et: 1, a: 1, au: 1, aux: 1, sur: 1, avec: 1, d: 1, l: 1, par: 1, un: 1, une: 1, dans: 1, ou: 1, sous: 1, the: 1, of: 1, toutes: 1, sujetions: 1, fourniture: 1, pose: 1, mise: 1, oeuvre: 1 };
  var SYN = { parpaing: "agglo", parpaings: "agglo", agglos: "agglo", agglomeres: "agglo", agglomere: "agglo", ba: "beton arme", hourdi: "hourdis", carreau: "carrelage", carreaux: "carrelage", fers: "fer", acier: "fer", aciers: "fer", peintures: "peinture", enduits: "enduit", fouilles: "fouille", semelles: "semelle", poteaux: "poteau", poutres: "poutre", chainage: "chainage", chainages: "chainage", longrines: "longrine", wc: "wc", lavabos: "lavabo", portes: "porte", fenetres: "fenetre", m3: "", m2: "", ml: "" };
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/[^a-z0-9]+/g, " ").trim(); }
  function tokens(s) { var out = []; norm(s).replace(/(\d+(?: \d+)?) ?x ?\d+( ?x ?\d+)?/g, "$1").split(" ").forEach(function (t) { if (!t || STOP[t] || t.length < 2 && !/\d/.test(t)) return; var sy = SYN[t]; if (sy === "") return; (sy || t).split(" ").forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); }); return out; }
  function sim(a, b) { var A = tokens(a), B = tokens(b); if (!A.length || !B.length) return 0; var c = A.filter(function (x) { return B.indexOf(x) >= 0; }).length; return 2 * c / (A.length + B.length); }
  function uniteN(u) { u = norm(String(u || "").replace(/²/g, "2").replace(/³/g, "3")).replace(/\s/g, ""); return ({ m2: "m2", "m²": "m2", mq: "m2", m3: "m3", ml: "ml", m: "ml", u: "u", unite: "u", u_: "u", pce: "u", piece: "u", ens: "ens", ensemble: "ens", ff: "ff", forfait: "ff", kg: "kg", t: "t", tonne: "t", j: "j", jour: "j", pt: "pt", point: "pt" })[u] || u; }
  function trouverRes(lib, unite) {
    var best = null, sc = 0;
    S().res.forEach(function (r) { var v = sim(lib, r[1]) + (unite && uniteN(unite) === uniteN(r[2]) ? 0.15 : 0); if (v > sc) { sc = v; best = r; } });
    return sc >= 0.5 ? best : null;
  }
  function moParUnite(code) { var o = S().ouv[code]; if (!o) return null; var tot = 0, princ = null, mx = 0; o.c.forEach(function (c) { var r = S().res.filter(function (x) { return x[0] === c[0]; })[0]; if (r && r[4] === "MO" && c[0] !== "CHEF") { tot += c[1]; if (c[0] !== "MAN" && c[1] > mx) { mx = c[1]; princ = c[0]; } } }); return tot ? { tot: tot, metier: princ || "MAN" } : null; }

  function modeleExcel() {
    var s = S(), wb = XLSX.utils.book_new();
    var lis = [["Collecte de données de chantier — " + s.ent.nom], [""], ["Merci de m'aider à améliorer mes prix et mes plannings."], ["Remplissez uniquement ce que vous connaissez, même partiellement. Ne modifiez pas la colonne « Code »."], [""],
      ["Onglet Prix", "Prix d'achat réels (HT, livrés sur chantier) : indiquez la date, la région et le prix unitaire."], ["Onglet Cadences", "Ce qu'une équipe réalise vraiment : quantité réalisée, nombre d'ouvriers (manœuvres compris), nombre de jours."],
      ["Onglet Chantiers", "Vos chantiers terminés : surface, montant, durée prévue et réelle."], [""], ["Aucun nom de client n'est nécessaire. Les données restent confidentielles."]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lis), "Lisez-moi");
    var prix = [["Code (ne pas modifier)", "Désignation", "Unité", "Prix unitaire HT (FCFA)", "Date (JJ/MM/AAAA)", "Région", "Fournisseur", "Remarque"]];
    s.res.forEach(function (r) { if (r[4] === "MAT" || r[4] === "MO") prix.push([r[0], r[1] + (r[4] === "MO" ? " (salaire journalier)" : ""), r[2], "", "", "", "", ""]); });
    var ws1 = XLSX.utils.aoa_to_sheet(prix); ws1["!cols"] = [{ wch: 12 }, { wch: 46 }, { wch: 7 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Prix");
    var cad = [["Code (ne pas modifier)", "Ouvrage", "Unité", "Quantité réalisée", "Nombre d'ouvriers", "Nombre de jours", "Région", "Remarque"]];
    Object.keys(s.ouv).forEach(function (k) { if (moParUnite(k)) cad.push([k, s.ouv[k].d, s.ouv[k].u, "", "", "", "", ""]); });
    var ws2 = XLSX.utils.aoa_to_sheet(cad); ws2["!cols"] = [{ wch: 12 }, { wch: 56 }, { wch: 7 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Cadences");
    var ch = [["Type d'ouvrage", "Région", "Année", "Surface de plancher (m²)", "Nombre de niveaux", "Montant HT (FCFA)", "Durée prévue (jours)", "Durée réelle (jours)", "Remarque"], ["Villa R+1", "Dakar", "", "", "", "", "", "", ""]];
    var ws3 = XLSX.utils.aoa_to_sheet(ch); ws3["!cols"] = [{ wch: 20 }, { wch: 14 }, { wch: 8 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Chantiers");
    var out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    X.saveFile(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "Collecte_donnees_" + X.slug(s.ent.nom) + ".xlsx");
  }
  function lignes(ws) { return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }); }
  function enTete(rows, mots) {   // ligne d'en-tête = celle qui contient le plus de mots attendus
    var best = -1, sc = 0;
    rows.slice(0, 25).forEach(function (r, i) { var t = norm(r.join(" ")), v = mots.filter(function (m) { return t.indexOf(m) >= 0; }).length; if (v > sc) { sc = v; best = i; } });
    return sc >= 2 ? best : -1;
  }
  function col(head, mots) { for (var i = 0; i < head.length; i++) { var h = norm(head[i]); if (h && mots.some(function (m) { m = m.trim(); return m.length <= 2 ? h === m : h.indexOf(m) >= 0; })) return i; } return -1; }
  function dateCell(v) { if (typeof v === "number" && v > 20000) { var d = new Date(Math.round((v - 25569) * 864e5)); return PL.d2s(d); } var m = String(v || "").match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/); if (m) return (m[3].length === 2 ? "20" + m[3] : m[3]) + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2); var y = String(v || "").match(/(20\d\d)/); return y ? y[1] + "-06-30" : ""; }
  function region(v) { var t = norm(v); return Object.keys(D.REGIONS).filter(function (r) { return norm(r) === t; })[0] || ""; }
  function analyser(wb) {
    var s = S(), res = { prix: [], cadences: [], chantiers: [], rejets: [] };
    wb.SheetNames.forEach(function (nm) {
      var rows = lignes(wb.Sheets[nm]), k = norm(nm);
      // Prix
      var hp = enTete(rows, ["prix", "designation", "unite", "libelle", "materiau"]);
      if ((k.indexOf("prix") >= 0 || hp >= 0) && k.indexOf("cadence") < 0 && k.indexOf("chantier") < 0 && hp >= 0) {
        var H = rows[hp], cC = col(H, ["code"]), cD = col(H, ["designation", "libelle", "materiau", "article"]), cU = col(H, ["unite"]), cP = col(H, ["prix"]), cDt = col(H, ["date", "annee"]), cR = col(H, ["region", "ville", "lieu"]), cF = col(H, ["fournisseur"]);
        rows.slice(hp + 1).forEach(function (r) {
          var pu = n(r[cP]); if (!(pu > 0)) return;
          var row = cC >= 0 && s.res.filter(function (x) { return x[0] === String(r[cC]).trim(); })[0] || trouverRes(r[cD], cU >= 0 ? r[cU] : "");
          var lib = cD >= 0 ? r[cD] : r[cC];
          if (!row) { res.rejets.push(["Prix", lib, "matériau non reconnu"]); return; }
          var reg = cR >= 0 ? region(r[cR]) : "", coef = (D.REGIONS[reg] || [1])[0], vD = row[4] === "MAT" ? pu / coef : pu, rat = vD / row[3];
          var ok = rat >= 0.3 && rat <= 3;
          res.prix.push({ code: row[0], nom: row[1], u: row[2], pu: pu, v: vD, d: cDt >= 0 ? dateCell(r[cDt]) : "", region: reg, four: cF >= 0 ? String(r[cF]) : "", lib: String(lib), ok: ok, motif: ok ? "" : "écart trop grand avec la bibliothèque (×" + rat.toFixed(1) + ")" });
        });
      }
      // Cadences
      var hc = enTete(rows, ["quantite", "ouvriers", "jours", "ouvrage"]);
      if (hc >= 0 && (k.indexOf("cadence") >= 0 || col(rows[hc], ["ouvriers"]) >= 0)) {
        var H2 = rows[hc], c2 = col(H2, ["code"]), cO = col(H2, ["ouvrage", "tache", "designation"]), cQ = col(H2, ["quantite"]), cN = col(H2, ["ouvriers", "effectif"]), cJ = col(H2, ["jours", "duree"]), cR2 = col(H2, ["region"]);
        rows.slice(hc + 1).forEach(function (r) {
          var qte = n(r[cQ]), nb = n(r[cN]), j = n(r[cJ]); if (!(qte > 0 && nb > 0 && j > 0)) return;
          var code = c2 >= 0 && s.ouv[String(r[c2]).trim()] ? String(r[c2]).trim() : null;
          if (!code) { var b = null, sc = 0; Object.keys(s.ouv).forEach(function (kk) { var v = sim(r[cO], s.ouv[kk].d); if (v > sc) { sc = v; b = kk; } }); if (sc >= 0.5) code = b; }
          var th = code && moParUnite(code);
          if (!th) { res.rejets.push(["Cadences", r[cO], "ouvrage non reconnu"]); return; }
          var ratio = (nb * j / qte) / th.tot, ok = ratio >= 0.4 && ratio <= 2.5;
          res.cadences.push({ code: code, nom: s.ouv[code].d, metier: th.metier, ratio: ratio, qte: qte, nb: nb, j: j, region: cR2 >= 0 ? region(r[cR2]) : "", ok: ok, motif: ok ? "" : "cadence invraisemblable (×" + ratio.toFixed(2) + ")" });
        });
      }
      // Chantiers
      var hh = enTete(rows, ["surface", "montant", "duree", "type"]);
      if (hh >= 0 && (k.indexOf("chantier") >= 0 || col(rows[hh], ["surface"]) >= 0) && col(rows[hh], ["ouvriers"]) < 0) {
        var H3 = rows[hh], cT = col(H3, ["type", "ouvrage"]), cRg = col(H3, ["region"]), cA = col(H3, ["annee"]), cS = col(H3, ["surface"]), cNv = col(H3, ["niveau"]), cM = col(H3, ["montant"]), cDp = col(H3, ["prevue"]), cDr = col(H3, ["reelle"]);
        rows.slice(hh + 1).forEach(function (r) {
          var sf = n(r[cS]), mt = n(r[cM]); if (!(sf > 0 && mt > 0)) return;
          var cm2 = mt / sf, ok = cm2 > 20000 && cm2 < 2000000;
          res.chantiers.push({ type: String(r[cT] || ""), region: cRg >= 0 ? region(r[cRg]) : "", annee: cA >= 0 ? String(r[cA]) : "", surface: sf, niveaux: cNv >= 0 ? n(r[cNv]) : 0, montant: mt, cm2: cm2, dp: cDp >= 0 ? n(r[cDp]) : 0, dr: cDr >= 0 ? n(r[cDr]) : 0, ok: ok, motif: ok ? "" : "coût au m² invraisemblable" });
        });
      }
    });
    return res;
  }
  var EN_COURS = null;
  function externesHTML() {
    var s = S(), L = s.externes.lots, nb = function (k) { return L.reduce(function (a, l) { return a + l[k].length; }, 0); };
    var h = '<div class="card"><h2>Données de vos confrères et amis</h2><p>Des amis ou des confrères ingénieurs peuvent vous envoyer leurs prix, leurs cadences et leurs chantiers. L\'application les vérifie, les rapproche de votre bibliothèque et les utilise pour l\'apprentissage, <b>avec un poids deux fois moindre</b> que vos propres chantiers. Rien ne change sans votre validation (onglet Apprentissage).</p>' +
      '<div class="bar-btn"><button class="btn p" id="exModele">1. Télécharger le modèle Excel à leur envoyer</button><label class="btn p">2. Importer un fichier reçu (Excel ou CSV)<input type="file" id="exImp" accept=".xlsx,.xls,.csv,.ods" hidden></label></div>' +
      '<p class="hint">Le modèle contient déjà la liste de vos matériaux et ouvrages : il suffit de compléter les prix et les cadences. Un autre fichier Excel (bordereau de prix, relevé de chantier) peut aussi être importé : l\'application repère les colonnes toute seule et rapproche les désignations.</p></div>';
    if (EN_COURS) {
      var r = EN_COURS.res, ok = function (a) { return a.filter(function (x) { return x.ok; }).length; };
      h += '<div class="card"><h2>Vérification du fichier « ' + esc(EN_COURS.fichier) + " »</h2>" +
        '<div class="kpis">' + X.kpi("Prix reconnus", ok(r.prix) + " / " + r.prix.length, "les autres sont écartés") + X.kpi("Cadences reconnues", ok(r.cadences) + " / " + r.cadences.length, "") + X.kpi("Chantiers", ok(r.chantiers) + " / " + r.chantiers.length, "") + X.kpi("Lignes non reconnues", r.rejets.length, "ignorées") + "</div>" +
        (r.prix.length ? '<h3>Prix</h3><table class="t"><tr><th class="l">Matériau reconnu</th><th class="l">Dans le fichier</th><th>Prix</th><th>Région</th><th>Date</th><th>Statut</th></tr>' + r.prix.slice(0, 60).map(function (x) { return '<tr><td class="l">' + esc(x.nom) + '</td><td class="l small">' + esc(x.lib) + "</td><td>" + fmt(x.pu) + " / " + esc(x.u) + "</td><td>" + esc(x.region || "—") + "</td><td>" + (x.d ? fr(x.d) : "—") + "</td><td>" + (x.ok ? badge("vert", "retenu") : badge("orange", x.motif)) + "</td></tr>"; }).join("") + "</table>" : "") +
        (r.cadences.length ? '<h3>Cadences</h3><table class="t"><tr><th class="l">Ouvrage</th><th class="l">Métier</th><th>Réalisé</th><th>Rapport réel / théorique</th><th>Statut</th></tr>' + r.cadences.map(function (x) { return '<tr><td class="l">' + esc(x.nom) + '</td><td class="l">' + esc(x.metier) + "</td><td>" + fmt(x.qte, 1) + " en " + x.j + " j à " + x.nb + "</td><td>" + x.ratio.toFixed(2) + "</td><td>" + (x.ok ? badge("vert", "retenu") : badge("orange", x.motif)) + "</td></tr>"; }).join("") + "</table>" : "") +
        (r.chantiers.length ? '<h3>Chantiers</h3><table class="t"><tr><th class="l">Type</th><th>Région</th><th>Surface</th><th>Coût / m²</th><th>Durée prévue / réelle</th><th>Statut</th></tr>' + r.chantiers.map(function (x) { return '<tr><td class="l">' + esc(x.type) + "</td><td>" + esc(x.region || "—") + "</td><td>" + fmt(x.surface) + " m²</td><td>" + fmt(x.cm2) + "</td><td>" + (x.dp || "—") + " / " + (x.dr || "—") + " j</td><td>" + (x.ok ? badge("vert", "retenu") : badge("orange", x.motif)) + "</td></tr>"; }).join("") + "</table>" : "") +
        (r.rejets.length ? '<details><summary>Lignes non reconnues (' + r.rejets.length + ")</summary><p class=\"small\">" + r.rejets.slice(0, 80).map(function (x) { return esc(x[0] + " : " + x[1]); }).join("<br>") + "</p></details>" : "") +
        '<div class="form" style="margin-top:10px"><label class="f"><span>Fourni par (nom du confrère ou de la source)</span><input type="text" id="exSrc" placeholder="Ex. : Ousmane, ingénieur à Thiès"></label><label class="f"><span>Fiabilité de la source</span><select id="exPoids"><option value="0.5">Normale (compte pour ½ chantier)</option><option value="0.25">Faible (¼)</option><option value="1">Élevée (comme mes chantiers)</option></select></label></div>' +
        '<div class="bar-btn"><button class="btn p" id="exOk">Ajouter ces données</button><button class="btn" id="exNo">Annuler</button></div></div>';
    }
    h += '<div class="card"><h2>Données intégrées</h2>' + (L.length ? '<table class="t"><tr><th>Date</th><th class="l">Source</th><th>Poids</th><th>Prix</th><th>Cadences</th><th>Chantiers</th><th></th></tr>' + L.map(function (l, i) { return "<tr><td>" + fr(l.date) + '</td><td class="l">' + esc(l.source) + "</td><td>" + l.poids + "</td><td>" + l.prix.length + "</td><td>" + l.cadences.length + "</td><td>" + l.chantiers.length + '</td><td><button class="btn sm danger" data-exdel="' + i + '">Retirer</button></td></tr>'; }).join("") + '</table><p class="hint">' + nb("prix") + " prix, " + nb("cadences") + " cadences et " + nb("chantiers") + ' chantiers externes au total. Allez dans l\'onglet Apprentissage pour voir les corrections proposées.</p>' : '<p class="hint">Aucune donnée externe pour le moment.</p>') + "</div>";
    return h + repereHTML(true);
  }
  function postExternes() {
    var s = S(), b;
    if ((b = $("exModele"))) b.onclick = modeleExcel;
    if ((b = $("exImp"))) b.onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.arrayBuffer().then(function (buf) { var wb = XLSX.read(buf, { type: "array", cellDates: false }); EN_COURS = { fichier: f.name, res: analyser(wb) }; X.renderPage(); }).catch(function () { X.toast("Fichier illisible : enregistrez-le au format Excel (.xlsx) ou CSV"); });
    };
    if ((b = $("exNo"))) b.onclick = function () { EN_COURS = null; X.renderPage(); };
    if ((b = $("exOk"))) b.onclick = function () {
      var src = $("exSrc").value.trim(); if (!src) { X.toast("Indiquez qui a fourni ces données"); return; }
      var r = EN_COURS.res, ok = function (a) { return a.filter(function (x) { return x.ok; }); };
      s.externes.lots.push({ id: "ext" + Date.now().toString(36), date: today(), source: src, fichier: EN_COURS.fichier, poids: +$("exPoids").value, prix: ok(r.prix), cadences: ok(r.cadences), chantiers: ok(r.chantiers) });
      EN_COURS = null; X.save(); X.renderPage(); X.toast("Données ajoutées : voyez l'onglet Apprentissage");
    };
    document.querySelectorAll("[data-exdel]").forEach(function (el) { el.onclick = function () { if (el.dataset.c !== "1") { el.dataset.c = "1"; el.textContent = "Confirmer"; return; } s.externes.lots.splice(+el.dataset.exdel, 1); X.save(); X.renderPage(); }; });
  }
  // Observations pondérées pour l'apprentissage
  function observations() {
    var out = { prod: {}, prix: {} };
    S().externes.lots.forEach(function (l) {
      var w = n(l.poids) || 0.5;
      l.prix.forEach(function (x) { (out.prix[x.code] = out.prix[x.code] || []).push({ v: x.v, w: w, d: x.d || l.date }); });
      l.cadences.forEach(function (x) { (out.prod[x.metier] = out.prod[x.metier] || []).push({ v: x.ratio, w: w }); });
    });
    return out;
  }
  // Repères de coût au m² (vos chantiers archivés + chantiers externes)
  function repereHTML(detail) {
    var s = S(), L = [];
    s.projects.forEach(function (p) { if (p.rex && p.rex.surface > 0 && p.rex.fin.marcheHT > 0) L.push({ type: p.info.type || "Chantier", cm2: p.rex.fin.marcheHT / p.rex.surface, src: "moi", dep: p.rex.dureePrevue && p.rex.dureeReelle ? p.rex.dureeReelle / p.rex.dureePrevue : null }); });
    s.externes.lots.forEach(function (l) { l.chantiers.forEach(function (c) { L.push({ type: c.type || "Chantier", cm2: c.cm2, src: "ext", dep: c.dp > 0 && c.dr > 0 ? c.dr / c.dp : null }); }); });
    if (!L.length) return "";
    var med = function (a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : null; };
    var types = {}; L.forEach(function (x) { var k = norm(x.type).replace(/\s+/g, " ") || "chantier"; (types[k] = types[k] || { lib: x.type, v: [], d: [] }).v.push(x.cm2); if (x.dep) types[k].d.push(x.dep); });
    var deps = L.filter(function (x) { return x.dep; }).map(function (x) { return x.dep; });
    var p = P(), q = Cc.dqe(p, X.ST()), mien = q.surface > 0 ? q.ht / q.surface : null;
    return '<div style="margin-top:10px"><h3 style="margin:6px 0">Repères de coût (vos chantiers + données externes)</h3><table class="t"><tr><th class="l">Type d\'ouvrage</th><th>Chantiers</th><th>Coût HT médian / m²</th><th>Dépassement de délai médian</th></tr>' + Object.keys(types).map(function (k) { var t = types[k], dm = med(t.d); return '<tr><td class="l">' + esc(t.lib) + "</td><td>" + t.v.length + "</td><td>" + fmt(med(t.v)) + "</td><td>" + (dm ? (dm >= 1 ? "+" : "") + Math.round(100 * (dm - 1)) + " %" : "—") + "</td></tr>"; }).join("") + "</table>" +
      (mien && !detail ? '<p class="hint">Projet actif « ' + esc(p.info.nom) + " » : " + fmt(mien) + " FCFA HT/m².</p>" : "") + (deps.length >= 3 ? '<p class="hint">Sur ' + deps.length + " chantiers connus, la durée réelle dépasse la durée prévue de " + Math.round(100 * (med(deps) - 1)) + " % en médiane : gardez cette marge dans vos promesses de délai.</p>" : "") + "</div>";
  }

  /* =====================================================
     4. RÉPONDRE À UN APPEL D'OFFRES (DQE / BPU du DAO)
     ===================================================== */
  function rapprocher(lib, unite) {
    var s = S(), memo = s.aoMemo[norm(lib)];
    if (memo && s.ouv[memo]) return { code: memo, sc: 1, memo: true };
    var best = null, sc = 0;
    Object.keys(s.ouv).forEach(function (k) { var o = s.ouv[k], b0 = sim(lib, o.d), v = b0 + (unite && uniteN(unite) === uniteN(o.u) ? (b0 >= 0.3 ? 0.15 : 0) : unite ? -0.1 : 0); if (v > sc) { sc = v; best = k; } });
    return sc >= 0.38 ? { code: best, sc: sc } : { code: "", sc: sc };
  }
  function lireDQE(wb) {
    var res = null;
    wb.SheetNames.some(function (nm) {
      var rows = lignes(wb.Sheets[nm]), hd = enTete(rows, ["designation", "quantite", "unite", "prix", "qte"]);
      if (hd < 0) return false;
      var H = rows[hd], cN = col(H, ["n", "no", "n prix", "numero", "num", "item", "art"]), cD = col(H, ["designation", "libelle", "description", "ouvrage"]), cU = col(H, ["unite", "u", "un"]), cQ = col(H, ["quantite", "qte", "qt"]);
      if (cD < 0) return false;
      if (cU < 0) cU = cD + 1;
      var L = [];
      rows.slice(hd + 1).forEach(function (r, i) {
        var d = String(r[cD] || "").trim(); if (!d) return;
        var qv = cQ >= 0 ? n(r[cQ]) : 0, u = String(r[cU] || "").trim();
        if (/^(total|sous[- ]total|montant|tva|ttc|ht)\b/i.test(norm(d))) return;
        if (!(qv > 0) && !u) { L.push({ titre: true, d: d, num: cN >= 0 ? String(r[cN] || "") : "" }); return; }
        var m = rapprocher(d, u);
        L.push({ num: cN >= 0 ? String(r[cN] || "") : String(i + 1), d: d, u: u, q: qv, code: m.code, sc: m.sc, memo: !!m.memo, pu: "" });
      });
      if (L.filter(function (x) { return !x.titre; }).length) { res = { feuille: nm, lignes: L }; return true; }
      return false;
    });
    return res;
  }
  function puLigne(l, cat, k) { if (n(l.pu) > 0) return n(l.pu); if (!l.code) return 0; var sd = Cc.sousDetail(cat, l.code); return sd ? Math.round(sd.ds * k / 5) * 5 : 0; }
  function aoHTML() {
    var s = S(), A = s.aoCourant;
    var h = '<div class="card"><h2>Répondre à un appel d\'offres</h2><p>Chargez le cadre de DQE (ou de BPU) fourni dans le DAO, au format Excel. L\'application reconnaît les colonnes, rapproche chaque ligne d\'un ouvrage de votre bibliothèque et calcule le prix avec vos sous-détails et votre coefficient K. Vous corrigez ce qui doit l\'être, puis vous téléchargez le DQE rempli.</p><div class="bar-btn"><label class="btn p">Charger le DQE du DAO (Excel ou CSV)<input type="file" id="aoImp" accept=".xlsx,.xls,.csv,.ods" hidden></label>' + (A ? '<button class="btn" id="aoFermer">Fermer ce DQE</button>' : "") + "</div></div>";
    if (!A) return h + '<p class="hint">Astuce : les rapprochements que vous corrigez sont mémorisés et réutilisés automatiquement pour les prochains appels d\'offres.</p>';
    var cat = Cc.catalogue(X.ST(), A.region || "Dakar"), k = Cc.K(s.ent), ht = 0, nonPrix = 0;
    var opts = '<option value="">— prix manuel —</option>' + Object.keys(s.ouv).map(function (c) { return '<option value="' + c + '">' + esc(c + " · " + s.ouv[c].d.slice(0, 70)) + "</option>"; }).join("");
    h += '<div class="card"><h2>« ' + esc(A.fichier) + " » · feuille " + esc(A.feuille) + '</h2><div class="form"><label class="f"><span>Région du chantier (prix des matériaux)</span><select id="aoReg">' + Object.keys(D.REGIONS).map(function (r) { return "<option" + (r === A.region ? " selected" : "") + ">" + r + "</option>"; }).join("") + '</select></label><label class="f"><span>Objet de l\'offre</span><input type="text" id="aoObj" value="' + esc(A.objet || "") + '"></label></div>';
    h += '<div style="overflow-x:auto"><table class="t edit"><tr><th>N°</th><th class="l">Désignation (DAO)</th><th>U</th><th>Qté</th><th class="l">Ouvrage de ma bibliothèque</th><th>P.U. HT</th><th>Montant HT</th></tr>' + A.lignes.map(function (l, i) {
      if (l.titre) return '<tr><td colspan="7" class="l"><b>' + esc((l.num ? l.num + " " : "") + l.d) + "</b></td></tr>";
      var pu = puLigne(l, cat, k), m = pu * l.q, o = l.code && s.ouv[l.code], uOk = !o || !l.u || uniteN(o.u) === uniteN(l.u); ht += m; if (!pu) nonPrix++;
      return "<tr><td>" + esc(l.num) + '</td><td class="l small">' + esc(l.d) + "</td><td>" + esc(l.u) + "</td><td>" + fmt(l.q, l.q % 1 ? 2 : 0) + '</td><td class="l"><select data-aoc="' + i + '" style="max-width:260px">' + opts.replace('value="' + l.code + '"', 'value="' + l.code + '" selected') + "</select>" + (l.code && !l.memo && l.sc < 0.6 ? " " + badge("orange", "à vérifier") : l.memo ? " " + badge("vert", "mémorisé") : "") + (!uOk ? " " + badge("rouge", "unité " + o.u) : "") + '</td><td><input type="number" data-aop="' + i + '" value="' + (l.pu || "") + '" placeholder="' + (pu && !n(l.pu) ? fmt(pu) : "prix") + '" style="width:100px"></td><td>' + (pu ? fmt(m) : badge("rouge", "sans prix")) + "</td></tr>";
    }).join("") + "</table></div>";
    var tva = ht * n(s.ent.tva) / 100;
    h += '<div class="kpis">' + X.kpi("Total HT", fmt(ht), "FCFA") + X.kpi("TVA " + s.ent.tva + " %", fmt(tva), "FCFA") + X.kpi("Total TTC", fmt(ht + tva), "FCFA") + X.kpi("Lignes sans prix", nonPrix, nonPrix ? "à compléter avant de déposer" : "offre complète") + "</div>";
    h += '<div class="bar-btn"><button class="btn p" id="aoXls">Télécharger le DQE rempli (Excel)</button><button class="btn" id="aoProj">Créer le projet correspondant (devis, planning, mémoire)</button></div><p class="hint">Vérifiez toujours les lignes marquées « à vérifier » et les unités. Les prix restent sous votre responsabilité : relisez l\'offre avant dépôt.</p></div>';
    return h;
  }
  function postAO() {
    var s = S(), A = s.aoCourant, b;
    if ((b = $("aoImp"))) b.onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.arrayBuffer().then(function (buf) {
        var r = lireDQE(XLSX.read(buf, { type: "array" }));
        if (!r) { X.toast("Aucune colonne « Désignation » et « Quantité » trouvée dans ce fichier"); return; }
        s.aoCourant = { fichier: f.name, feuille: r.feuille, lignes: r.lignes, region: P().info.region || "Dakar", objet: f.name.replace(/\.[^.]+$/, "") };
        X.save(); X.renderPage();
        var nl = r.lignes.filter(function (x) { return !x.titre; }), nm = nl.filter(function (x) { return x.code; }).length;
        X.toast(nl.length + " lignes lues, " + nm + " rapprochées automatiquement");
      }).catch(function () { X.toast("Fichier illisible : enregistrez-le au format Excel (.xlsx)"); });
    };
    if (!A) return;
    if ((b = $("aoFermer"))) b.onclick = function () { s.aoCourant = null; X.save(); X.renderPage(); };
    $("aoReg").onchange = function () { A.region = this.value; X.save(); X.renderPage(); };
    $("aoObj").onchange = function () { A.objet = this.value; X.save(); };
    document.querySelectorAll("[data-aoc]").forEach(function (el) { el.onchange = function () { var l = A.lignes[+el.dataset.aoc]; l.code = el.value; l.memo = true; l.sc = 1; if (el.value) s.aoMemo[norm(l.d)] = el.value; else delete s.aoMemo[norm(l.d)]; X.save(); X.renderPage(); }; });
    document.querySelectorAll("[data-aop]").forEach(function (el) { el.onchange = function () { A.lignes[+el.dataset.aop].pu = el.value === "" ? "" : n(el.value); X.save(); X.renderPage(); }; });
    $("aoXls").onclick = function () {
      var cat = Cc.catalogue(X.ST(), A.region), k = Cc.K(s.ent), aoa = [[s.ent.nom + " — Offre : " + (A.objet || "")], [""], ["N°", "Désignation", "Unité", "Quantité", "Prix unitaire HT (FCFA)", "Montant HT (FCFA)"]], ht = 0;
      A.lignes.forEach(function (l) { if (l.titre) { aoa.push([l.num, l.d, "", "", "", ""]); return; } var pu = puLigne(l, cat, k); ht += pu * l.q; aoa.push([l.num, l.d, l.u, l.q, pu, Math.round(pu * l.q)]); });
      var tva = ht * n(s.ent.tva) / 100;
      aoa.push([""], ["", "TOTAL HT", "", "", "", Math.round(ht)], ["", "TVA " + s.ent.tva + " %", "", "", "", Math.round(tva)], ["", "TOTAL TTC", "", "", "", Math.round(ht + tva)], [""], ["", "Arrêté le présent devis à la somme de " + Cc.enLettres(Math.round(ht + tva)) + " francs CFA TTC."]);
      var ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = [{ wch: 8 }, { wch: 70 }, { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];
      var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "DQE");
      X.saveFile(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "DQE_rempli_" + X.slug(A.objet || A.fichier) + ".xlsx");
    };
    $("aoProj").onclick = function () {
      var cat = Cc.catalogue(X.ST(), A.region), k = Cc.K(s.ent), p = D.projetVide();
      p.mode = "rapide"; p.info.nom = A.objet || "Appel d'offres"; p.info.region = A.region; p.marche = { type: "public" };
      p.rapide = A.lignes.filter(function (l) { return !l.titre && l.q > 0; }).map(function (l, i) {
        var o = l.code && s.ouv[l.code];
        return o ? { id: "ao" + i + Date.now().toString(36), code: l.code, lot: o.lot, d: l.d, loc: l.num, u: o.u, q: l.q, pu: n(l.pu) || "", jours: "" } : { id: "ao" + i + Date.now().toString(36), code: "", lot: "L12", d: l.d, loc: l.num, u: l.u || "FF", q: l.q, pu: puLigne(l, cat, k), jours: 1 };
      });
      s.projects.push(p); X.setStateRaw(s); S().active = p.id; X.save(); X.renderTop(); X.go("projets", "marche"); X.toast("Projet créé : complétez le dossier de candidature et le mémoire technique");
    };
  }

  return { signer: signer, signatureHTML: signatureHTML, lierSignatures: lierSignatures, entrepriseSigHTML: entrepriseSigHTML, postEntrepriseSig: postEntrepriseSig, signerPDF: signerPDF,
    entrepriseHTML: entrepriseHTML, externesHTML: externesHTML, postExternes: postExternes, observations: observations, modeleExcel: modeleExcel, analyser: analyser,
    aoHTML: aoHTML, postAO: postAO, lireDQE: lireDQE, rapprocher: rapprocher, sim: sim };
})();
