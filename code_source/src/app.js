/* ============================================================
   PILOTE BTP — interface
   ============================================================ */
var APP = (function () {
  var D = DATA, C = CALC, KEY = "piloteBTP_v1", VERSION = "2026.11.20-d";
  var S, ui = { page: "dash", sub: { metres: "fond", prix: "dqe" }, niv: 0, ouv: null, phase: "Toutes", ouvEdit: "3.4" };
  var $ = function (id) { return document.getElementById(id); };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(v, d) { d = d || 0; if (v == null || !isFinite(v)) return "—"; if (Math.abs(v) < 0.5 * Math.pow(10, -d)) v = 0; return Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function fq(v) { return fmt(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 2); }
  function toast(t) { var e = $("toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, 2600); }

  /* ---------------- État & stockage ---------------- */
  function defState() { var p = D.exemple(); return { projects: [p], active: p.id, ent: clone(D.ENTREPRISE), res: clone(D.RES), ouv: clone(D.OUV), collab: [], demo: true }; }
  function migrate(s) {
    if (s.ent && s.ent.nom === "VOTRE ENTREPRISE BTP") { s.ent.nom = D.ENTREPRISE.nom; s.ent.tel = D.ENTREPRISE.tel; s.ent.adresse = D.ENTREPRISE.adresse; }
    if (s.ent && s.ent.nom === "AMD CONSTRUCTION") { s.ent.nom = D.ENTREPRISE.nom; if (!s.ent.slogan || s.ent.slogan === "Bâtiment – Génie civil – Rénovation") s.ent.slogan = D.ENTREPRISE.slogan; }
    if (s.ent && !s.ent.logo && !s.ent.logoRetire) s.ent.logo = D.ENTREPRISE.logo;
    s.ent = Object.assign(clone(D.ENTREPRISE), s.ent || {});
    s.collab = s.collab || [];
    if (!s.res) s.res = clone(D.RES);
    var have = {}; s.res.forEach(function (r) { have[r[0]] = 1; });
    D.RES.forEach(function (r) { if (!have[r[0]]) s.res.push(clone(r)); });
    if (!s.ouv) s.ouv = clone(D.OUV);
    Object.keys(D.OUV).forEach(function (k) { if (!s.ouv[k]) s.ouv[k] = clone(D.OUV[k]); });
    s.ent.capacite = Object.assign({}, D.ENTREPRISE.capacite, s.ent.capacite || {});
    s.ent.productivite = s.ent.productivite || {};
    s.appr = s.appr || { journal: [], ignore: {} }; s.appr.journal = s.appr.journal || []; s.appr.ignore = s.appr.ignore || {};
    s.sauvegarde = s.sauvegarde || {};
    s.terrain = s.terrain || { moi: "" };
    s.projects.forEach(function (p) {
      p.overrides = p.overrides || {}; p.devis = p.devis || {}; p.opt = Object.assign({}, D.exemple().opt, p.opt || {});
      p.statut = p.statut || "etude";
      p.planning = p.planning || {}; p.planning.ov = p.planning.ov || {};
      if (!p.planning.debut) p.planning.debut = p.info.date || new Date().toISOString().slice(0, 10);
      if (p.planning.samedi == null) p.planning.samedi = true;
      if (p.planning.hivernage == null) p.planning.hivernage = true;
      if (!p.planning.facteurHiv) p.planning.facteurHiv = 0.75;
      p.planning.equipes = Object.assign({}, PLAN.EQUIPES, p.planning.equipes || {});
      p.opc = p.opc || {}; ["commandes", "avValide", "lookahead"].forEach(function (k) { p.opc[k] = p.opc[k] || {}; }); p.opc.crs = p.opc.crs || []; p.opc.reserves = p.opc.reserves || [];
      p.suivi = p.suivi || {}; p.suivi.rapports = p.suivi.rapports || [];
      p.factu = p.factu || {}; p.factu.docs = p.factu.docs || []; p.factu.achats = p.factu.achats || [];
      p.memoire = p.memoire || {}; p.memoire.sections = p.memoire.sections || {};
      p.mode = p.mode || "complet"; p.rapide = p.rapide || []; p.archive = !!p.archive;
      p.marche = Object.assign({ type: "prive", autorite: "etat", nomAutorite: "", ref: "", montantEstime: 0, dateDepot: "", heureDepot: "", validite: 90, tauxBE: 0, autres: "" }, p.marche || {}); p.marche.check = p.marche.check || {};
      p.reception = Object.assign({ num: "", date: new Date().toISOString().slice(0, 10), lieu: "", decision: "sans", delai: 30, ref: "", mo: "", moe: "", ent: "", obs: "" }, p.reception || {});
    });
    return s;
  }
  var DB = null, MEMPH = {};
  function idbOpen() { return new Promise(function (res) { try { var r = indexedDB.open("amdConstructionBTP", 1); r.onupgradeneeded = function () { var d = r.result; d.createObjectStore("kv"); d.createObjectStore("photos"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; } catch (e) { res(null); } }); }
  function idbGet(st, k) { return new Promise(function (res) { if (!DB) return res(null); try { var r = DB.transaction(st).objectStore(st).get(k); r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; } catch (e) { res(null); } }); }
  function idbPut(st, k, v) { return new Promise(function (res) { if (!DB) return res(false); try { var tx = DB.transaction(st, "readwrite"); tx.objectStore(st).put(v, k); tx.oncomplete = function () { res(true); }; tx.onerror = function () { res(false); }; } catch (e) { res(false); } }); }
  function idbDel(st, k) { return new Promise(function (res) { if (!DB) return res(false); try { var tx = DB.transaction(st, "readwrite"); tx.objectStore(st).delete(k); tx.oncomplete = function () { res(true); }; } catch (e) { res(false); } }); }
  function photoPut(id, data) { MEMPH[id] = data; return idbPut("photos", id, data); }
  function photoGet(id) { if (MEMPH[id]) return Promise.resolve(MEMPH[id]); return idbGet("photos", id).then(function (v) { if (v) MEMPH[id] = v; return v; }); }
  function photoAll() {
    return new Promise(function (res) {
      var out = {}; Object.keys(MEMPH).forEach(function (k) { out[k] = MEMPH[k]; });
      if (!DB) return res(out);
      try { var rq = DB.transaction("photos").objectStore("photos").openCursor(); rq.onsuccess = function () { var c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); }; rq.onerror = function () { res(out); }; } catch (e) { res(out); }
    });
  }
  function kvGet(k) { return idbGet("kv", k); }
  function kvPut(k, v) { return idbPut("kv", k, v); }
  function photoDel(id) { delete MEMPH[id]; return idbDel("photos", id); }
  function load() {
    return idbOpen().then(function (db) {
      DB = db;
      return idbGet("kv", "state").then(function (v) {
        var s = null;
        try { if (v) s = JSON.parse(v); } catch (e) {}
        if (!s) { try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} }
        return (s && s.projects && s.projects.length) ? migrate(s) : migrate(defState());
      });
    });
  }
  var saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      var txt = JSON.stringify(S), heure = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      (DB ? idbPut("kv", "state", txt) : Promise.resolve(false)).then(function (ok) {
        if (!ok) { try { localStorage.setItem(KEY, txt); ok = true; } catch (e) {} }
        $("saveState").textContent = ok ? "Enregistré · " + heure : "⚠ Enregistrement impossible : exportez une sauvegarde";
        if (ok && window.PIL) PIL.apresEnregistrement();
      });
    }, 200);
  }
  function P() { return S.projects.filter(function (p) { return p.id === S.active; })[0] || S.projects[0]; }
  function ST() { return { ent: S.ent, res: S.res, ouv: S.ouv }; }
  function Q() { return C.dqe(P(), ST()); }
  function get(o, path) { return path.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function set(o, path, v) { var ks = path.split("."), last = ks.pop(); var t = ks.reduce(function (a, k) { return a[k]; }, o); t[last] = v; }

  /* ---------------- Champs liés ---------------- */
  function inp(path, o) {
    o = o || {}; var v = get(P(), path), base = o.root === "ent" ? S.ent : null;
    if (base) v = get(S.ent, path);
    var b = (o.root === "ent" ? "ent:" : "") + path;
    if (o.check) return '<input type="checkbox" data-b="' + b + '"' + (v ? " checked" : "") + ">";
    if (o.options) return '<select data-b="' + b + '">' + o.options.map(function (x) { var val = Array.isArray(x) ? x[0] : x, lab = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? " selected" : "") + ">" + esc(lab) + "</option>"; }).join("") + "</select>";
    if (o.area) return '<textarea data-b="' + b + '" rows="' + (o.rows || 4) + '">' + esc(v) + "</textarea>";
    return '<input ' + (o.text ? 'type="text"' : o.date ? 'type="date"' : 'type="number" step="any"') + ' data-b="' + b + '" value="' + esc(v == null ? "" : v) + '"' + (o.w ? ' style="width:' + o.w + '"' : "") + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") + ">";
  }
  function fld(label, path, o, help) { return '<label class="f"><span>' + label + (help ? ' <i class="hl" title="' + esc(help) + '">?</i>' : "") + "</span>" + inp(path, o) + "</label>"; }
  function bindAll(root) {
    root.querySelectorAll("[data-b]").forEach(function (el) {
      el.addEventListener("change", function () {
        var b = el.dataset.b, ent = b.indexOf("ent:") === 0, path = ent ? b.slice(4) : b, tgt = ent ? S.ent : P();
        var v = el.type === "checkbox" ? el.checked : (el.type === "number" ? (el.value === "" ? 0 : parseFloat(el.value)) : el.value);
        set(tgt, path, v); S.demo = false; save(); afterChange(path);
      });
    });
  }
  function afterChange(path) {
    if (path === "info.nom" || path === "info.region" || path === "nom") renderTop();
    if (ui.page === "metres") updateSide();
    if (ui.page === "params") updateK();
    if (ui.page === "prix" && ui.sub.prix === "devis") renderPage();
    if (ui.page === "planning" || (ui.page === "factu" && path.indexOf("factu.achats") === 0)) renderPage();
    if (path === "statut" || path === "mode" || path.indexOf("marche.") === 0 || path.indexOf("reception.decision") === 0) renderPage();
    if (path.indexOf("rapide.") === 0 || path === "surfaceRapide") renderPage();
  }

  /* ---------------- Coquille ---------------- */
  var MENU = [
    ["dash", "Tableau de bord", "▦"], ["projets", "Projets", "▤"], ["metres", "Métrés / devis rapide", "⊞"], ["prix", "Études de prix", "₣"],
    ["planning", "Planning", "▭"], ["opc", "OPC et anticipation", "◎"], ["terrain", "Suivi terrain", "⚑"],
    ["appro", "Approvisionnements", "⛟"], ["factu", "Facturation et trésorerie", "≡"], ["memoires", "Mémoires techniques", "✎"], ["archives", "Archives, REX et apprentissage", "▣"], ["params", "Paramètres", "⚙"]
  ];
  function renderMenu() {
    $("menu").innerHTML = MENU.map(function (m) { return '<button data-p="' + m[0] + '" class="' + (ui.page === m[0] ? "on" : "") + '"><span class="ic">' + m[2] + "</span>" + m[1] + (m[3] ? '<em>' + m[3] + "</em>" : "") + "</button>"; }).join("");
    $("menu").querySelectorAll("button").forEach(function (b) { b.onclick = function () { go(b.dataset.p); }; });
    $("menuSel").innerHTML = MENU.map(function (m) { return '<option value="' + m[0] + '"' + (ui.page === m[0] ? " selected" : "") + ">" + m[1] + "</option>"; }).join("");
  }
  function renderTop() {
    var br = $("brandName"); if (br) br.textContent = S.ent.nom || "Pilote BTP";
    var bl = $("brandLogo"); if (bl) { if (S.ent.logo) { bl.src = S.ent.logo; bl.style.display = "block"; } else bl.style.display = "none"; }
    $("projSel").innerHTML = S.projects.filter(function (p) { return !p.archive || p.id === S.active; }).map(function (p) { return '<option value="' + p.id + '"' + (p.id === S.active ? " selected" : "") + ">" + esc(p.info.nom) + "</option>"; }).join("");
  }
  function go(page, sub) { ui.page = page; if (sub) ui.sub[page] = sub; renderMenu(); renderPage(); window.scrollTo(0, 0); try { history.replaceState(null, "", "#" + page); } catch (e) {} }
  function tabs(page, list) {
    return '<div class="tabs">' + list.map(function (t) { return '<button data-sub="' + t[0] + '" class="' + (ui.sub[page] === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div>";
  }
  function bindTabs(page) { document.querySelectorAll(".tabs [data-sub]").forEach(function (b) { b.onclick = function () { ui.sub[page] = b.dataset.sub; renderPage(); }; }); }
  function renderPage() {
    var c = $("content"), f = PAGES[ui.page] || PAGES.dash;
    c.innerHTML = f();
    bindAll(c);
    if (POST[ui.page]) POST[ui.page]();
  }

  /* ================= PAGES ================= */
  var PAGES = {}, POST = {};

  /* ---- Tableau de bord ---- */
  PAGES.dash = function () {
    var p = P(), q = Q(), b = C.besoins(q, ST());
    var acier = ["HA6", "HA8", "HA10", "HA12", "HA14", "HA16"].reduce(function (s, k) { return s + (b.total[k] || 0); }, 0);
    var jMO = Object.keys(b.mo).reduce(function (s, k) { return s + b.mo[k]; }, 0);
    var marge = q.ht - q.ds;
    var maxPh = Math.max.apply(null, q.phases.map(function (x) { return x.total; }).concat([1]));
    var h = '<div class="head"><h1>Tableau de bord</h1><p>Projet actif : <b>' + esc(p.info.nom) + "</b> · " + esc(p.info.client || "client non renseigné") + " · " + esc(p.info.ville || p.info.region) + "</p></div>";
    if (window.PIL) h += PIL.dashHTML();
    if (S.demo) h += '<div class="note">Le projet « Villa R+1 – exemple » est <b>fictif</b>, avec des prix <b>indicatifs</b>. Créez votre projet dans <a href="#" data-go="projets">Projets</a> et mettez vos prix réels dans <a href="#" data-go="prix:biblio">Études de prix › Bibliothèque</a>.</div>';
    h += '<div class="kpis">' + kpi("Montant TTC", fmt(q.ttc), "FCFA · HT " + fmt(q.ht)) + kpi("Coût au m²", fmt(q.surface ? q.ttc / q.surface : 0), "FCFA TTC / m² de plancher (" + fmt(q.surface) + " m²)") +
      kpi("Déboursé sec", fmt(q.ds), "FCFA · coefficient K = " + q.k.toFixed(3)) + kpi("Marge brute prévue", fmt(marge), "FCFA · " + fmt(q.ht ? 100 * marge / q.ht : 0, 1) + " % du HT") +
      kpi("Ciment", fmt(b.total.CIM || 0, 1) + " t", fmt(Math.ceil((b.total.CIM || 0) * 20)) + " sacs") + kpi("Acier", fmt(acier / 1000, 2) + " t", fmt(q.surface ? acier / q.surface : 0, 1) + " kg/m²") +
      kpi("Main-d'œuvre", fmt(jMO) + " j", "journées d'ouvriers estimées") + kpi("Livraison promise", p.info.dateLivraison ? new Date(p.info.dateLivraison).toLocaleDateString("fr-FR") : "—", "à renseigner dans Projets") + "</div>";
    h += '<div class="grid2"><div class="card"><h2>Montant par phase (HT)</h2>' + q.phases.map(function (ph) {
      return '<div class="bar"><span>' + esc(ph.nom) + '</span><div><i style="width:' + (100 * ph.total / maxPh) + '%"></i></div><b>' + fmt(ph.total / 1e6, 2) + " M</b></div>";
    }).join("") + '</div><div class="card"><h2>Mes projets</h2><table class="t"><tr><th class="l">Projet</th><th class="l">Ville</th><th>Surface</th><th>TTC (FCFA)</th><th>FCFA/m²</th></tr>' +
      S.projects.filter(function (x) { return !x.archive; }).map(function (x) { var qx = C.dqe(x, ST()); return '<tr class="click" data-open="' + x.id + '"><td class="l">' + esc(x.info.nom) + (x.id === S.active ? " <span class='tag'>actif</span>" : "") + '</td><td class="l">' + esc(x.info.ville || x.info.region) + "</td><td>" + fmt(qx.surface) + " m²</td><td>" + fmt(qx.ttc) + "</td><td>" + fmt(qx.surface ? qx.ttc / qx.surface : 0) + "</td></tr>"; }).join("") +
      "</table></div></div>";
    h += (window.MOD && MOD.engagementsHTML) ? MOD.engagementsHTML(true) : "";
    return h;
  };
  POST.dash = function () {
    document.querySelectorAll("[data-open]").forEach(function (r) { r.onclick = function () { S.active = r.dataset.open; save(); renderTop(); renderPage(); }; });
    document.querySelectorAll("[data-openp]").forEach(function (r) { r.onclick = function () { S.active = r.dataset.openp; save(); renderTop(); ui.sub.opc = "av"; go("opc"); }; });
    linkGo();
  };
  function linkGo() { document.querySelectorAll("[data-go]").forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var x = a.dataset.go.split(":"); go(x[0], x[1]); }; }); }
  function kpi(l, n, s) { return '<div class="kpi"><div class="l">' + l + '</div><div class="n">' + n + '</div><div class="s">' + s + "</div></div>"; }

  /* ---- Projets ---- */
  PAGES.projets = function () {
    var p = P();
    var h = '<div class="head"><h1>Projets</h1><p>Chaque projet regroupe son métré ou son devis rapide, son étude de prix, son planning, son suivi et ses documents.</p></div>';
    ui.sub.projets = ui.sub.projets || "fiche";
    h += '<div class="bar-btn"><button class="btn p" id="newP">+ Nouveau chantier (métré complet)</button><button class="btn p" id="newR">+ Petits travaux (devis rapide)</button><button class="btn" id="dupP">Dupliquer le projet actif</button><button class="btn" id="exP">+ Projet exemple (villa R+1)</button><button class="btn danger" id="delP">Supprimer le projet actif</button></div>';
    h += tabs("projets", [["fiche", "Fiche du projet"], ["marche", "Marché public" + (P().marche.type === "public" ? "" : " (non concerné)")], ["liste", "Tous les projets"]]);
    if (ui.sub.projets === "marche") return h + (window.TYP ? TYP.marcheHTML() : "");
    if (ui.sub.projets === "liste") return h + listeProjets();
    h += '<div class="card"><h2>Fiche du projet actif</h2><div class="form">' +
      fld("Nom du projet", "info.nom", { text: true }) + fld("Type d'ouvrage", "info.type", { text: true, ph: "Villa R+1, immeuble R+3…" }) +
      fld("Maître d'ouvrage (client)", "info.client", { text: true }) + fld("Téléphone du client", "info.tel", { text: true }) +
      fld("Adresse du chantier", "info.adresse", { text: true }) + fld("Ville", "info.ville", { text: true }) +
      fld("Région (prix des matériaux)", "info.region", { options: Object.keys(D.REGIONS).map(function (r) { return [r, r + " (×" + D.REGIONS[r][0].toFixed(2) + (D.REGIONS[r][1] === "estimé" ? ", estimé" : ", ANSD") + ")"]; }) }, "Coefficient appliqué aux prix des matériaux de la bibliothèque (base Dakar). Source ANSD pour Dakar, Diourbel, Kaolack, Kolda et Saint-Louis ; estimation pour les autres régions.") +
      fld("Date de l'étude", "info.date", { date: true }) + fld("Date de livraison promise", "info.dateLivraison", { date: true }) +
      fld("Statut", "statut", { options: [["etude", "En étude / devis"], ["chantier", "Chantier en cours"], ["termine", "Terminé"]] }, "Seuls les chantiers en cours sont suivis par le moteur d'anticipation (OPC).") +
      fld("Méthode de chiffrage", "mode", { options: [["complet", "Métré complet à partir du plan"], ["rapide", "Petits travaux : devis rapide sans métré"]] }) +
      fld("Type de client", "marche.type", { options: [["prive", "Privé (particulier, entreprise, diaspora)"], ["public", "Marché public (État, commune, établissement)"]] }, "Pour un marché public, l'onglet « Marché public » donne la procédure indicative, les cautions et la liste des pièces du dossier.") +
      '</div><label class="f wide"><span>Description</span>' + inp("info.description", { area: true, rows: 3 }) + "</label></div>";
    return h;
  };
  function listeProjets() {
    var h = '<div class="card"><h2>Tous les projets</h2><table class="t"><tr><th class="l">Projet</th><th class="l">Type</th><th class="l">Client</th><th class="l">Ville</th><th>Créé le</th><th></th></tr>' +
      S.projects.map(function (x) { return "<tr><td class='l'>" + esc(x.info.nom) + "</td><td class='l'>" + (x.mode === "rapide" ? "Petits travaux" : "Chantier") + (x.marche && x.marche.type === "public" ? " · public" : "") + "</td><td class='l'>" + esc(x.info.client) + "</td><td class='l'>" + esc(x.info.ville) + "</td><td>" + new Date(x.created).toLocaleDateString("fr-FR") + "</td><td>" + (x.id === S.active ? "<span class='tag'>actif</span>" : "<button class='btn sm' data-act='" + x.id + "'>Ouvrir</button>") + "</td></tr>"; }).join("") + "</table></div>";
    return h;
  }
  POST.projets = function () {
    bindTabs("projets");
    if (ui.sub.projets === "marche" && window.TYP) TYP.postMarche();
    $("newR").onclick = function () { var p = D.projetVide(); p.mode = "rapide"; p.info.nom = "Petits travaux"; S.projects.push(p); S = migrate(S); S.active = p.id; S.demo = false; save(); renderTop(); go("metres"); toast("Projet petits travaux créé : ajoutez vos lignes"); };
    $("newP").onclick = function () { var p = D.projetVide(); S.projects.push(p); S.active = p.id; S.demo = false; save(); renderTop(); renderPage(); toast("Nouveau projet créé"); };
    $("exP").onclick = function () { var p = D.exemple(); S.projects.push(p); S.active = p.id; save(); renderTop(); renderPage(); toast("Projet exemple ajouté"); };
    $("dupP").onclick = function () { var p = clone(P()); p.id = "p" + Date.now(); p.info.nom += " (copie)"; p.created = new Date().toISOString(); S.projects.push(p); S.active = p.id; save(); renderTop(); renderPage(); toast("Projet dupliqué"); };
    $("delP").onclick = function () {
      var b = $("delP");
      if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer la suppression de « " + P().info.nom + " »"; return; }
      S.projects = S.projects.filter(function (x) { return x.id !== S.active; });
      if (!S.projects.length) S.projects.push(D.projetVide());
      S.active = S.projects[0].id; save(); renderTop(); renderPage(); toast("Projet supprimé");
    };
    document.querySelectorAll("[data-act]").forEach(function (b) { b.onclick = function () { S.active = b.dataset.act; save(); renderTop(); renderPage(); }; });
  };

  /* ---- Métrés ---- */
  var TYPES_MUR = [["3.1", "Agglos creux de 20"], ["3.2", "Agglos creux de 15"], ["3.3", "Agglos creux de 10"]];
  PAGES.metres = function () {
    if (P().mode === "rapide" && window.TYP) return TYP.pageRapide();
    var h = '<div class="head"><h1>Métrés</h1><p>Saisissez les données lues sur le plan : l\'application calcule les quantités nettes de tous les corps d\'état. Les pertes sont comptées dans les sous-détails de prix, pas dans les quantités.</p></div>';
    h += tabs("metres", [["fond", "1 · Fondations"], ["niv", "2 · Niveaux"], ["fin", "3 · Toiture et options"], ["res", "4 · Résultat du métré"]]);
    h += '<div class="split"><div class="main">' + ({ fond: metFond, niv: metNiv, fin: metFin, res: metRes }[ui.sub.metres] || metFond)() + '</div><aside class="side card" id="side"></aside></div>';
    return h;
  };
  POST.metres = function () { if (P().mode === "rapide" && window.TYP) return TYP.postRapide(); bindTabs("metres"); updateSide(); bindRows(); };
  function rowsTable(path, cols, add) {
    var arr = get(P(), path) || [];
    var h = '<table class="t edit"><tr>' + cols.map(function (c) { return '<th class="' + (c.l ? "l" : "") + '">' + c.t + "</th>"; }).join("") + "<th></th></tr>";
    arr.forEach(function (r, i) {
      h += "<tr>" + cols.map(function (c) {
        var pth = path + "." + i + "." + c.k;
        return '<td class="' + (c.l ? "l" : "") + '">' + inp(pth, c.o || {}) + "</td>";
      }).join("") + '<td><button class="x" data-del="' + path + '" data-i="' + i + '" title="Supprimer">✕</button></td></tr>';
    });
    return h + '</table><button class="btn sm" data-add="' + path + '" data-tpl=\'' + JSON.stringify(add) + "'>+ Ajouter une ligne</button>";
  }
  function bindRows() {
    document.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { get(P(), b.dataset.del).splice(+b.dataset.i, 1); save(); renderPage(); }; });
    document.querySelectorAll("[data-add]").forEach(function (b) { b.onclick = function () { get(P(), b.dataset.add).push(JSON.parse(b.dataset.tpl)); save(); renderPage(); }; });
  }
  function metFond() {
    return '<div class="card"><h2>Paramètres des fouilles</h2><div class="form">' +
      fld("Profondeur de fouille (m)", "fond.profFouille", {}, "Du terrain naturel au fond de fouille.") +
      fld("Surlargeur de fouille (m)", "fond.surlarg", {}, "Surlargeur totale ajoutée aux dimensions des semelles (espace de travail).") +
      fld("Épaisseur béton de propreté (m)", "fond.epBP") + fld("Débord du béton de propreté (m)", "fond.debordBP", {}, "Débord de chaque côté de la semelle.") +
      fld("Surélévation du bâtiment (m)", "fond.surelev", {}, "Hauteur du dallage au-dessus du terrain naturel.") +
      fld("Emprise au sol (m²)", "fond.emprise", {}, "Pour le décapage et l'anti-termite. Si 0 : surface du dallage.") + "</div></div>" +
      '<div class="card"><h2>Semelles isolées</h2>' + rowsTable("fond.semelles", [{ t: "Repère", k: "nom", o: { text: true, w: "70px" }, l: 1 }, { t: "Nombre", k: "nb" }, { t: "Longueur (m)", k: "L" }, { t: "Largeur (m)", k: "l" }, { t: "Hauteur (m)", k: "h" }], { nom: "S", nb: 1, L: 1, l: 1, h: 0.35 }) + "</div>" +
      '<div class="card"><h2>Semelle filante, amorces, longrines, soubassement</h2><div class="form">' +
      fld("Semelle filante : longueur totale (m)", "fond.filante.L") + fld("Semelle filante : largeur (m)", "fond.filante.b") + fld("Semelle filante : hauteur (m)", "fond.filante.h") +
      fld("Amorces de poteaux : nombre", "fond.amorces.nb", {}, "En général, une amorce par semelle isolée.") + fld("Amorces : section a (m)", "fond.amorces.a") + fld("Amorces : section b (m)", "fond.amorces.b") +
      fld("Longrines / chaînage bas : longueur (m)", "fond.longrines.L", {}, "Longueur développée de toutes les longrines.") + fld("Longrines : largeur (m)", "fond.longrines.b") + fld("Longrines : hauteur (m)", "fond.longrines.h") +
      fld("Soubassement en agglos pleins : longueur (m)", "fond.soub.L") + fld("Soubassement : hauteur (m)", "fond.soub.h") + "</div></div>" +
      '<div class="card"><h2>Dallage</h2><div class="form">' + fld("Surface du dallage (m²)", "fond.dallage.S") + fld("Épaisseur (m)", "fond.dallage.ep") +
      fld("Treillis soudé", "fond.dallage.treillis", { check: true }) + fld("Traitement anti-termite", "fond.dallage.antiTermite", { check: true }) + "</div></div>";
  }
  function metNiv() {
    var p = P(); if (ui.niv >= p.niveaux.length) ui.niv = 0;
    var i = ui.niv, base = "niveaux." + i;
    var h = '<div class="tabs small">' + p.niveaux.map(function (v, j) { return '<button data-niv="' + j + '" class="' + (j === i ? "on" : "") + '">' + esc(v.nom) + "</button>"; }).join("") +
      '<button id="addNiv">+ Ajouter un niveau</button><button id="dupNiv">Dupliquer ce niveau</button>' + (p.niveaux.length > 1 ? '<button id="delNiv" class="danger">Supprimer ce niveau</button>' : "") + "</div>";
    if (!p.niveaux.length) return h + "<p>Aucun niveau.</p>";
    h += '<div class="card"><h2>Géométrie et maçonnerie</h2><div class="form">' + fld("Nom du niveau", base + ".nom", { text: true }) +
      fld("Hauteur d'étage (m)", base + ".h", {}, "De plancher à plancher. Sert aux poteaux et aux façades.") + fld("Hauteur des murs sous plafond (m)", base + ".hsp", {}, "Hauteur de maçonnerie et d'enduit intérieur.") +
      fld("Surface du plancher haut (m²)", base + ".S", {}, "Surface de la dalle qui couvre ce niveau (pour le dernier niveau : la terrasse).") +
      fld("Murs extérieurs : longueur (m)", base + ".Lext", {}, "Longueur développée des façades, mesurée sur le plan.") + fld("Murs extérieurs : type", base + ".extType", { options: TYPES_MUR }) +
      fld("Cloisons : longueur (m)", base + ".Lclo", {}, "Longueur développée des murs intérieurs.") + fld("Cloisons : type", base + ".cloType", { options: TYPES_MUR }) + "</div></div>";
    h += '<div class="card"><h2>Structure en béton armé</h2><div class="form">' +
      fld("Poteaux : nombre", base + ".pot.nb") + fld("Poteaux : section a (m)", base + ".pot.a") + fld("Poteaux : section b (m)", base + ".pot.b") +
      fld("Poutres : longueur totale (m)", base + ".pout.L") + fld("Poutres : largeur (m)", base + ".pout.b") + fld("Poutres : hauteur (m)", base + ".pout.h") +
      fld("Chaînages / linteaux : longueur (m)", base + ".chain.L") + fld("Chaînages : largeur (m)", base + ".chain.b") + fld("Chaînages : hauteur (m)", base + ".chain.h") +
      fld("Plancher haut", base + ".plancher", { options: [["3.7", "Corps creux 16+4 (hourdis)"], ["3.8", "Dalle pleine"]] }) + fld("Épaisseur si dalle pleine (m)", base + ".epDalle") +
      fld("Escalier : volume de béton (m³)", base + ".escalier", {}, "0 s'il n'y a pas d'escalier à ce niveau.") + "</div></div>";
    h += '<div class="card"><h2>Pièces <small>(surfaces du tableau des surfaces)</small></h2>' + rowsTable(base + ".pieces", [{ t: "Type de pièce", k: "0", o: { options: Object.keys(D.PIECES) }, l: 1 }, { t: "Nombre", k: "1" }, { t: "Surface unitaire (m²)", k: "2" }], ["Chambre", 1, 12]) +
      '<p class="hint">Chaque type de pièce génère automatiquement le carrelage, la faïence, les plinthes, les appareils sanitaires, les points lumineux, les prises et les interrupteurs.</p></div>';
    h += '<div class="card"><h2>Menuiseries de ce niveau</h2>' + rowsTable(base + ".menu", [{ t: "Menuiserie", k: "0", o: { options: Object.keys(D.MENU).map(function (k) { return [k, D.MENU[k].d + (D.MENU[k].pos === "ext" ? " (façade)" : " (intérieur)")]; }) }, l: 1 }, { t: "Nombre", k: "1" }], ["PB90", 1]) +
      '<p class="hint">Les surfaces des menuiseries sont déduites des murs, des enduits et des peintures.</p></div>';
    return h;
  }
  function metFin() {
    return '<div class="card"><h2>Toiture-terrasse <small>(plancher haut du dernier niveau)</small></h2><div class="form">' + fld("Hauteur de l'acrotère (m)", "toit.acroH") +
      fld("Forme de pente", "toit.formePente", { check: true }) + fld("Étanchéité multicouche", "toit.etancheite", { check: true }) + "</div></div>" +
      '<div class="card"><h2>Second œuvre</h2><div class="form">' + fld("Hauteur de faïence, salles d'eau (m)", "opt.faiSdb") + fld("Hauteur de faïence, cuisine (m)", "opt.faiCui", {}, "Crédence sur la moitié du périmètre de la cuisine.") +
      fld("Grilles de protection sur fenêtres", "opt.grilles", { check: true }) + fld("Garde-corps (ml)", "opt.gardeCorps") + fld("Chauffe-eau (nombre)", "opt.chauffeEau") +
      fld("Coffret de branchement / compteur", "opt.branchement", { check: true }) + "</div></div>" +
      '<div class="card"><h2>Assainissement, VRD, installation de chantier</h2><div class="form">' + fld("Fosse septique : volume utile (m³)", "opt.fosseM3", {}, "0 = calcul automatique : 3 m³ jusqu'à 5 pièces principales, +1 m³ par pièce supplémentaire.") +
      fld("Regards de visite (nombre)", "opt.regards") + fld("Mur de clôture (ml)", "opt.clotureL") + fld("Installation de chantier (% des travaux)", "opt.installPct") + "</div></div>";
  }
  function metRes() {
    var m = C.metre(P()), o = S.ouv, ph = null, h = '<div class="card"><div class="bar-btn"><button class="btn p" id="pdfMetre">Générer le PDF du métré</button></div><table class="t"><tr><th class="l">Ouvrage</th><th>Unité</th><th>Quantité</th><th class="l">Mode de calcul</th></tr>';
    m.lignes.forEach(function (l) {
      if (l.phase !== ph) { ph = l.phase; h += '<tr class="grp"><td colspan="4" class="l">' + esc(ph) + "</td></tr>"; }
      var ou = o[l.code] || {};
      h += '<tr><td class="l">' + esc(l.prefix + ou.d) + "</td><td>" + esc(ou.u) + "</td><td>" + fq(l.q) + '</td><td class="l small">' + esc(l.detail) + "</td></tr>";
    });
    return h + "</table></div>";
  }
  function updateSide() {
    var el = $("side"); if (!el) return;
    var q = Q(), m = C.metre(P()), sum = function (codes) { return m.lignes.filter(function (l) { return codes.indexOf(l.code) >= 0; }).reduce(function (s, l) { return s + l.q; }, 0); };
    el.innerHTML = '<h2>En direct</h2>' +
      '<div class="sv"><span>Surface de plancher</span><b>' + fmt(m.surface) + " m²</b></div>" +
      '<div class="sv"><span>Béton armé</span><b>' + fmt(sum(["2.2", "2.3", "2.4", "3.4", "3.5", "3.6", "3.8", "3.9"]), 2) + " m³</b></div>" +
      '<div class="sv"><span>Planchers corps creux</span><b>' + fmt(sum(["3.7"])) + " m²</b></div>" +
      '<div class="sv"><span>Maçonnerie</span><b>' + fmt(sum(["3.1", "3.2", "3.3", "2.5"])) + " m²</b></div>" +
      '<div class="sv"><span>Enduits</span><b>' + fmt(sum(["5.1", "5.2", "5.3"])) + " m²</b></div>" +
      '<div class="sv"><span>Carrelage + faïence</span><b>' + fmt(sum(["8.1", "8.2", "8.3"])) + " m²</b></div>" +
      '<div class="sv"><span>Lignes de métré</span><b>' + m.lignes.length + "</b></div>" +
      '<hr><div class="sv big"><span>Estimation TTC</span><b>' + fmt(q.ttc) + " FCFA</b></div>" +
      '<div class="sv"><span>Soit</span><b>' + fmt(q.surface ? q.ttc / q.surface : 0) + " FCFA/m²</b></div>" +
      '<p class="hint">Mis à jour à chaque saisie. Détail dans Études de prix.</p>';
  }
  POST.metresExtra = function () {};

  /* ---- Études de prix ---- */
  PAGES.prix = function () {
    var h = '<div class="head"><h1>Études de prix</h1><p>DQE, bordereau des prix, sous-détails et devis, calculés à partir du métré et de votre bibliothèque de prix.</p></div>';
    h += tabs("prix", [["dqe", "DQE"], ["bpu", "BPU"], ["sd", "Sous-détails"], ["devis", "Devis client"], ["biblio", "Bibliothèque de prix"]]);
    return h + ({ dqe: prixDQE, bpu: prixBPU, sd: prixSD, devis: prixDevis, biblio: prixBiblio }[ui.sub.prix] || prixDQE)();
  };
  POST.prix = function () { bindTabs("prix"); (POSTPRIX[ui.sub.prix] || function () {})(); };
  var POSTPRIX = {};
  function totalsBox(q) {
    return '<div class="totals" id="totals"><div><span>Total HT</span><b>' + fmt(q.ht) + ' FCFA</b></div><div><span>TVA ' + S.ent.tva + ' %</span><b>' + fmt(q.tva) + ' FCFA</b></div><div class="big"><span>Total TTC</span><b>' + fmt(q.ttc) + " FCFA</b></div>" +
      '<div class="lettres">' + esc(C.enLettres(q.ttc)) + " francs CFA TTC</div>" +
      '<div class="small">Déboursé sec ' + fmt(q.ds) + " FCFA · K = " + q.k.toFixed(3) + " · marge brute " + fmt(q.ht - q.ds) + " FCFA (" + fmt(q.ht ? 100 * (q.ht - q.ds) / q.ht : 0, 1) + " %) · " + fmt(q.surface ? q.ttc / q.surface : 0) + " FCFA TTC/m²</div></div>";
  }
  function prixDQE() {
    var q = Q();
    var h = '<div class="bar-btn"><button class="btn p" id="pdfDQE">Générer le PDF du DQE</button><button class="btn" id="csvDQE">Exporter en CSV (Excel)</button><button class="btn" id="rstOv">Effacer toutes les corrections manuelles</button></div>';
    h += '<p class="hint">Les quantités viennent du métré et les prix unitaires des sous-détails × K. Vous pouvez forcer une quantité ou un prix : la case passe en orange. Videz la case pour revenir au calcul.</p>';
    h += '<div class="card"><table class="t edit dqe"><tr><th class="l">N°</th><th class="l">Désignation</th><th>U</th><th>Quantité</th><th>P.U. HT</th><th>Montant HT</th></tr>';
    q.lots.forEach(function (L) {
      h += '<tr class="grp"><td colspan="5" class="l">Lot ' + L.num + " – " + esc(L.nom) + '</td><td id="lt-' + L.code + '">' + fmt(L.total) + "</td></tr>";
      L.lignes.forEach(function (l) {
        h += '<tr><td class="l">' + l.num + '</td><td class="l" title="' + esc(l.detail) + '">' + esc(l.d) + "</td><td>" + esc(l.u) + '</td><td><input type="number" step="any" class="' + (l.forceQ ? "forced" : "") + '" data-ov="' + l.id + '|q" value="' + C.r2(l.q) + '" placeholder="' + C.r2(l.qCalc) + '"></td>' +
          '<td><input type="number" step="any" class="' + (l.forceP ? "forced" : "") + '" data-ov="' + l.id + '|pu" value="' + l.pu + '" placeholder="' + l.puCalc + '"></td><td id="m-' + l.id + '">' + fmt(l.m) + "</td></tr>";
      });
    });
    return h + "</table>" + totalsBox(q) + "</div>";
  }
  POSTPRIX.dqe = function () {
    document.querySelectorAll("[data-ov]").forEach(function (el) {
      el.addEventListener("change", function () {
        var a = el.dataset.ov.split("|"), p = P(); p.overrides[a[0]] = p.overrides[a[0]] || {};
        if (el.value === "") delete p.overrides[a[0]][a[1]]; else p.overrides[a[0]][a[1]] = parseFloat(el.value);
        save(); refreshDQE();
      });
    });
    $("pdfDQE").onclick = function () { PDF.dqe(); };
    $("csvDQE").onclick = csvDQE;
    $("rstOv").onclick = function () { P().overrides = {}; save(); renderPage(); toast("Corrections effacées"); };
  };
  function refreshDQE() {
    var q = Q();
    q.lots.forEach(function (L) { var e = $("lt-" + L.code); if (e) e.textContent = fmt(L.total); });
    q.lignes.forEach(function (l) {
      var e = $("m-" + l.id); if (e) e.textContent = fmt(l.m);
      var iq = document.querySelector('[data-ov="' + l.id + '|q"]'), ip = document.querySelector('[data-ov="' + l.id + '|pu"]');
      if (iq) { iq.classList.toggle("forced", l.forceQ); if (iq.value === "") iq.value = C.r2(l.q); }
      if (ip) { ip.classList.toggle("forced", l.forceP); if (ip.value === "") ip.value = l.pu; }
    });
    $("totals").outerHTML = totalsBox(q);
  }
  function csvDQE() {
    var q = Q(), rows = [["N°", "Désignation", "Unité", "Quantité", "PU HT", "Montant HT"]];
    q.lots.forEach(function (L) { rows.push(["Lot " + L.num, L.nom, "", "", "", Math.round(L.total)]); L.lignes.forEach(function (l) { rows.push([l.num, l.d, l.u, String(C.r2(l.q)).replace(".", ","), l.pu, Math.round(l.m)]); }); });
    rows.push([], ["", "Total HT", "", "", "", Math.round(q.ht)], ["", "TVA " + S.ent.tva + " %", "", "", "", Math.round(q.tva)], ["", "Total TTC", "", "", "", Math.round(q.ttc)]);
    var csv = "﻿" + rows.map(function (r) { return r.map(function (c) { c = String(c == null ? "" : c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";"); }).join("\n");
    saveFile(new Blob([csv], { type: "text/csv;charset=utf-8" }), "DQE_" + slug(P().info.nom) + ".csv");
  }
  function prixBPU() {
    var q = Q();
    var h = '<div class="bar-btn"><button class="btn p" id="pdfBPU">Générer le PDF du BPU</button></div><div class="card"><table class="t"><tr><th class="l">N°</th><th class="l">Désignation</th><th>U</th><th>P.U. HT (chiffres)</th><th class="l">P.U. HT (lettres)</th></tr>';
    q.lots.forEach(function (L) {
      h += '<tr class="grp"><td colspan="5" class="l">Lot ' + L.num + " – " + esc(L.nom) + "</td></tr>";
      L.lignes.forEach(function (l) { h += '<tr><td class="l">' + l.num + '</td><td class="l">' + esc(l.d) + "</td><td>" + esc(l.u) + "</td><td>" + fmt(l.pu) + '</td><td class="l small">' + esc(C.enLettres(l.pu)) + " francs CFA</td></tr>"; });
    });
    return h + "</table></div>";
  }
  POSTPRIX.bpu = function () { $("pdfBPU").onclick = function () { PDF.bpu(); }; };
  function prixSD() {
    var q = Q(), used = []; q.lignes.forEach(function (l) { if (l.code !== "1.1" && used.indexOf(l.code) < 0) used.push(l.code); });
    if (!ui.ouv || !S.ouv[ui.ouv]) ui.ouv = used[0];
    var sd = C.sousDetail(q.cat, ui.ouv), k = q.k;
    var h = '<div class="bar-btn"><label>Ouvrage : <select id="ouvSel">' + used.map(function (c) { return '<option value="' + c + '"' + (c === ui.ouv ? " selected" : "") + ">" + c + " – " + esc(S.ouv[c].d) + "</option>"; }).join("") + '</select></label><button class="btn p" id="pdfSD">PDF de tous les sous-détails du projet</button></div>';
    if (!sd) return h;
    h += '<div class="card"><h2>Sous-détail : ' + esc(sd.d) + " (pour 1 " + esc(sd.u) + ')</h2><table class="t"><tr><th class="l">Ressource</th><th>Unité</th><th>Quantité</th><th>Perte</th><th>Qté avec pertes</th><th>Prix unitaire</th><th>Montant</th></tr>';
    var lab = { MAT: "Matériaux", MO: "Main-d'œuvre", MATL: "Matériel" };
    ["MAT", "MO", "MATL"].forEach(function (cg) {
      var ls = sd.lignes.filter(function (l) { return l.cat === cg; }); if (!ls.length) return;
      h += '<tr class="grp"><td colspan="7" class="l">' + lab[cg] + "</td></tr>";
      ls.forEach(function (l) { h += '<tr><td class="l">' + esc(l.d) + "</td><td>" + esc(l.u) + "</td><td>" + fmt(l.q, 3) + "</td><td>" + (l.perte ? l.perte + " %" : "") + "</td><td>" + fmt(l.qp, 3) + "</td><td>" + fmt(l.p) + "</td><td>" + fmt(l.m) + "</td></tr>"; });
    });
    h += '<tr class="tot"><td colspan="6" class="l">Déboursé sec unitaire (matériaux ' + fmt(sd.mat) + " · main-d'œuvre " + fmt(sd.mo) + " · matériel " + fmt(sd.matl) + ")</td><td>" + fmt(sd.ds) + "</td></tr>" +
      '<tr><td colspan="6" class="l">Coefficient de vente K (frais de chantier ' + S.ent.fc + " %, frais généraux " + S.ent.fg + " %, aléas " + S.ent.aleas + " %, bénéfice " + S.ent.benef + " %)</td><td>× " + k.toFixed(3) + "</td></tr>" +
      '<tr class="tot"><td colspan="6" class="l">Prix de vente unitaire HT (arrondi à 5 FCFA)</td><td>' + fmt(Math.round(sd.ds * k / 5) * 5) + "</td></tr></table>" +
      '<p class="hint">Pour modifier les quantités de ce sous-détail ou les prix des ressources : onglet <a href="#" id="toBib">Bibliothèque de prix</a>.</p></div>';
    return h;
  }
  POSTPRIX.sd = function () {
    $("ouvSel").onchange = function () { ui.ouv = this.value; renderPage(); };
    $("pdfSD").onclick = function () { PDF.sousDetails(); };
    var t = $("toBib"); if (t) t.onclick = function (e) { e.preventDefault(); ui.ouvEdit = ui.ouv; ui.sub.prix = "biblio"; renderPage(); };
  };
  function prixDevis() {
    var p = P(), q = Q(); p.devis = p.devis || {};
    if (!p.devis.num) p.devis.num = "D-" + new Date().getFullYear() + "-" + String(S.projects.indexOf(p) + 1).padStart(3, "0");
    if (p.devis.mode == null) p.devis.mode = "detail";
    if (p.devis.echeancier == null) p.devis.echeancier = true;
    var h = '<div class="bar-btn"><button class="btn p" id="pdfDevis">Générer le PDF du devis</button><button class="btn" id="waDevis">Envoyer au client par WhatsApp</button></div>';
    h += '<div class="card"><h2>Paramètres du devis</h2><div class="form">' + fld("N° du devis", "devis.num", { text: true }) + fld("Objet", "devis.objet", { text: true, ph: "Construction d'une villa R+1" }) +
      fld("Présentation", "devis.mode", { options: [["detail", "Détaillée (toutes les lignes)"], ["lots", "Récapitulatif par lot"]] }) + fld("Échéancier de paiement par phase", "devis.echeancier", { check: true }) +
      '</div><label class="f wide"><span>Conditions particulières (laisser vide = conditions par défaut des Paramètres)</span>' + inp("devis.conditions", { area: true, rows: 3 }) + "</label></div>";
    h += '<div class="card"><h2>Aperçu</h2><p><b>' + esc(S.ent.nom) + "</b> → <b>" + esc(p.info.client || "client") + "</b> · " + esc(p.devis.objet || p.info.nom) + "</p>" + totalsBox(q) + "</div>";
    if (p.devis.echeancier) h += '<div class="card"><h2>Échéancier proposé</h2>' + echTable(q) + "</div>";
    return h;
  }
  function echeancier(q) {
    var ac = C.n(S.ent.acompte) / 100, rows = [["Acompte à la signature", ac * q.ttc]], reste = q.ttc * (1 - ac);
    if (P().mode === "rapide") { rows.push(["Solde à la réception des travaux", reste]); return rows; }
    q.phases.forEach(function (ph) { rows.push(["Fin de phase : " + ph.nom, reste * ph.total / q.ht]); });
    return rows;
  }
  function echTable(q) {
    return '<table class="t"><tr><th class="l">Échéance</th><th>%</th><th>Montant TTC</th></tr>' + echeancier(q).map(function (r) { return '<tr><td class="l">' + esc(r[0]) + "</td><td>" + fmt(100 * r[1] / q.ttc, 1) + " %</td><td>" + fmt(r[1]) + "</td></tr>"; }).join("") + "</table>";
  }
  POSTPRIX.devis = function () { $("pdfDevis").onclick = function () { PDF.devis(); }; $("waDevis").onclick = function () { var p = P(), q = Q(); if (window.PIL) PIL.envoyer(function () { PDF.devis(); }, p.info.tel, "Bonjour" + (p.info.client ? " " + p.info.client : "") + ", veuillez trouver ci-joint notre devis n° " + (p.devis.num || "") + " pour « " + (p.devis.objet || p.info.nom) + " », d'un montant de " + fmt(q.ttc) + " FCFA TTC. Je reste à votre disposition pour en discuter. Cordialement, " + S.ent.responsable + " – " + S.ent.nom + "."); }; };
  function prixBiblio() {
    var cat = C.catalogue(ST(), P().info.region);
    var h = '<div class="note">Base de prix <b>Dakar</b>, en FCFA HT. Les matériaux sont multipliés par le coefficient de la région du projet (' + esc(P().info.region) + " : ×" + cat.coef.toFixed(2) + "). Ciment, fer, sable et gravier : moyennes ANSD 2026 ; autres prix : ordres de grandeur à remplacer par vos prix fournisseurs et tâcherons.</div>";
    // éditeur d'ouvrage
    var codes = Object.keys(S.ouv); if (!S.ouv[ui.ouvEdit]) ui.ouvEdit = codes[0];
    var o = S.ouv[ui.ouvEdit], sd = C.sousDetail(cat, ui.ouvEdit);
    h += '<div class="card"><h2>Sous-détail d\'un ouvrage</h2><div class="bar-btn"><select id="ouvEd">' + codes.map(function (c) { return '<option value="' + c + '"' + (c === ui.ouvEdit ? " selected" : "") + ">" + c + " – " + esc(S.ouv[c].d) + "</option>"; }).join("") +
      '</select><button class="btn sm" id="rstOuv">Rétablir cet ouvrage par défaut</button></div><div class="form">' +
      '<label class="f wide"><span>Désignation</span><input type="text" id="ouvD" value="' + esc(o.d) + '"></label><label class="f"><span>Unité</span><input type="text" id="ouvU" value="' + esc(o.u) + '"></label></div>' +
      '<table class="t edit"><tr><th class="l">Ressource</th><th>Unité</th><th>Quantité pour 1 ' + esc(o.u) + "</th><th>Prix (région)</th><th>Montant (avec pertes)</th><th></th></tr>";
    o.c.forEach(function (c, i) {
      var r = cat.res[c[0]] || { u: "", p: 0, perte: 0, cat: "" };
      h += '<tr><td class="l"><select data-cr="' + i + '">' + S.res.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === c[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</select></td><td>" + esc(r.u) +
        '</td><td><input type="number" step="any" data-cq="' + i + '" value="' + C.r2(c[1] * 1000) / 1000 + '"></td><td>' + fmt(r.p) + "</td><td>" + fmt(c[1] * (1 + (r.cat === "MAT" ? r.perte : 0) / 100) * r.p) + '</td><td><button class="x" data-cdel="' + i + '">✕</button></td></tr>';
    });
    h += '</table><button class="btn sm" id="addComp">+ Ajouter une ressource</button><div class="sv big" style="margin-top:10px"><span>Déboursé sec unitaire</span><b>' + fmt(sd ? sd.ds : 0) + " FCFA / " + esc(o.u) + '</b></div><div class="sv"><span>Prix de vente HT (× K ' + C.K(S.ent).toFixed(3) + ")</span><b>" + fmt(sd ? Math.round(sd.ds * C.K(S.ent) / 5) * 5 : 0) + " FCFA</b></div></div>";
    // ressources
    var lab = { MAT: "Matériaux", MO: "Main-d'œuvre (journée)", MATL: "Matériel" };
    h += '<div class="card"><h2>Ressources et prix de base (Dakar)</h2><div class="bar-btn"><button class="btn sm" id="rstRes">Rétablir tous les prix par défaut</button></div><table class="t edit"><tr><th class="l">Code</th><th class="l">Désignation</th><th>Unité</th><th>Prix Dakar HT</th><th>Perte %</th><th>Prix ' + esc(P().info.region) + "</th></tr>";
    ["MAT", "MO", "MATL"].forEach(function (cg) {
      h += '<tr class="grp"><td colspan="6" class="l">' + lab[cg] + "</td></tr>";
      S.res.forEach(function (r, i) {
        if (r[4] !== cg) return;
        h += '<tr><td class="l small">' + r[0] + '</td><td class="l"><input type="text" class="t" data-rd="' + i + '" value="' + esc(r[1]) + '"></td><td>' + esc(r[2]) + '</td><td><input type="number" step="any" data-rp="' + i + '" value="' + r[3] + '"></td><td>' + (cg === "MAT" ? '<input type="number" step="any" data-rl="' + i + '" value="' + r[5] + '" style="width:60px">' : "") + "</td><td>" + fmt(cat.res[r[0]].p) + "</td></tr>";
      });
    });
    return h + "</table></div>";
  }
  POSTPRIX.biblio = function () {
    var o = S.ouv[ui.ouvEdit];
    $("ouvEd").onchange = function () { ui.ouvEdit = this.value; renderPage(); };
    $("rstOuv").onclick = function () { if (D.OUV[ui.ouvEdit]) { S.ouv[ui.ouvEdit] = clone(D.OUV[ui.ouvEdit]); save(); renderPage(); toast("Ouvrage rétabli"); } };
    $("ouvD").onchange = function () { o.d = this.value; save(); };
    $("ouvU").onchange = function () { o.u = this.value; save(); renderPage(); };
    document.querySelectorAll("[data-cr]").forEach(function (s) { s.onchange = function () { o.c[+s.dataset.cr][0] = s.value; save(); renderPage(); }; });
    document.querySelectorAll("[data-cq]").forEach(function (s) { s.onchange = function () { o.c[+s.dataset.cq][1] = parseFloat(s.value) || 0; save(); renderPage(); }; });
    document.querySelectorAll("[data-cdel]").forEach(function (b) { b.onclick = function () { o.c.splice(+b.dataset.cdel, 1); save(); renderPage(); }; });
    $("addComp").onclick = function () { o.c.push(["MAN", 0]); save(); renderPage(); };
    document.querySelectorAll("[data-rp]").forEach(function (s) { s.onchange = function () { S.res[+s.dataset.rp][3] = parseFloat(s.value) || 0; S.demo = false; save(); renderPage(); }; });
    document.querySelectorAll("[data-rl]").forEach(function (s) { s.onchange = function () { S.res[+s.dataset.rl][5] = parseFloat(s.value) || 0; save(); renderPage(); }; });
    document.querySelectorAll("[data-rd]").forEach(function (s) { s.onchange = function () { S.res[+s.dataset.rd][1] = s.value; save(); }; });
    $("rstRes").onclick = function () {
      var b = $("rstRes"); if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer : remettre tous les prix par défaut"; return; }
      S.res = clone(D.RES); save(); renderPage(); toast("Prix par défaut rétablis");
    };
  };

  /* ---- Approvisionnements ---- */
  PAGES.appro = function () {
    var q = Q(), b = C.besoins(q, ST()), cat = q.cat;
    var phases = ["Toutes"].concat(q.phases.map(function (x) { return x.nom; }).filter(function (n) { return b.parPhase[n]; }));
    if (phases.indexOf(ui.phase) < 0) ui.phase = "Toutes";
    var data = ui.phase === "Toutes" ? b.total : b.parPhase[ui.phase] || {};
    var h = '<div class="head"><h1>Approvisionnements</h1><p>Besoins en matériaux calculés à partir des sous-détails (pertes comprises), convertis en unités d\'achat : sacs, barres, camions.</p></div>';
    h += '<div class="bar-btn"><label>Phase : <select id="phSel">' + phases.map(function (x) { return "<option" + (x === ui.phase ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + '</select></label><button class="btn p" id="pdfBC">Générer le bon de commande (PDF)</button></div>';
    var tot = 0, rows = Object.keys(data).filter(function (k) { return data[k] > 0.0001; }).sort(function (a, c) { return data[c] * cat.res[c].p - data[a] * cat.res[a].p; });
    h += '<div class="card"><table class="t"><tr><th class="l">Matériau</th><th>Quantité</th><th class="l">En unités d\'achat</th><th>P.U. estimé</th><th>Montant estimé</th></tr>';
    rows.forEach(function (k) { var r = cat.res[k], m = data[k] * r.p; tot += m; h += '<tr><td class="l">' + esc(r.d) + "</td><td>" + fmt(data[k], r.u === "u" || r.u === "pt" ? 0 : 2) + " " + esc(r.u) + '</td><td class="l">' + esc(C.unitesAchat(k, data[k], S.ent) || "") + "</td><td>" + fmt(r.p) + "</td><td>" + fmt(m) + "</td></tr>"; });
    h += '<tr class="tot"><td colspan="4" class="l">Total matériaux estimé (HT, prix ' + esc(P().info.region) + ")</td><td>" + fmt(tot) + "</td></tr></table></div>";
    if (window.PIL) h += PIL.fournisseursHTML();
    h += '<div class="card"><h2>Main-d\'œuvre totale du projet (journées)</h2><table class="t"><tr><th class="l">Métier</th><th>Journées</th><th>Coût estimé</th></tr>' + Object.keys(b.mo).map(function (k) { return '<tr><td class="l">' + esc(cat.res[k].d) + "</td><td>" + fmt(b.mo[k]) + "</td><td>" + fmt(b.mo[k] * cat.res[k].p) + "</td></tr>"; }).join("") + "</table><p class='hint'>Ces journées servent à calculer les durées du planning (cadences apprises comprises).</p></div>";
    return h;
  };
  POST.appro = function () { $("phSel").onchange = function () { ui.phase = this.value; renderPage(); }; $("pdfBC").onclick = function () { PDF.commande(ui.phase); }; };

  /* ---- Paramètres ---- */
  PAGES.params = function () {
    var e = { root: "ent" };
    var h = '<div class="head"><h1>Paramètres</h1><p>Identité de l\'entreprise (en-tête des PDF), coefficients de prix et sauvegardes.</p></div>';
    h += '<div class="card"><h2>Entreprise</h2><div class="form">' + fld("Raison sociale", "nom", { root: "ent", text: true }) + fld("Activité / slogan", "slogan", { root: "ent", text: true }) +
      fld("Adresse", "adresse", { root: "ent", text: true }) + fld("Téléphone", "tel", { root: "ent", text: true }) + fld("E-mail", "email", { root: "ent", text: true }) +
      fld("NINEA", "ninea", { root: "ent", text: true }) + fld("RCCM", "rccm", { root: "ent", text: true }) +
      fld("Responsable (signataire des devis)", "responsable", { root: "ent", text: true }) + fld("Fonction", "fonction", { root: "ent", text: true }) +
      '<label class="f"><span>Logo (PNG ou JPG)</span><input type="file" id="logoIn" accept="image/*"></label><div class="logoPrev">' + (S.ent.logo ? '<img src="' + S.ent.logo + '" alt="logo"><button class="btn sm" id="logoDel">Retirer</button>' : '<span class="hint">Aucun logo</span>') + "</div></div></div>";
    h += '<div class="card"><h2>Collaborateurs (suivi de chantier)</h2><table class="t edit"><tr><th class="l">Nom</th><th class="l">Rôle</th><th class="l">Téléphone / WhatsApp</th><th class="l">Zone ou région</th><th></th></tr>' +
      S.collab.map(function (c, i) { return "<tr>" + ["nom", "role", "tel", "zone"].map(function (k) { return '<td class="l"><input type="text" data-cb="' + i + "|" + k + '" value="' + esc(c[k]) + '"></td>'; }).join("") + '<td><button class="x" data-cbdel="' + i + '">✕</button></td></tr>'; }).join("") +
      '</table><button class="btn sm" id="addCollab">+ Ajouter un collaborateur</button><p class="hint">Ils recevront le module Suivi terrain en V2 (rapports, photos, avancement).</p></div>';
    h += '<div class="card"><h2>Coefficient de vente et TVA</h2><div class="form">' + fld("Frais de chantier (%)", "fc", e, "Encadrement, gardiennage, eau et électricité de chantier, petit matériel…") + fld("Frais généraux (%)", "fg", e, "Bureau, véhicules, assurances, comptabilité…") +
      fld("Aléas (%)", "aleas", e) + fld("Bénéfice (%)", "benef", e) + fld("TVA (%)", "tva", e) + '<div class="kbox">K = <b id="kVal"></b></div></div>' +
      '<p class="hint">K = (1 + frais de chantier) × (1 + frais généraux) × (1 + aléas) × (1 + bénéfice). Prix de vente HT = déboursé sec × K.</p></div>';
    h += '<div class="card"><h2>Devis et approvisionnement</h2><div class="form">' + fld("Validité des devis (jours)", "validite", e) + fld("Acompte à la signature (%)", "acompte", e) +
      fld("Volume d'un camion de sable (m³)", "camionSable", e) + fld("Volume d'un camion de gravier (m³)", "camionGravier", e) +
      fld("Retenue de garantie (%)", "retenue", e) + fld("Délai de paiement des factures (jours)", "delaiPaiement", e) +
      '</div><label class="f wide"><span>Modalités de paiement (bas des factures)</span>' + inp("paiementInfo", { root: "ent", text: true }) + '</label><label class="f wide"><span>Conditions générales (bas des devis)</span>' + inp("conditions", { root: "ent", area: true, rows: 4 }) + "</label></div>";
    h += '<div class="card"><h2>Effectif disponible de l\'entreprise (tous chantiers)</h2><div class="form">' + Object.keys(PLAN.CAPACITE).map(function (k) { return fld(PLAN.LIB[k].charAt(0).toUpperCase() + PLAN.LIB[k].slice(1), "capacite." + k, e); }).join("") +
      '</div><p class="hint">Le moteur d\'anticipation compare ces effectifs aux besoins de tous les chantiers en cours, jour par jour, et vous prévient des surcharges.</p></div>';
    h += '<div class="card"><h2>Version de l\'application</h2><p>' + VERSION + (location.protocol === "file:" ? ' — <b>fichier local</b> : il ne se met pas à jour tout seul. Utilisez l\'adresse en ligne de l\'application pour recevoir les mises à jour automatiquement.' : " — mises à jour automatiques activées (dès qu'il y a internet).") + "</p></div>";
    h += window.PIL ? PIL.sauvegardeHTML() : "";
    return h;
  };
  function updateK() { var e = $("kVal"); if (e) e.textContent = C.K(S.ent).toFixed(3); }
  POST.params = function () {
    updateK();
    document.querySelectorAll("[data-cb]").forEach(function (el) { el.onchange = function () { var x = el.dataset.cb.split("|"); S.collab[+x[0]][x[1]] = el.value; save(); }; });
    document.querySelectorAll("[data-cbdel]").forEach(function (b) { b.onclick = function () { S.collab.splice(+b.dataset.cbdel, 1); save(); renderPage(); }; });
    $("addCollab").onclick = function () { S.collab.push({ nom: "", role: "Chef de chantier", tel: "+221 ", zone: "" }); save(); renderPage(); };
    $("logoIn").onchange = function () {
      var f = this.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () {
        var img = new Image(); img.onload = function () {
          var sc = Math.min(1, 300 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
          cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          S.ent.logo = cv.toDataURL("image/png"); S.ent.logoRetire = false; save(); renderPage(); toast("Logo enregistré");
        }; img.src = rd.result;
      }; rd.readAsDataURL(f);
    };
    var ld = $("logoDel"); if (ld) ld.onclick = function () { S.ent.logo = ""; S.ent.logoRetire = true; save(); renderPage(); };
    if (window.PIL) PIL.postSauvegarde();
    $("rstAll").onclick = function () { var b = $("rstAll"); if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer : tout effacer"; return; } S = migrate(defState()); save(); renderTop(); renderPage(); toast("Application réinitialisée"); };
  };

  /* ---- Modules V2 ---- */
  function soon(title, intro, items) {
    return '<div class="head"><h1>' + title + "</h1><p>" + intro + '</p></div><div class="card soon"><h2>Prévu dans la prochaine version</h2><ul>' + items.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>";
  }
  PAGES.planning = function () {
    var q = Q(), b = C.besoins(q, ST());
    return soon("Planning", "Planning de Gantt généré à partir des métrés et des cadences de vos équipes.", ["Durée de chaque tâche = quantité ÷ cadence de l'équipe (calculée à partir des journées des sous-détails)", "Enchaînements logiques entre corps d'état, délais de cure du béton et de séchage", "Chemin critique, marges, prise en compte de l'hivernage", "Export PDF du planning"]) +
      '<div class="card"><h2>Déjà disponible : charge de travail du projet</h2><table class="t"><tr><th class="l">Métier</th><th>Journées</th><th>Durée avec 2 ouvriers</th><th>Durée avec 4 ouvriers</th></tr>' + Object.keys(b.mo).map(function (k) { return '<tr><td class="l">' + esc(q.cat.res[k].d) + "</td><td>" + fmt(b.mo[k]) + "</td><td>" + fmt(b.mo[k] / 2) + " j</td><td>" + fmt(b.mo[k] / 4) + " j</td></tr>"; }).join("") + "</table></div>";
  };
  PAGES.opc = function () { return soon("OPC", "Ordonnancement, pilotage et coordination de tous les corps d'état.", ["Tableau « Mes engagements » : date promise, date prévue, marge, voyant vert/orange/rouge", "Détection des conflits : ordre des travaux, délais de cure et de séchage, co-activité, équipes en double sur deux chantiers", "Planning glissant à 3 semaines (ce qui doit être prêt : matériaux, équipes, plans)", "Comptes rendus de chantier et suivi des réserves en PDF"]); };
  PAGES.terrain = function () { return soon("Suivi terrain", "Ce que vos collaborateurs remontent depuis les chantiers, sur téléphone, même sans réseau.", ["Avancement des tâches du planning, photos datées, points d'arrêt qualité avec photo obligatoire", "Journal : effectif, météo, livraisons, incidents", "Matériaux consommés et dépenses de caisse (avec photo du reçu)", "Contrôle automatique : consommation réelle comparée à la consommation théorique de l'étude de prix"]); };
  PAGES.memoires = function () { return soon("Mémoires techniques", "Mémoires générés à partir des données du projet, modifiables et exportés en PDF.", ["Présentation de l'entreprise, compréhension du projet", "Méthodologie d'exécution par corps d'état (à partir du métré)", "Planning, moyens humains et matériels (à partir des sous-détails)", "Organisation du chantier, contrôle qualité, sécurité, environnement, gestion de l'hivernage"]); };
  PAGES.factu = function () { return soon("Facturation", "Situations de travaux et factures calculées à partir de l'avancement validé.", ["Factures d'acompte, situations mensuelles cumulées, retenue de garantie", "Décompte général définitif", "Suivi des encaissements et trésorerie par chantier", "PDF avec mentions légales (NINEA, RCCM, TVA 18 %)"]); };

  /* ---------------- Fichiers ---------------- */
  function slug(s) { return String(s || "projet").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40); }
  function saveFile(blob, name) {
    if (ui.envoi && window.PIL) { var env = ui.envoi; ui.envoi = null; return PIL.partagerFichier(blob, name, env); }
    if (window.claude && typeof window.claude.use === "function") {
      window.claude.use("downloads").then(function (dl) {
        if (!dl) return anchorSave(blob, name);
        dl.save({ filename: name, data: blob }).then(function () { toast("Fichier enregistré : " + name); }, function (e) { if (e && e.code !== "declined") toast("Téléchargement impossible ici (" + (e.code || "erreur") + ")"); });
      }, function () { anchorSave(blob, name); });
      return;
    }
    anchorSave(blob, name);
  }
  function anchorSave(blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    toast("Fichier généré : " + name);
  }

  /* ---------------- PDF ---------------- */
  var PDF = (function () {
    var VERT = [27, 44, 92], GRIS = [235, 238, 245];
    function t(s) {
      return String(s == null ? "" : s).replace(/[   ]/g, " ").replace(/[–—−]/g, "-").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...")
        .replace(/œ/g, "oe").replace(/Œ/g, "OE").replace(/Σ/g, "Somme ").replace(/≈/g, "~").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/→/g, "->").replace(/[✓✕⚠]/g, "").replace(/²/g, "2").replace(/³/g, "3");
    }
    function f(v, d) { return t(fmt(v, d)); }
    function fmtImg(s) { return /^data:image\/jpe?g/.test(s) ? "JPEG" : "PNG"; }
    function doc0() { var J = window.jspdf.jsPDF; return new J({ unit: "mm", format: "a4" }); }
    function header(doc, titre, sous) {
      var pg = doc.internal.getCurrentPageInfo().pageNumber;
      doc._hdr = doc._hdr || {};
      if (doc._hdr[pg]) return;
      doc._hdr[pg] = 1;
      var E = S.ent, x = 14;
      if (E.logo) { try { doc.addImage(E.logo, fmtImg(E.logo), 14, 7, 21, 21.8); x = 39; } catch (e) {} }
      doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.text(t(E.nom), x, 13);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
      var l = [E.slogan, [E.adresse, E.tel, E.email].filter(Boolean).join(" · "), [E.ninea ? "NINEA : " + E.ninea : "", E.rccm ? "RCCM : " + E.rccm : ""].filter(Boolean).join(" · ")].filter(Boolean);
      l.forEach(function (s, i) { doc.text(t(s), x, 18 + i * 4); });
      doc.setTextColor(VERT[0], VERT[1], VERT[2]); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(t(titre), 196, 13, { align: "right" });
      if (sous) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90); doc.text(t(sous), 196, 18, { align: "right" }); }
      doc.setDrawColor(VERT[0], VERT[1], VERT[2]); doc.setLineWidth(0.5); doc.line(14, 31, 196, 31); doc.setTextColor(30, 30, 30);
    }
    function footers(doc, titre) {
      var n = doc.getNumberOfPages();
      for (var i = 1; i <= n; i++) {
        doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
        doc.text(t(S.ent.nom + " · " + titre + " · " + P().info.nom), 14, 290); doc.text("Page " + i + " / " + n, 196, 290, { align: "right" });
      }
    }
    function blocProjet(doc, y, extra) {
      var p = P(), i = p.info;
      doc.setFillColor(GRIS[0], GRIS[1], GRIS[2]); doc.roundedRect(14, y, 88, 24, 1.5, 1.5, "F"); doc.roundedRect(108, y, 88, 24, 1.5, 1.5, "F");
      doc.setFontSize(7.5); doc.setTextColor(110, 110, 110); doc.text("MAÎTRE D'OUVRAGE", 17, y + 5); doc.text("PROJET", 111, y + 5);
      doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text(t(i.client || "-"), 17, y + 10.5); doc.text(t(doc.splitTextToSize(t((p.devis && p.devis.objet) || i.nom), 80)[0]), 111, y + 10.5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      doc.text(t(i.tel || ""), 17, y + 15.5); doc.text(t([i.adresse, i.ville].filter(Boolean).join(", ")), 111, y + 15.5);
      doc.text(t(extra || ""), 17, y + 20.5); doc.text(t((i.type ? i.type + " · " : "") + "Région : " + i.region), 111, y + 20.5);
      return y + 30;
    }
    function table(doc, opt, titre, sous) {
      doc.autoTable(Object.assign({
        margin: { top: 36, bottom: 16, left: 14, right: 14 }, theme: "grid",
        styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, lineColor: [205, 210, 208], lineWidth: 0.15, textColor: [30, 30, 30], overflow: "linebreak" },
        headStyles: { fillColor: VERT, textColor: 255, fontStyle: "bold", halign: "center" },
        didDrawPage: function () { header(doc, titre, sous); }
      }, opt));
      return doc.lastAutoTable.finalY;
    }
    function grp(txt, n, total) {
      var r = [{ content: t(txt), colSpan: n - (total != null ? 1 : 0), styles: { fontStyle: "bold", fillColor: GRIS } }];
      if (total != null) r.push({ content: f(total), styles: { fontStyle: "bold", fillColor: GRIS, halign: "right" } });
      return r;
    }
    function totaux(doc, y, q, titre, sous) {
      if (y > 235) { doc.addPage(); header(doc, titre, sous); y = 38; }
      var rows = [["Total HT", f(q.ht) + " FCFA"], ["TVA " + S.ent.tva + " %", f(q.tva) + " FCFA"], ["Total TTC", f(q.ttc) + " FCFA"]];
      doc.autoTable({ startY: y + 4, margin: { left: 110, right: 14, top: 36 }, theme: "plain", body: rows, styles: { fontSize: 9.5, cellPadding: 1.8 },
        columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
        didParseCell: function (d) { if (d.row.index === 2) { d.cell.styles.fillColor = VERT; d.cell.styles.textColor = 255; d.cell.styles.fontStyle = "bold"; } } });
      y = doc.lastAutoTable.finalY + 6;
      doc.setFontSize(8.5); doc.setFont("helvetica", "italic");
      var txt = doc.splitTextToSize(t("Arrêté le présent document à la somme de : " + C.enLettres(q.ttc) + " francs CFA TTC."), 182);
      doc.text(txt, 14, y); doc.setFont("helvetica", "normal");
      return y + txt.length * 4 + 2;
    }
    function lignesDetail(q) {
      var body = [];
      q.lots.forEach(function (L) {
        body.push(grp("Lot " + L.num + " - " + L.nom, 6, L.total));
        L.lignes.forEach(function (l) { body.push([l.num, t(l.d), t(l.u), f(l.q, Math.abs(l.q - Math.round(l.q)) < 1e-9 ? 0 : 2), f(l.pu), f(l.m)]); });
      });
      return body;
    }
    var colsDet = { 0: { cellWidth: 12 }, 1: { cellWidth: 84 }, 2: { cellWidth: 12, halign: "center" }, 3: { cellWidth: 18, halign: "right" }, 4: { cellWidth: 23, halign: "right" }, 5: { cellWidth: 33, halign: "right" } };

    function dqe() {
      var q = Q(), doc = doc0(), titre = "DEVIS QUANTITATIF ET ESTIMATIF", sous = "Date : " + new Date(P().info.date || Date.now()).toLocaleDateString("fr-FR");
      header(doc, titre, sous); var y = blocProjet(doc, 35, q.surface ? "Surface de plancher : " + fmt(q.surface) + " m²" : "");
      y = table(doc, { startY: y, head: [["N°", "Désignation", "U", "Quantité", "P.U. HT", "Montant HT"]], body: lignesDetail(q), columnStyles: colsDet }, titre, sous);
      totaux(doc, y, q, titre, sous); footers(doc, "DQE"); saveFile(doc.output("blob"), "DQE_" + slug(P().info.nom) + ".pdf");
    }
    function bpu() {
      var q = Q(), doc = doc0(), titre = "BORDEREAU DES PRIX UNITAIRES", sous = "Prix unitaires hors TVA, en francs CFA";
      header(doc, titre, sous); var y = blocProjet(doc, 35, "");
      var body = [];
      q.lots.forEach(function (L) { body.push(grp("Lot " + L.num + " - " + L.nom, 5)); L.lignes.forEach(function (l) { body.push([l.num, t(l.d), t(l.u), f(l.pu), t(C.enLettres(l.pu) + " francs CFA")]); }); });
      table(doc, { startY: y, head: [["N°", "Désignation", "U", "P.U. HT", "P.U. HT en lettres"]], body: body, columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 72 }, 2: { cellWidth: 12, halign: "center" }, 3: { cellWidth: 22, halign: "right" }, 4: { cellWidth: 64 } } }, titre, sous);
      footers(doc, "BPU"); saveFile(doc.output("blob"), "BPU_" + slug(P().info.nom) + ".pdf");
    }
    function sousDetails() {
      var q = Q(), doc = doc0(), titre = "SOUS-DÉTAILS DES PRIX", sous = "K = " + fmt(q.k, 3) + " · Région : " + P().info.region, used = [], y;
      q.lignes.forEach(function (l) { if (l.code !== "1.1" && used.indexOf(l.code) < 0) used.push(l.code); });
      header(doc, titre, sous); y = 38;
      used.forEach(function (code) {
        var sd = C.sousDetail(q.cat, code); if (!sd) return;
        var body = sd.lignes.map(function (l) { return [t(l.d), t(l.u), f(l.q, 3), l.perte ? l.perte + " %" : "", f(l.p), f(l.m)]; });
        body.push([{ content: t("Déboursé sec unitaire (mat. " + fmt(sd.mat) + " · MO " + fmt(sd.mo) + " · matériel " + fmt(sd.matl) + ")"), colSpan: 5, styles: { fontStyle: "bold" } }, { content: f(sd.ds), styles: { fontStyle: "bold", halign: "right" } }]);
        body.push([{ content: t("Prix de vente unitaire HT (DS × K)"), colSpan: 5, styles: { fontStyle: "bold", fillColor: GRIS } }, { content: f(Math.round(sd.ds * q.k / 5) * 5), styles: { fontStyle: "bold", halign: "right", fillColor: GRIS } }]);
        if (y > 240) { doc.addPage(); header(doc, titre, sous); y = 38; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(doc.splitTextToSize(t(code + " - " + sd.d + " (pour 1 " + sd.u + ")"), 182), 14, y);
        y = table(doc, { startY: y + 2, head: [["Ressource", "U", "Quantité", "Perte", "P.U.", "Montant"]], body: body, columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 14, halign: "center" }, 2: { cellWidth: 20, halign: "right" }, 3: { cellWidth: 14, halign: "right" }, 4: { cellWidth: 22, halign: "right" }, 5: { cellWidth: 32, halign: "right" } } }, titre, sous) + 7;
      });
      footers(doc, "Sous-détails"); saveFile(doc.output("blob"), "Sous-details_" + slug(P().info.nom) + ".pdf");
    }
    function devis() {
      var p = P(), q = Q(), dv = p.devis || {}, doc = doc0(), titre = "DEVIS N° " + (dv.num || ""), sous = "Date : " + new Date(p.info.date || Date.now()).toLocaleDateString("fr-FR") + " · Validité : " + S.ent.validite + " jours";
      header(doc, titre, sous); var y = blocProjet(doc, 35, "");
      if (dv.mode === "lots") {
        var body = q.lots.map(function (L) { return ["Lot " + L.num, t(L.nom), f(L.total)]; });
        y = table(doc, { startY: y, head: [["Lot", "Désignation", "Montant HT"]], body: body, columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 122 }, 2: { cellWidth: 40, halign: "right" } } }, titre, sous);
      } else y = table(doc, { startY: y, head: [["N°", "Désignation", "U", "Quantité", "P.U. HT", "Montant HT"]], body: lignesDetail(q), columnStyles: colsDet }, titre, sous);
      y = totaux(doc, y, q, titre, sous);
      if (dv.echeancier) {
        if (y > 220) { doc.addPage(); header(doc, titre, sous); y = 38; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Échéancier de paiement", 14, y + 2);
        y = table(doc, { startY: y + 4, head: [["Échéance", "%", "Montant TTC"]], body: echeancier(q).map(function (r) { return [t(r[0]), f(100 * r[1] / q.ttc, 1) + " %", f(r[1])]; }), columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 22, halign: "right" }, 2: { cellWidth: 40, halign: "right" } } }, titre, sous) + 6;
      }
      var cond = doc.splitTextToSize(t("Conditions : " + (dv.conditions || (p.mode === "rapide" ? "Prix fermes pendant la durée de validité du devis. Paiement : acompte à la commande, solde à la réception des travaux. Les travaux non prévus au présent devis feront l'objet d'un devis complémentaire." : S.ent.conditions))), 182);
      if (y + cond.length * 4 + 40 > 280) { doc.addPage(); header(doc, titre, sous); y = 38; }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text(cond, 14, y); y += cond.length * 4 + 8;
      doc.setFont("helvetica", "bold"); doc.text(t("Pour " + S.ent.nom), 16, y); doc.text("Bon pour accord, le client", 113, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.text(t([S.ent.responsable, S.ent.fonction].filter(Boolean).join(", ") || "(date, signature et cachet)"), 16, y + 4); doc.text("(date, signature, mention « bon pour accord »)", 113, y + 4);
      doc.setDrawColor(180, 180, 180); doc.rect(14, y + 7, 85, 25); doc.rect(111, y + 7, 85, 25);
      footers(doc, "Devis " + (dv.num || "")); saveFile(doc.output("blob"), "Devis_" + slug(dv.num || "") + "_" + slug(p.info.nom) + ".pdf");
    }
    function metre() {
      var m = C.metre(P()), doc = doc0(), titre = "AVANT-MÉTRÉ", sous = "Quantités nettes (sans pertes)";
      header(doc, titre, sous); var y = blocProjet(doc, 35, "Surface de plancher : " + fmt(m.surface) + " m²"), body = [], ph = null;
      m.lignes.forEach(function (l) { if (l.phase !== ph) { ph = l.phase; body.push(grp(ph, 4)); } var o = S.ouv[l.code] || {}; body.push([t(l.prefix + o.d), t(o.u), f(l.q, 2), t(l.detail)]); });
      table(doc, { startY: y, head: [["Ouvrage", "U", "Quantité", "Mode de calcul"]], body: body, columnStyles: { 0: { cellWidth: 72 }, 1: { cellWidth: 12, halign: "center" }, 2: { cellWidth: 20, halign: "right" }, 3: { cellWidth: 78, fontSize: 7 } } }, titre, sous);
      footers(doc, "Métré"); saveFile(doc.output("blob"), "Metre_" + slug(P().info.nom) + ".pdf");
    }
    function commande(phase) {
      var q = Q(), b = C.besoins(q, ST()), data = phase === "Toutes" ? b.total : (b.parPhase[phase] || {}), cat = q.cat, doc = doc0();
      var titre = "BON DE COMMANDE MATÉRIAUX", sous = "Phase : " + phase;
      header(doc, titre, sous); var y = blocProjet(doc, 35, "Quantités avec pertes"), tot = 0;
      var body = Object.keys(data).filter(function (k) { return data[k] > 0.0001; }).map(function (k) { var r = cat.res[k], m = data[k] * r.p; tot += m; return [t(r.d), f(data[k], r.u === "u" || r.u === "pt" ? 0 : 2) + " " + t(r.u), t(C.unitesAchat(k, data[k], S.ent) || ""), f(r.p), f(m)]; });
      body.push([{ content: "Total estimé HT", colSpan: 4, styles: { fontStyle: "bold", fillColor: GRIS } }, { content: f(tot), styles: { fontStyle: "bold", halign: "right", fillColor: GRIS } }]);
      table(doc, { startY: y, head: [["Matériau", "Quantité", "Unités d'achat", "P.U. estimé", "Montant estimé"]], body: body, columnStyles: { 0: { cellWidth: 66 }, 1: { cellWidth: 26, halign: "right" }, 2: { cellWidth: 46 }, 3: { cellWidth: 18, halign: "right" }, 4: { cellWidth: 26, halign: "right" } } }, titre, sous);
      footers(doc, "Bon de commande"); saveFile(doc.output("blob"), "Commande_" + slug(phase) + "_" + slug(P().info.nom) + ".pdf");
    }
    return { dqe: dqe, bpu: bpu, sousDetails: sousDetails, devis: devis, metre: metre, commande: commande,
      h: { fmtImg: fmtImg, doc0: doc0, header: header, footers: footers, table: table, t: t, f: f, grp: grp, blocProjet: blocProjet, totaux: totaux, VERT: VERT, GRIS: GRIS } };
  })();

  /* ---------------- Démarrage ---------------- */
  function init() {
    load().then(function (s) { S = s; start(); });
  }
  function start() {
    var h = (location.hash || "").slice(1); if (MENU.some(function (m) { return m[0] === h; })) ui.page = h;
    renderMenu(); renderTop(); renderPage(); save();
    var vv = $("verApp"); if (vv) vv.textContent = "Version " + VERSION + (location.protocol === "file:" ? " · fichier local" : "");
    try { if (sessionStorage.getItem("majFaite")) { sessionStorage.removeItem("majFaite"); toast("Application mise à jour : version " + VERSION); } } catch (e) {}
    if ((location.protocol === "https:" || location.hostname === "localhost") && !/claudeusercontent|claude\.ai/.test(location.hostname)) {
      try {
        var lk = document.createElement("link"); lk.rel = "manifest"; lk.href = "manifest.webmanifest"; document.head.appendChild(lk);
        if ("serviceWorker" in navigator) {
          var avaitCtrl = !!navigator.serviceWorker.controller, recharge = false;
          navigator.serviceWorker.register("sw.js").then(function (reg) {
            reg.update();
            setInterval(function () { reg.update(); }, 30 * 60 * 1000);
          }).catch(function () {});
          navigator.serviceWorker.addEventListener("controllerchange", function () {
            if (!avaitCtrl || recharge) return; recharge = true;
            save(); try { sessionStorage.setItem("majFaite", "1"); } catch (e) {}
            setTimeout(function () { location.reload(); }, 600);
          });
        }
      } catch (e) {}
    }
    $("projSel").onchange = function () { S.active = this.value; save(); renderPage(); };
    $("menuSel").onchange = function () { go(this.value); };
    $("newProj").onclick = function () { var p = D.projetVide(); S.projects.push(p); S.active = p.id; S.demo = false; save(); renderTop(); go("projets"); toast("Nouveau projet créé"); };
    document.addEventListener("click", function (e) { if (e.target && e.target.id === "pdfMetre") PDF.metre(); });
    document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-niv]"); if (b) { ui.niv = +b.dataset.niv; renderPage(); } });
    document.addEventListener("click", function (e) {
      var id = e.target && e.target.id, p = P();
      if (id === "addNiv") { var nv = clone(p.niveaux[p.niveaux.length - 1]); nv.nom = "R+" + p.niveaux.length; p.niveaux.push(nv); ui.niv = p.niveaux.length - 1; save(); renderPage(); }
      if (id === "dupNiv") { var d = clone(p.niveaux[ui.niv]); d.nom += " (copie)"; p.niveaux.splice(ui.niv + 1, 0, d); ui.niv++; save(); renderPage(); }
      if (id === "delNiv") { var b = e.target; if (b.dataset.c !== "1") { b.dataset.c = "1"; b.textContent = "Confirmer la suppression"; return; } p.niveaux.splice(ui.niv, 1); ui.niv = 0; save(); renderPage(); }
    });
  }
  function reg(page, render, post) { PAGES[page] = render; if (post) POST[page] = post; }
  return { init: init, reg: reg, _state: function () { return S; }, _pdf: function () { return PDF; },
    X: { P: P, ST: ST, Q: Q, S: function () { return S; }, setS: function (s) { S = migrate(s); }, migrate: migrate, save: save, renderPage: renderPage, renderTop: renderTop, renderMenu: renderMenu, go: go, fmt: fmt, fq: fq, esc: esc, inp: inp, fld: fld, bindAll: bindAll,
      tabs: tabs, bindTabs: bindTabs, toast: toast, saveFile: saveFile, slug: slug, clone: clone, ui: ui, kpi: kpi, photoPut: photoPut, photoGet: photoGet, photoDel: photoDel, photoAll: photoAll, kvGet: kvGet, kvPut: kvPut, setStateRaw: function (s) { S = migrate(s); }, VERSION: VERSION, echeancier: echeancier, linkGo: linkGo } };
})();
document.addEventListener("DOMContentLoaded", APP.init);
