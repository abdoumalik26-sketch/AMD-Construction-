/* =========================================================
   2AM CONSTRUCTION — Synchronisation en ligne (Supabase)
   · Administrateur (bureau) : tous les projets, paramètres, rapports reçus
   · Collaborateur : uniquement ses chantiers, sans prix ; envoie ses rapports
   · Espace client : lien privé en lecture seule (#suivi=…)
   L'application reste utilisable hors connexion : tout part et arrive
   dès que le réseau revient.
   ========================================================= */
var SYNC = (function () {
  var URL_SB = "https://qcjxjohoqpegubxfpdxb.supabase.co", CLE = "sb_publishable_QmiVXl-53nL6qWNVHme5FQ_gTzpcWZN";
  var APPURL = "https://abdoumalik26-sketch.github.io/AMD-Construction-/";
  var X = APP.X, PL = PLAN, Cc = CALC, D = DATA, esc = X.esc, fmt = X.fmt;
  var $ = function (id) { return document.getElementById(id); };
  var sb = null, E = { user: null, membre: null, enCours: false, relancer: false, derniere: null, erreur: null, t: null, membres: null, affect: null };
  function S() { return X.S(); }
  function fr(s) { return PL.fr(s); }
  function client() { if (!sb && window.supabase && window.supabase.createClient) sb = window.supabase.createClient(URL_SB, CLE, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "sb-2am-auth" } }); return sb; }
  function hash(s) { var h = 5381, i = s.length; while (i) h = (h * 33) ^ s.charCodeAt(--i); return (h >>> 0).toString(36) + ":" + s.length; }
  function ms(t) { return t ? Date.parse(t) || 0 : 0; }
  function estAdmin() { return !!(E.membre && E.membre.actif && E.membre.role === "admin"); }
  function estCollab() { var s = S && X.S && X.S(); return !!(s && s.sync && s.sync.role === "collab"); }
  function exemple(p) { return /exemple/i.test((p.info && p.info.nom) || ""); }
  function indicateur() {
    var el = $("syncState"); if (!el) return;
    if (!E.user) { el.textContent = ""; return; }
    el.textContent = E.enCours ? "☁ synchronisation…" : E.erreur ? "☁ hors ligne" : E.derniere ? "☁ synchronisé · " + E.derniere.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "☁ connecté";
    el.title = E.erreur || "";
  }
  function err(e) { return (e && (e.message || e.error_description || e.msg)) || String(e); }
  function chk(r) { if (r && r.error) throw r.error; return r ? r.data : null; }

  /* ---------------- Connexion ---------------- */
  function init() {
    var c = client(); if (!c) return;
    c.auth.getSession().then(function (r) { var ss = r.data && r.data.session; if (ss) { E.user = ss.user; chargerMembre().then(function () { synchroniser(); }); } });
    c.auth.onAuthStateChange(function (ev, ss) {
      if (ev === "SIGNED_OUT") { E.user = null; E.membre = null; indicateur(); return; }
      if (ss && (!E.user || E.user.id !== ss.user.id)) { E.user = ss.user; chargerMembre().then(function () { synchroniser(); if (X.ui.page === "params") X.renderPage(); }); }
    });
    window.addEventListener("online", function () { synchroniser(); });
    setInterval(function () { if (E.user && navigator.onLine) synchroniser(); }, 2 * 60 * 1000);
  }
  function chargerMembre() {
    return client().from("membres").select("*").eq("user_id", E.user.id).maybeSingle().then(function (r) {
      E.membre = r.data || null;
      var s = S(), role = E.membre && E.membre.actif ? E.membre.role : "attente", avant = s.sync.role;
      s.sync.role = role; s.sync.email = E.user.email;
      if (role !== avant) { X.save(); X.renderMenu(); X.renderPage(); }
      indicateur();
    }, function (e) { E.erreur = err(e); indicateur(); });
  }
  function connexion(email, mdp) {
    return client().auth.signInWithPassword({ email: email, password: mdp }).then(function (r) { if (r.error) throw r.error; E.user = r.data.user; return chargerMembre(); });
  }
  function inscription(email, mdp, nom) {
    return client().auth.signUp({ email: email, password: mdp, options: { data: { nom: nom }, emailRedirectTo: APPURL } }).then(function (r) {
      if (r.error) throw r.error;
      if (!r.data.session) return "confirmer";
      E.user = r.data.user; return chargerMembre().then(function () { return "ok"; });
    });
  }
  function deconnexion() {
    return client().auth.signOut().then(function () { var s = S(); s.sync.role = ""; E.user = null; E.membre = null; X.save(); X.renderMenu(); X.renderPage(); indicateur(); });
  }

  /* ---------------- Synchronisation ---------------- */
  function apresEnregistrement() {
    if (!E.user || E.enCours) return;
    if (estCollab() && !S().sync.file.length) return;
    clearTimeout(E.t); E.t = setTimeout(synchroniser, 8000);
  }
  function synchroniser() {
    if (!E.user || !client()) return Promise.resolve();
    if (E.enCours) { E.relancer = true; return Promise.resolve(); }
    var role = S().sync.role;
    if (role !== "admin" && role !== "collab") return Promise.resolve();
    E.enCours = true; E.erreur = null; indicateur();
    var tache = role === "admin" ? syncAdmin() : syncCollab();
    return tache.then(function (modif) {
      E.derniere = new Date();
      if (modif) { X.save(); X.renderTop(); if (["params", "terrain", "dash", "opc", "archives"].indexOf(X.ui.page) >= 0) X.renderPage(); }
    }, function (e) { E.erreur = navigator.onLine ? err(e) : "Pas de réseau : synchronisation dès le retour de la connexion"; })
      .then(function () { E.enCours = false; indicateur(); if (E.relancer) { E.relancer = false; setTimeout(synchroniser, 1000); } });
  }

  // ---- Administrateur
  function donneesParam() { var s = S(); return { ent: s.ent, res: s.res, ouv: s.ouv, collab: s.collab, appr: s.appr }; }
  function syncAdmin() {
    var c = client(), s = S(), modif = false;
    return c.from("parametres").select("updated_at,data").eq("id", 1).maybeSingle().then(function (r) {
      var row = chk(r), loc = JSON.stringify(donneesParam()), hLoc = hash(loc);
      if (row && (!s.sync.hash._param || (hLoc === s.sync.hash._param && ms(row.updated_at) > (s.sync.remoteAt._param || 0)))) {
        Object.assign(s, row.data); s.sync.hash._param = hash(JSON.stringify(donneesParam())); s.sync.remoteAt._param = ms(row.updated_at); modif = true; return;
      }
      if (!row || hLoc !== s.sync.hash._param) {
        var now = new Date().toISOString();
        return c.from("parametres").upsert({ id: 1, data: JSON.parse(loc), updated_at: now }).then(function (r2) { chk(r2); s.sync.hash._param = hLoc; s.sync.remoteAt._param = ms(now); modif = true; });
      }
    }).then(function () {
      // Projets modifiés ailleurs (autre appareil de l'administrateur)
      return c.from("projets").select("id,updated_at,supprime").then(function (r) {
        var rows = chk(r) || [], aLire = rows.filter(function (x) { return ms(x.updated_at) > (s.sync.remoteAt[x.id] || 0); });
        if (!aLire.length) return;
        return c.from("projets").select("id,data,updated_at,supprime").in("id", aLire.map(function (x) { return x.id; })).then(function (r2) {
          (chk(r2) || []).forEach(function (row) {
            var loc = s.projects.filter(function (p) { return p.id === row.id; })[0], hLoc = loc ? hash(JSON.stringify(loc)) : null, inchange = loc && hLoc === s.sync.hash[row.id];
            if (row.supprime) { if (loc && inchange) { s.projects = s.projects.filter(function (p) { return p.id !== row.id; }); modif = true; } }
            else if (!loc) { s.projects.push(row.data); modif = true; }
            else if (inchange) { s.projects[s.projects.indexOf(loc)] = row.data; modif = true; }
            else X.toast("« " + loc.info.nom + " » a été modifié ici et sur un autre appareil : la version de cet appareil est conservée");
            s.sync.remoteAt[row.id] = ms(row.updated_at);
            if (!row.supprime && (!loc || inchange)) s.sync.hash[row.id] = hash(JSON.stringify(row.data));
          });
          if (!s.projects.length) s.projects.push(D.projetVide());
          if (!s.projects.some(function (p) { return p.id === s.active; })) s.active = s.projects[0].id;
          X.setStateRaw(s); s = S();
        });
      });
    }).then(function () { return recevoirRapports().then(function (n) { if (n) modif = true; }); })
      .then(function () {
        // Envoi des projets modifiés sur cet appareil
        s = S();
        var aEnvoyer = s.projects.filter(function (p) { return !exemple(p) && hash(JSON.stringify(p)) !== s.sync.hash[p.id]; });
        return aEnvoyer.reduce(function (pr, p) { return pr.then(function () { return envoyerProjet(p).then(function () { modif = true; }); }); }, Promise.resolve());
      }).then(function () {
        var sup = s.sync.supprimes.slice(); if (!sup.length) return;
        return c.from("projets").update({ supprime: true, updated_at: new Date().toISOString() }).in("id", sup).then(function (r) { chk(r); s.sync.supprimes = []; modif = true; });
      }).then(function () { return modif; });
  }
  function envoyerProjet(p) {
    var c = client(), s = S(), txt = JSON.stringify(p), now = new Date().toISOString();
    return c.from("projets").upsert({ id: p.id, nom: p.info.nom, data: JSON.parse(txt), archive: !!p.archive, supprime: false, updated_at: now }).then(function (r) {
      chk(r); s.sync.hash[p.id] = hash(txt); s.sync.remoteAt[p.id] = ms(now);
      if (p.archive) return;
      return c.from("chantiers").upsert({ projet_id: p.id, data: pourCollab(p), updated_at: now }).then(chk);
    }).then(function () { if (p.partage && p.partage.token) return envoyerPartage(p); });
  }
  // Copie du chantier pour les collaborateurs : sans prix, factures, marges ni documents commerciaux
  function pourCollab(p) {
    var c = JSON.parse(JSON.stringify(p)), s = S();
    ["factu", "devis", "marche", "rex", "memoire", "reception", "partage"].forEach(function (k) { delete c[k]; });
    Object.keys(c.overrides || {}).forEach(function (k) { if (c.overrides[k]) delete c.overrides[k].pu; });
    (c.rapide || []).forEach(function (r) { r.pu = r.code ? "" : 0; });
    c.opc = { avValide: (p.opc || {}).avValide || {}, lookahead: (p.opc || {}).lookahead || {}, commandes: {}, crs: [], reserves: (p.opc || {}).reserves || [] };
    return { projet: c, prod: s.ent.productivite || {}, ent: { nom: s.ent.nom, slogan: s.ent.slogan, logo: s.ent.logo, tel: s.ent.tel, responsable: s.ent.responsable } };
  }
  function idsPhotos(r) { var ids = (r.photos || []).slice(); Object.keys(r.pa || {}).forEach(function (k) { ids = ids.concat(r.pa[k] || []); }); (r.dep || []).forEach(function (d) { if (d.photo) ids.push(d.photo); }); return ids; }
  function dataURL(blob) { return new Promise(function (res) { var rd = new FileReader(); rd.onload = function () { res(rd.result); }; rd.onerror = function () { res(null); }; rd.readAsDataURL(blob); }); }
  function recevoirRapports() {
    var c = client(), s = S(), depuis = s.sync.dernierRapport || "1970-01-01T00:00:00Z", n = 0;
    return c.from("rapports").select("*").gt("created_at", depuis).order("created_at").limit(200).then(function (r) {
      var rows = chk(r) || [];
      return rows.reduce(function (pr, row) {
        return pr.then(function () {
          var p = S().projects.filter(function (x) { return x.id === row.projet_id; })[0];
          s.sync.dernierRapport = row.created_at;
          if (!p || p.suivi.rapports.some(function (x) { return x.id === row.id; })) return;
          var rap = row.data; rap.id = row.id; rap.enLigne = true;
          return Promise.all(idsPhotos(rap).map(function (id) {
            return X.photoGet(id).then(function (d) {
              if (d) return;
              return c.storage.from("photos").download(row.projet_id + "/" + id + ".jpg").then(function (dl) { if (dl.data) return dataURL(dl.data).then(function (u) { if (u) return X.photoPut(id, u.replace(/^data:[^;]*;/, "data:image/jpeg;")); }); });
            });
          })).then(function () { p.suivi.rapports.push(rap); n++; });
        });
      }, Promise.resolve()).then(function () { if (n) X.toast(n + " rapport(s) de chantier reçu(s)"); return n; });
    });
  }

  // ---- Collaborateur
  function rapportEnregistre(p, rap) {
    var s = S(); if (s.sync.role !== "collab") return;
    if (s.sync.file.indexOf(rap.id) < 0) s.sync.file.push(rap.id);
    X.save(); synchroniser();
  }
  function syncCollab() {
    var c = client(), s = S(), modif = false;
    return envoyerFile().then(function (n) { if (n) modif = true; return c.from("affectations").select("projet_id").eq("user_id", E.user.id); }).then(function (r) {
      var ids = (chk(r) || []).map(function (x) { return x.projet_id; });
      if (!ids.length) return [];
      return c.from("chantiers").select("projet_id,data,updated_at").in("projet_id", ids).then(chk);
    }).then(function (rows) {
      var sig = hash(JSON.stringify(rows.map(function (x) { return [x.projet_id, x.updated_at]; }))), enAttente = {};
      s = S();
      s.projects.forEach(function (p) { (p.suivi.rapports || []).forEach(function (r) { if (s.sync.file.indexOf(r.id) >= 0) { enAttente[p.id] = enAttente[p.id] || []; enAttente[p.id].push(r); } }); });
      if (sig === s.sync.sigCollab && s.projects.every(function (p) { return p._collab; })) return modif;
      var projets = rows.map(function (row) {
        var d = row.data, p = d.projet; p._collab = true;
        (enAttente[p.id] || []).forEach(function (r) { if (!p.suivi.rapports.some(function (x) { return x.id === r.id; })) p.suivi.rapports.push(r); });
        s.ent.productivite = d.prod || {}; ["nom", "slogan", "logo", "tel", "responsable"].forEach(function (k) { if (d.ent && d.ent[k] != null) s.ent[k] = d.ent[k]; });
        return p;
      });
      if (!projets.length) { var v = D.projetVide(); v.info.nom = "En attente d'affectation"; v._collab = true; projets = [v]; }
      s.projects = projets; s.demo = false; s.sync.sigCollab = sig;
      if (!projets.some(function (p) { return p.id === s.active; })) s.active = projets[0].id;
      X.setStateRaw(s); return true;
    });
  }
  function envoyerFile() {
    var c = client(), s = S(), n = 0;
    return s.sync.file.slice().reduce(function (pr, id) {
      return pr.then(function () {
        var p = null, rap = null;
        s.projects.forEach(function (x) { (x.suivi.rapports || []).forEach(function (r) { if (r.id === id) { p = x; rap = r; } }); });
        if (!rap) { s.sync.file = s.sync.file.filter(function (k) { return k !== id; }); return; }
        if (!rap.auteur) rap.auteur = (E.membre && (E.membre.nom || E.membre.email)) || "";
        return Promise.all(idsPhotos(rap).map(function (ph) {
          return X.photoGet(ph).then(function (d) {
            if (!d) return;
            return fetch(d).then(function (x) { return x.blob(); }).then(function (b) {
              return c.storage.from("photos").upload(p.id + "/" + ph + ".jpg", b, { contentType: "image/jpeg", upsert: false }).then(function (u) { if (u.error && !/exist|duplicate/i.test(err(u.error))) throw u.error; });
            });
          });
        })).then(function () {
          return c.from("rapports").upsert({ id: rap.id, projet_id: p.id, date: rap.date, data: rap, auteur: E.user.id }, { onConflict: "id", ignoreDuplicates: true });
        }).then(function (r) { chk(r); s.sync.file = s.sync.file.filter(function (k) { return k !== id; }); n++; });
      });
    }, Promise.resolve()).then(function () { if (n) X.toast(n + " rapport(s) envoyé(s) au bureau"); return n; });
  }

  /* ---------------- Espace client ---------------- */
  function jeton() { var a = new Uint8Array(18); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function reduire(src, max) {
    return new Promise(function (res) {
      var im = new Image(); im.onload = function () { var k = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL("image/jpeg", 0.6)); };
      im.onerror = function () { res(null); }; im.src = src;
    });
  }
  function vueClient(p) {
    var q = Cc.dqe(p, X.ST()), j = PL.d2s(new Date()), F = PL.prevision(p, q, j), s = S(), ph = {};
    F.taches.forEach(function (t) { ph[t.phase] = ph[t.phase] || { m: 0, f: 0, fin: t.pFin }; ph[t.phase].m += t.montant || 1; ph[t.phase].f += (t.montant || 1) * t.pct / 100; if (t.pFin > ph[t.phase].fin) ph[t.phase].fin = t.pFin; });
    var raps = (p.suivi.rapports || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }), photos = [];
    raps.forEach(function (r) { (r.photos || []).forEach(function (id) { if (photos.length < 9) photos.push({ id: id, date: r.date }); }); });
    return Promise.all(photos.map(function (x) { return X.photoGet(x.id).then(function (d) { return d ? reduire(d, 700).then(function (u) { return u ? { d: u, date: x.date } : null; }) : null; }); })).then(function (ims) {
      return {
        maj: new Date().toISOString(),
        entreprise: { nom: s.ent.nom, slogan: s.ent.slogan, logo: s.ent.logo, tel: s.ent.tel, email: s.ent.email, responsable: s.ent.responsable },
        projet: { nom: p.info.nom, client: p.info.client, ville: p.info.ville || p.info.region, type: p.info.type },
        avancement: Math.round(F.avancement), debut: F.cfg.debut, finPrevue: F.fin, livraison: p.info.dateLivraison || "", statut: p.statut,
        phases: Object.keys(ph).map(function (k) { return { nom: k, pct: Math.round(ph[k].m ? 100 * ph[k].f / ph[k].m : 0), fin: ph[k].fin }; }),
        prochaines: F.taches.filter(function (t) { return t.pct < 100 && t.pDebut <= PL.addDays(j, 21); }).slice(0, 8).map(function (t) { return { nom: t.nom, debut: t.pDebut, fin: t.pFin, pct: Math.round(t.pct) }; }),
        photos: ims.filter(Boolean)
      };
    });
  }
  function envoyerPartage(p) {
    return vueClient(p).then(function (v) { return client().from("partages").upsert({ token: p.partage.token, projet_id: p.id, data: v, actif: p.partage.actif !== false, updated_at: new Date().toISOString() }).then(chk); });
  }
  function lienClient(p) { return APPURL + "#suivi=" + p.partage.token; }
  function partageHTML(p) {
    var h = '<div class="card"><h2>Suivi en ligne pour le client</h2>';
    if (S().sync.role !== "admin") return h + '<p class="hint">Activez la synchronisation en ligne (Paramètres) pour donner au client un lien privé : il y voit l\'avancement, le planning et les photos, sans les prix et sans pouvoir rien modifier.</p></div>';
    if (!p.partage || !p.partage.token) return h + '<p class="hint">Le client reçoit un lien privé et voit l\'avancement, les prochaines étapes et les photos du chantier, mis à jour automatiquement. Aucun prix, aucune marge.</p><button class="btn p" id="ptCreer">Créer le lien de suivi client</button></div>';
    var actif = p.partage.actif !== false;
    return h + "<p>" + (actif ? '<span class="badge vert">Actif</span> ' : '<span class="badge orange">Désactivé</span> ') + '<input type="text" readonly value="' + esc(lienClient(p)) + '" style="width:100%;max-width:640px;margin-top:6px" id="ptLien"></p><div class="bar-btn"><button class="btn p" id="ptWA">Envoyer au client par WhatsApp</button><button class="btn" id="ptCopier">Copier le lien</button><button class="btn" id="ptMaj">Mettre à jour maintenant</button><button class="btn" id="ptOnOff">' + (actif ? "Désactiver le lien" : "Réactiver le lien") + '</button></div><p class="hint">Mis à jour automatiquement à chaque synchronisation. Ne partagez ce lien qu\'avec votre client.</p></div>';
  }
  function postPartage() {
    var p = X.P(), b;
    if ((b = $("ptCreer"))) b.onclick = function () { p.partage = { token: jeton(), actif: true, cree: PL.d2s(new Date()) }; X.save(); b.disabled = true; envoyerPartage(p).then(function () { X.toast("Lien de suivi client créé"); X.renderPage(); }, function (e) { X.toast("Création impossible : " + err(e)); X.renderPage(); }); };
    if ((b = $("ptCopier"))) b.onclick = function () { var l = lienClient(p); (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(function () { X.toast("Lien copié"); }, function () { $("ptLien").select(); }); };
    if ((b = $("ptWA"))) b.onclick = function () { var m = "Bonjour" + (p.info.client ? " " + p.info.client : "") + ", vous pouvez suivre l'avancement de votre chantier « " + p.info.nom + " » (photos, planning, prochaines étapes) à tout moment ici : " + lienClient(p) + " — " + S().ent.responsable + ", " + S().ent.nom; window.open("https://wa.me/" + (window.PIL ? PIL.numeroWA(p.info.tel) : "") + "?text=" + encodeURIComponent(m), "_blank"); };
    if ((b = $("ptMaj"))) b.onclick = function () { envoyerPartage(p).then(function () { X.toast("Suivi client mis à jour"); }, function (e) { X.toast("Mise à jour impossible : " + err(e)); }); };
    if ((b = $("ptOnOff"))) b.onclick = function () { p.partage.actif = p.partage.actif === false; X.save(); envoyerPartage(p).then(function () { X.renderPage(); }, function () { X.renderPage(); }); };
  }
  function pageClient(token) {
    document.title = "Suivi de chantier";
    var b = document.body; b.innerHTML = '<div style="max-width:880px;margin:0 auto;padding:24px 16px;font-family:system-ui,sans-serif;color:#1d2433" id="cl"><p>Chargement du suivi…</p></div>';
    var c = client(); if (!c) { $("cl").innerHTML = "<p>Suivi indisponible.</p>"; return; }
    c.rpc("vue_client", { t: token }).then(function (r) {
      var v = r.data;
      if (r.error && /fetch|network|load/i.test(err(r.error))) { $("cl").innerHTML = "<p>Pas de connexion internet : réessayez dans un moment.</p>"; return; }
      if (r.error || !v) { $("cl").innerHTML = "<h2>Lien invalide ou désactivé</h2><p>Contactez l'entreprise pour obtenir un nouveau lien.</p>"; return; }
      var e = v.entreprise || {}, bar = function (p) { return '<div style="background:#e6eaf3;border-radius:6px;height:10px;overflow:hidden"><div style="width:' + p + '%;height:100%;background:#e8892b"></div></div>'; };
      var carte = function (l, n, s) { return '<div style="flex:1;min-width:160px;background:#fff;border:1px solid #e3e7ef;border-radius:10px;padding:12px 14px"><div style="font-size:12px;color:#6b7385">' + l + '</div><div style="font-size:22px;font-weight:700;margin:4px 0">' + n + '</div><div style="font-size:12px;color:#6b7385">' + (s || "") + "</div></div>"; };
      var h = '<div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #1b2c5c;padding-bottom:12px">' + (e.logo ? '<img src="' + e.logo + '" style="height:64px">' : "") + '<div><div style="font-weight:800;font-size:20px;color:#1b2c5c">' + esc(e.nom) + '</div><div style="font-size:13px;color:#6b7385">' + esc(e.slogan || "") + "</div></div></div>";
      h += '<h1 style="font-size:24px;margin:20px 0 4px">' + esc(v.projet.nom) + '</h1><p style="color:#6b7385;margin:0 0 16px">' + esc([v.projet.client, v.projet.ville, v.projet.type].filter(Boolean).join(" · ")) + "</p>";
      h += '<div style="background:#fff;border:1px solid #e3e7ef;border-radius:10px;padding:16px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:baseline"><b>Avancement des travaux</b><span style="font-size:28px;font-weight:800;color:#1b2c5c">' + v.avancement + " %</span></div>" + bar(v.avancement) + "</div>";
      h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' + carte("Début des travaux", fr(v.debut)) + carte("Fin prévue", fr(v.finPrevue), "selon l'avancement réel") + (v.livraison ? carte("Livraison prévue au contrat", fr(v.livraison)) : "") + "</div>";
      h += '<div style="background:#fff;border:1px solid #e3e7ef;border-radius:10px;padding:16px;margin-bottom:14px"><b>Avancement par phase</b>' + v.phases.map(function (x) { return '<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>' + esc(x.nom) + "</span><span>" + x.pct + " %</span></div>" + bar(x.pct) + "</div>"; }).join("") + "</div>";
      if (v.prochaines.length) h += '<div style="background:#fff;border:1px solid #e3e7ef;border-radius:10px;padding:16px;margin-bottom:14px"><b>Prochaines étapes (3 semaines)</b><ul style="margin:8px 0 0;padding-left:18px;line-height:1.7">' + v.prochaines.map(function (x) { return "<li>" + esc(x.nom) + ' <span style="color:#6b7385">(' + fr(x.debut) + " → " + fr(x.fin) + ")</span></li>"; }).join("") + "</ul></div>";
      if (v.photos.length) h += '<div style="background:#fff;border:1px solid #e3e7ef;border-radius:10px;padding:16px;margin-bottom:14px"><b>Photos récentes du chantier</b><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-top:10px">' + v.photos.map(function (x) { return '<figure style="margin:0"><img src="' + x.d + '" style="width:100%;border-radius:8px;display:block"><figcaption style="font-size:12px;color:#6b7385">' + fr(x.date) + "</figcaption></figure>"; }).join("") + "</div></div>";
      h += '<p style="font-size:12px;color:#6b7385;margin-top:20px">Mis à jour le ' + new Date(v.maj).toLocaleString("fr-FR") + ". Contact : " + esc([e.responsable, e.tel, e.email].filter(Boolean).join(" · ")) + "</p>";
      $("cl").innerHTML = h;
    }, function () { $("cl").innerHTML = "<p>Pas de connexion internet : réessayez plus tard.</p>"; });
  }

  /* ---------------- Paramètres : connexion et équipe ---------------- */
  function paramsHTML() {
    var s = S(), role = s.sync.role, h = '<div class="card" id="syncCard"><h2>Synchronisation en ligne (bureau ↔ chantiers ↔ clients)</h2>';
    if (!client()) return h + '<p class="hint">Module de synchronisation indisponible.</p></div>';
    if (!E.user) {
      return h + '<p>Connectez-vous pour partager vos chantiers entre vos appareils, recevoir les rapports de vos collaborateurs en temps réel et donner un suivi en ligne à vos clients.</p>' +
        '<p class="hint"><b>Administrateur (Malick) :</b> créez votre compte en premier ; le premier compte devient administrateur. <b>Collaborateurs :</b> créez votre compte, puis attendez que l\'administrateur l\'active et vous affecte vos chantiers.</p>' +
        '<div class="form"><label class="f"><span>E-mail</span><input type="email" id="sbEmail" autocomplete="username"></label><label class="f"><span>Mot de passe (8 caractères minimum)</span><input type="password" id="sbMdp" autocomplete="current-password"></label><label class="f"><span>Nom (pour un nouveau compte)</span><input type="text" id="sbNom" placeholder="Prénom Nom"></label></div>' +
        '<div class="bar-btn"><button class="btn p" id="sbCon">Se connecter</button><button class="btn" id="sbIns">Créer mon compte</button></div><p id="sbMsg" class="hint"></p></div>';
    }
    h += "<p>Connecté : <b>" + esc(E.user.email) + "</b> · " + (role === "admin" ? '<span class="badge vert">Administrateur</span>' : role === "collab" ? '<span class="badge vert">Collaborateur</span>' : '<span class="badge orange">En attente de validation</span>') + "</p>";
    if (role === "attente") h += '<p>Votre compte doit être activé par l\'administrateur (2AM Construction). Prévenez-le, puis cliquez sur « Actualiser ».</p>';
    h += "<p class=\"hint\">" + (E.erreur ? "⚠ " + esc(E.erreur) : E.derniere ? "Dernière synchronisation : " + E.derniere.toLocaleString("fr-FR") : "") + (role === "collab" && s.sync.file.length ? " · " + s.sync.file.length + " rapport(s) en attente d'envoi" : "") + "</p>";
    h += '<div class="bar-btn">' + (role === "attente" ? '<button class="btn p" id="sbAct">Actualiser</button>' : '<button class="btn p" id="sbSync">Synchroniser maintenant</button>') + '<button class="btn" id="sbDec">Se déconnecter</button></div>';
    if (role === "collab") h += '<p class="hint">Vos chantiers : ' + s.projects.map(function (p) { return esc(p.info.nom); }).join(", ") + ". Faites vos rapports dans « Suivi terrain » : ils partent au bureau dès qu'il y a du réseau.</p>";
    if (role === "admin") h += '<h2 style="margin-top:16px">Équipe et chantiers affectés</h2><div id="sbEquipe"><p class="hint">Chargement…</p></div>';
    return h + "</div>";
  }
  function equipeHTML() {
    var s = S(), P = s.projects.filter(function (p) { return !p.archive && !exemple(p); });
    if (!E.membres) return '<p class="hint">Chargement…</p>';
    return '<table class="t"><tr><th class="l">Membre</th><th class="l">Rôle</th><th>Actif</th><th class="l">Chantiers affectés</th></tr>' + E.membres.map(function (m) {
      var moi = m.user_id === E.user.id;
      return '<tr><td class="l"><b>' + esc(m.nom || "—") + "</b><br><span class=\"hint\">" + esc(m.email) + '</span></td><td class="l">' + (moi ? "Administrateur" : '<select data-mrole="' + m.user_id + '"><option value="collab"' + (m.role === "collab" ? " selected" : "") + '>Collaborateur</option><option value="admin"' + (m.role === "admin" ? " selected" : "") + ">Administrateur</option></select>") + "</td><td>" + (moi ? "✓" : '<input type="checkbox" data-mact="' + m.user_id + '"' + (m.actif ? " checked" : "") + ">") + '</td><td class="l">' + (m.role === "admin" ? '<span class="hint">tous</span>' : P.map(function (p) { var on = E.affect.some(function (a) { return a.user_id === m.user_id && a.projet_id === p.id; }); return '<label style="display:inline-flex;gap:4px;margin:0 10px 4px 0"><input type="checkbox" data-maff="' + m.user_id + "|" + p.id + '"' + (on ? " checked" : "") + ">" + esc(p.info.nom) + "</label>"; }).join("") || '<span class="hint">aucun projet</span>') + "</td></tr>";
    }).join("") + '</table><p class="hint">Un collaborateur crée son compte depuis l\'application (Paramètres) sur son téléphone, avec cette même adresse : ' + esc(APPURL) + '. Cochez « Actif » puis ses chantiers : il les reçoit à sa prochaine synchronisation, sans aucun prix. Synchronisez d\'abord pour que vos projets soient en ligne.</p>';
  }
  function chargerEquipe() {
    var c = client();
    return Promise.all([c.from("membres").select("*").order("created_at"), c.from("affectations").select("*")]).then(function (r) {
      E.membres = chk(r[0]) || []; E.affect = chk(r[1]) || [];
      var el = $("sbEquipe"); if (el) { el.innerHTML = equipeHTML(); lierEquipe(); }
    }, function (e) { var el = $("sbEquipe"); if (el) el.innerHTML = '<p class="hint">⚠ ' + esc(err(e)) + "</p>"; });
  }
  function lierEquipe() {
    var c = client();
    document.querySelectorAll("[data-mrole]").forEach(function (el) { el.onchange = function () { c.from("membres").update({ role: el.value }).eq("user_id", el.dataset.mrole).then(function (r) { if (r.error) X.toast(err(r.error)); chargerEquipe(); }); }; });
    document.querySelectorAll("[data-mact]").forEach(function (el) { el.onchange = function () { c.from("membres").update({ actif: el.checked }).eq("user_id", el.dataset.mact).then(function (r) { if (r.error) X.toast(err(r.error)); else X.toast(el.checked ? "Membre activé" : "Membre désactivé"); chargerEquipe(); }); }; });
    document.querySelectorAll("[data-maff]").forEach(function (el) {
      el.onchange = function () {
        var a = el.dataset.maff.split("|"), p = S().projects.filter(function (x) { return x.id === a[1]; })[0];
        var avant = S().sync.hash[a[1]] ? Promise.resolve() : envoyerProjet(p);   // le projet doit être en ligne avant l'affectation
        avant.then(function () {
          return el.checked ? c.from("affectations").insert({ projet_id: a[1], user_id: a[0] }) : c.from("affectations").delete().eq("projet_id", a[1]).eq("user_id", a[0]);
        }).then(function (r) { if (r && r.error) X.toast(err(r.error)); else X.toast(el.checked ? "Chantier affecté" : "Affectation retirée"); X.save(); chargerEquipe(); }, function (e) { X.toast(err(e)); });
      };
    });
  }
  function postParams() {
    var b, msg = function (t) { var m = $("sbMsg"); if (m) m.textContent = t; };
    if ((b = $("sbCon"))) b.onclick = function () { msg("Connexion…"); connexion($("sbEmail").value.trim(), $("sbMdp").value).then(function () { X.renderPage(); synchroniser(); }, function (e) { msg("⚠ " + (/invalid/i.test(err(e)) ? "E-mail ou mot de passe incorrect." : /confirm/i.test(err(e)) ? "Adresse e-mail pas encore confirmée : ouvrez le lien reçu par e-mail." : err(e))); }); };
    if ((b = $("sbIns"))) b.onclick = function () {
      var em = $("sbEmail").value.trim(), md = $("sbMdp").value, nm = $("sbNom").value.trim();
      if (!em || md.length < 8) { msg("⚠ Indiquez un e-mail et un mot de passe d'au moins 8 caractères."); return; }
      msg("Création du compte…");
      inscription(em, md, nm).then(function (r) { if (r === "confirmer") msg("Compte créé. Ouvrez l'e-mail de confirmation reçu, puis revenez ici et cliquez sur « Se connecter »."); else { X.renderPage(); synchroniser(); } }, function (e) { msg("⚠ " + (/already/i.test(err(e)) ? "Ce compte existe déjà : utilisez « Se connecter »." : err(e))); });
    };
    if ((b = $("sbDec"))) b.onclick = function () { deconnexion(); };
    if ((b = $("sbAct"))) b.onclick = function () { chargerMembre().then(function () { X.renderPage(); synchroniser(); }); };
    if ((b = $("sbSync"))) b.onclick = function () { b.disabled = true; b.textContent = "Synchronisation…"; synchroniser().then(function () { X.renderPage(); X.toast(E.erreur ? "⚠ " + E.erreur : "Synchronisation terminée"); }); };
    if ($("sbEquipe")) chargerEquipe();
  }

  return { init: init, estCollab: estCollab, estAdmin: estAdmin, synchroniser: synchroniser, apresEnregistrement: apresEnregistrement, rapportEnregistre: rapportEnregistre,
    paramsHTML: paramsHTML, postParams: postParams, partageHTML: partageHTML, postPartage: postPartage, pageClient: pageClient, pourCollab: pourCollab, vueClient: vueClient, _E: E };
})();
