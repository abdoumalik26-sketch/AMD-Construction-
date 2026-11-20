/* ============================================================
   PILOTE BTP — moteur de calcul
   metre(p)            -> lignes de métré (quantités NETTES, sans pertes)
   catalogue(settings) -> ressources et ouvrages avec prix
   sousDetail(...)     -> déboursé sec unitaire d'un ouvrage
   dqe(p, settings)    -> DQE chiffré (lots, HT, TVA, TTC)
   besoins(...)        -> besoins matériaux par phase (pertes incluses)
   enLettres(n)        -> montant en toutes lettres
   ============================================================ */
var CALC = (function () {
  var D = (typeof DATA !== "undefined") ? DATA : require("./data.js");

  function n(v) { v = parseFloat(v); return isFinite(v) ? v : 0; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function sq(S) { return 4 * Math.sqrt(Math.max(0, S)); }  // périmètre approché d'une pièce carrée

  // ---------------------------------------------------------------- MÉTRÉ
  function metre(p) {
    var L = [], F = p.fond || {}, N = p.niveaux || [], O = p.opt || {}, T = p.toit || {};
    var PH_F = "Terrassements et fondations", PH_T = "Toiture-terrasse", PH_S = "Second œuvre et finitions", PH_V = "VRD et divers";
    function add(id, code, q, phase, detail, prefix) {
      q = r2(q);
      if (!(q > 0)) return;
      L.push({ id: id, code: code, q: q, phase: phase, detail: detail || "", prefix: prefix || "" });
    }
    var pf = n(F.profFouille), sl = n(F.surlarg), ep = n(F.epBP), d = n(F.debordBP), sur = n(F.surelev);
    // --- Semelles isolées
    var vFS = 0, vBPS = 0, vS = 0, nbS = 0, hS = 0, txt = [];
    (F.semelles || []).forEach(function (s) {
      var nb = n(s.nb), Ls = n(s.L), ls = n(s.l), hs = n(s.h);
      if (!nb) return;
      nbS += nb; hS = Math.max(hS, hs);
      vFS += nb * (Ls + sl) * (ls + sl) * pf;
      vBPS += nb * (Ls + 2 * d) * (ls + 2 * d) * ep;
      vS += nb * Ls * ls * hs;
      txt.push(s.nom + " : " + nb + " × " + Ls + " × " + ls + " × " + hs);
    });
    // --- Semelle filante
    var fi = F.filante || {}, Lf = n(fi.L), bf = n(fi.b), hf = n(fi.h);
    var vFF = Lf * (bf + sl) * pf, vBPF = Lf * (bf + 2 * d) * ep, vF = Lf * bf * hf;
    if (Lf) hS = Math.max(hS, hf);
    // --- Amorces, longrines, soubassement
    var lo = F.longrines || {}, Llo = n(lo.L), blo = n(lo.b), hlo = n(lo.h);
    var am = F.amorces || {}, nbA = n(am.nb), aA = n(am.a), bA = n(am.b);
    var hA = Math.max(0, pf + sur - hS - ep - hlo);
    var vA = nbA * aA * bA * hA;
    var so = F.soub || {}, Lso = n(so.L), hso = n(so.h);
    var vFouilles = vFS + vFF;
    var enterre = Math.max(0, pf - hS - ep);
    var vRemblai = Math.max(0, vFouilles - vBPS - vBPF - vS - vF - nbA * aA * bA * enterre - Lso * 0.2 * enterre);
    var da = F.dallage || {}, Sd = n(da.S), epd = n(da.ep);
    var emprise = n(F.emprise) || Sd;

    add("F-impl", "1.2", 1, PH_F, "Forfait");
    add("F-dec", "1.3", emprise, PH_F, "Emprise du bâtiment = " + r2(emprise) + " m²");
    add("F-fou", "1.4", vFouilles, PH_F, "Semelles : Σ nb × (L+" + sl + ") × (l+" + sl + ") × " + pf + " = " + r2(vFS) + (Lf ? " ; filante : " + Lf + " × (" + bf + "+" + sl + ") × " + pf + " = " + r2(vFF) : ""));
    add("F-rem", "1.5", vRemblai, PH_F, "Fouilles − béton de propreté − semelles − amorces et soubassement enterrés (≥ 0)");
    add("F-app", "1.6", Sd * Math.max(0, sur - epd), PH_F, "Dallage " + Sd + " m² × (surélévation " + sur + " − ép. dallage " + epd + ")");
    if (da.antiTermite) add("F-ate", "1.7", emprise, PH_F, "Emprise");
    add("F-bp", "2.1", vBPS + vBPF, PH_F, "Σ nb × (L+2×" + d + ") × (l+2×" + d + ") × " + ep);
    add("F-sem", "2.2", vS + vF, PH_F, txt.join(" ; ") + (Lf ? " ; filante " + Lf + " × " + bf + " × " + hf : ""));
    add("F-am", "2.3", vA, PH_F, nbA + " × " + aA + " × " + bA + " × h " + r2(hA) + " (prof. fouille + surélévation − semelle − BP − longrine)");
    add("F-lon", "2.4", Llo * blo * hlo, PH_F, Llo + " ml × " + blo + " × " + hlo);
    add("F-sou", "2.5", Lso * hso, PH_F, Lso + " ml × h " + hso);
    add("F-dal", "2.6", Sd * epd, PH_F, Sd + " m² × ép. " + epd);
    if (da.treillis) add("F-ts", "2.7", Sd, PH_F, "Surface du dallage");

    // --- Niveaux
    var tot = { encInt: 0, encExt: 0, plaf: 0, carInt: 0, carExt: 0, pli: 0, faiS: 0, faiC: 0, marches: 0,
      wc: 0, lav: 0, dou: 0, evi: 0, bac: 0, lum: 0, pc: 0, int: 0, vv: 0, menu: {}, grilles: 0, vernis: 0, metal: 0, ppal: 0, Stot: 0 };
    N.forEach(function (v, i) {
      var ph = "Gros œuvre " + v.nom, pre = v.nom + " – ";
      var hsp = n(v.hsp), h = n(v.h) || hsp, ouvE = 0, ouvI = 0;
      (v.menu || []).forEach(function (m) {
        var M = D.MENU[m[0]], nb = n(m[1]);
        if (!M || !nb) return;
        var s = M.L * M.H * nb;
        if (M.pos === "ext") ouvE += s; else ouvI += s;
        tot.menu[m[0]] = (tot.menu[m[0]] || 0) + nb;
        if (M.fen) tot.grilles += s;
        if (M.bois) tot.vernis += 2 * s;
        if (M.metal) tot.metal += 2 * s;
      });
      var pot = v.pot || {}, pou = v.pout || {}, ch = v.chain || {};
      var mursE = Math.max(0, n(v.Lext) * hsp - ouvE - n(pot.nb) * n(pot.a) * hsp);
      var clo = Math.max(0, n(v.Lclo) * hsp - ouvI);
      add("N" + i + "-me", v.extType || "3.2", mursE, ph, v.Lext + " ml × " + hsp + " − ouvertures ext. " + r2(ouvE) + " m² − poteaux " + r2(n(pot.nb) * n(pot.a) * hsp) + " m²", pre + "murs extérieurs – ");
      add("N" + i + "-cl", v.cloType || "3.3", clo, ph, v.Lclo + " ml × " + hsp + " − portes int. " + r2(ouvI) + " m²", pre + "cloisons – ");
      add("N" + i + "-po", "3.4", n(pot.nb) * n(pot.a) * n(pot.b) * h, ph, pot.nb + " × " + pot.a + " × " + pot.b + " × " + h, pre);
      add("N" + i + "-pt", "3.5", n(pou.L) * n(pou.b) * n(pou.h), ph, pou.L + " ml × " + pou.b + " × " + pou.h, pre);
      add("N" + i + "-ch", "3.6", n(ch.L) * n(ch.b) * n(ch.h), ph, ch.L + " ml × " + ch.b + " × " + ch.h, pre);
      if (v.plancher === "3.8") add("N" + i + "-pl", "3.8", n(v.S) * n(v.epDalle), ph, v.S + " m² × ép. " + v.epDalle, pre + "plancher haut – ");
      else add("N" + i + "-pl", "3.7", n(v.S), ph, "Surface du plancher haut", pre + "plancher haut – ");
      add("N" + i + "-es", "3.9", n(v.escalier), ph, "Volume saisi", pre);
      if (n(v.escalier) > 0) tot.marches += Math.ceil(h / 0.17);
      // finitions
      tot.encInt += Math.max(0, n(v.Lext) * hsp - ouvE) + 2 * clo;
      tot.encExt += Math.max(0, n(v.Lext) * h - ouvE);
      tot.plaf += n(v.S);
      tot.Stot += n(v.S);
      (v.pieces || []).forEach(function (pc) {
        var T2 = D.PIECES[pc[0]], nb = n(pc[1]), S = n(pc[2]);
        if (!T2 || !nb) return;
        if (T2.sol === "ext") tot.carExt += nb * S; else tot.carInt += nb * S;
        if (T2.fai === "sdb") tot.faiS += nb * sq(S) * n(O.faiSdb);
        else if (T2.fai === "cui") { tot.faiC += nb * sq(S) / 2 * n(O.faiCui); tot.pli += nb * sq(S) * 0.5; }
        else if (T2.sol === "int") tot.pli += nb * sq(S) * 0.85;
        ["wc", "lav", "dou", "evi", "bac", "lum", "pc", "int", "vv"].forEach(function (k) { tot[k] += nb * (T2[k] || 0); });
        if (["Chambre", "Séjour / salon", "Salle à manger", "Bureau"].indexOf(pc[0]) >= 0) tot.ppal += nb;
      });
    });

    // --- Toiture-terrasse (plancher haut du dernier niveau)
    if (N.length) {
      var last = N[N.length - 1], St = n(last.S), Pe = n(last.Lext), ha = n(T.acroH);
      add("T-acm", "3.2", Pe * ha, PH_T, Pe + " ml × h " + ha, "Acrotère – ");
      add("T-acc", "3.6", Pe * 0.15 * 0.15, PH_T, Pe + " ml × 0,15 × 0,15", "Acrotère – ");
      if (T.formePente) add("T-fp", "4.1", St, PH_T, "Surface de la terrasse");
      if (T.etancheite) add("T-et", "4.2", St + Pe * 0.3, PH_T, St + " m² + relevés " + Pe + " ml × 0,30");
      add("T-ep", "4.3", Math.ceil(St / 60), PH_T, "1 descente pour 60 m² de terrasse");
      tot.encExt += Pe * ha * 2;
      tot.encExt += n(N[0].Lext) * n(F.surelev);
    }

    // --- Second œuvre
    add("S-ei", "5.1", tot.encInt, PH_S, "Murs ext. (face intérieure) + cloisons (2 faces) − ouvertures");
    add("S-ee", "5.2", tot.encExt, PH_S, "Façades sur hauteur d'étage − ouvertures + acrotère (2 faces) + soubassement visible");
    add("S-pl", "5.3", tot.plaf, PH_S, "Σ surfaces des planchers");
    Object.keys(D.MENU).forEach(function (k) {
      if (tot.menu[k]) add("S-m-" + k, D.MENU[k].ouv, tot.menu[k], PH_S, "Σ des menuiseries saisies par niveau");
    });
    if (O.grilles) add("S-gri", "7.6", tot.grilles, PH_S, "Surface des fenêtres");
    add("S-gc", "7.7", n(O.gardeCorps), PH_S, "Saisi");
    add("S-ci", "8.1", tot.carInt, PH_S, "Σ surfaces des pièces intérieures");
    add("S-ce", "8.2", tot.carExt, PH_S, "Σ surfaces terrasses / balcons");
    add("S-fa", "8.3", tot.faiS + tot.faiC, PH_S, "Salles d'eau : périmètre × " + n(O.faiSdb) + " m ; cuisines : ½ périmètre × " + n(O.faiCui) + " m");
    add("S-pli", "8.4", tot.pli, PH_S, "≈ 85 % du périmètre des pièces sèches");
    add("S-mar", "8.5", tot.marches, PH_S, "Hauteur d'étage ÷ 0,17 m par escalier");
    add("S-wc", "9.1", tot.wc, PH_S, "Selon les pièces");
    add("S-lav", "9.2", tot.lav, PH_S, "Selon les pièces");
    add("S-dou", "9.3", tot.dou, PH_S, "Selon les pièces");
    add("S-evi", "9.4", tot.evi, PH_S, "Selon les pièces");
    add("S-bac", "9.5", tot.bac, PH_S, "Selon les pièces");
    add("S-cha", "9.6", n(O.chauffeEau), PH_S, "Saisi");
    var pts = tot.wc + tot.lav + tot.dou + tot.evi + tot.bac;
    add("S-ra", "9.7", pts + n(O.chauffeEau), PH_S, "Un point par appareil");
    add("S-re", "9.8", pts, PH_S, "Un point par appareil");
    add("S-lum", "10.1", tot.lum + (tot.marches ? N.length : 0), PH_S, "Selon les pièces (+ cages d'escalier)");
    add("S-pc", "10.2", tot.pc, PH_S, "Selon les pièces");
    add("S-int", "10.3", tot.int, PH_S, "Selon les pièces");
    add("S-vv", "10.4", tot.vv + (tot.marches ? 2 * N.length : 0), PH_S, "Couloirs et escaliers");
    add("S-tab", "10.5", N.length ? 1 : 0, PH_S, "1 tableau");
    add("S-ter", "10.6", N.length ? 1 : 0, PH_S, "1 ensemble");
    if (O.branchement) add("S-br", "10.7", 1, PH_S, "1 ensemble");
    add("S-pi", "11.1", tot.encInt, PH_S, "= enduits intérieurs");
    add("S-pp", "11.2", tot.plaf, PH_S, "= enduits sous plafond");
    add("S-pe", "11.3", tot.encExt, PH_S, "= enduits extérieurs");
    add("S-pg", "11.4", (O.grilles ? tot.grilles : 0) + tot.metal + n(O.gardeCorps), PH_S, "Grilles + portes métalliques (2 faces) + garde-corps (1 m²/ml)");
    add("S-ve", "11.5", tot.vernis, PH_S, "Portes bois, 2 faces");
    // --- VRD
    var fos = n(O.fosseM3) || (N.length ? Math.max(3, 3 + tot.ppal - 5) : 0);
    add("V-fos", "12.1", fos, PH_V, n(O.fosseM3) ? "Saisi" : "3 m³ jusqu'à 5 pièces principales, +1 m³ par pièce en plus (" + tot.ppal + " pièces principales)");
    add("V-reg", "12.2", n(O.regards), PH_V, "Saisi");
    add("V-clo", "12.3", n(O.clotureL), PH_V, "Saisi");
    return { lignes: L, surface: tot.Stot, ppal: tot.ppal };
  }

  // ---------------------------------------------------------------- PRIX
  function catalogue(st, region) {
    var coef = (D.REGIONS[region] || [1])[0];
    var res = {};
    (st.res || D.RES).forEach(function (r) {
      res[r[0]] = { code: r[0], d: r[1], u: r[2], p0: r[3], cat: r[4], perte: r[5], p: r[4] === "MAT" ? r[3] * coef : r[3] };
    });
    return { res: res, ouv: st.ouv || D.OUV, coef: coef };
  }
  function K(ent) {
    return (1 + n(ent.fc) / 100) * (1 + n(ent.fg) / 100) * (1 + n(ent.aleas) / 100) * (1 + n(ent.benef) / 100);
  }
  function sousDetail(cat, code) {
    var o = cat.ouv[code];
    if (!o) return null;
    var lignes = [], tot = { MAT: 0, MO: 0, MATL: 0 };
    o.c.forEach(function (c) {
      var r = cat.res[c[0]];
      if (!r) return;
      var qp = c[1] * (1 + (r.cat === "MAT" ? r.perte : 0) / 100);
      var m = qp * r.p;
      tot[r.cat] += m;
      lignes.push({ code: r.code, d: r.d, u: r.u, q: c[1], perte: r.cat === "MAT" ? r.perte : 0, qp: qp, p: r.p, m: m, cat: r.cat });
    });
    return { code: code, d: o.d, u: o.u, lot: o.lot, lignes: lignes, mat: tot.MAT, mo: tot.MO, matl: tot.MATL, ds: tot.MAT + tot.MO + tot.MATL };
  }
  function arrondi5(v) { return Math.round(v / 5) * 5; }

  // ---------------------------------------------------------------- DQE
  function dqe(p, st) {
    var cat = catalogue(st, (p.info || {}).region);
    var k = K(st.ent), m = metre(p), ov = p.overrides || {};
    var lignes = m.lignes.map(function (l) {
      var o = cat.ouv[l.code] || { d: "?", u: "", lot: "L12" };
      var sd = sousDetail(cat, l.code);
      var pu = arrondi5(sd.ds * k);
      var q = l.q, oq = ov[l.id] || {};
      if (oq.q !== undefined && oq.q !== "" && oq.q !== null) q = n(oq.q);
      if (oq.pu !== undefined && oq.pu !== "" && oq.pu !== null) pu = n(oq.pu);
      return { id: l.id, code: l.code, lot: o.lot, d: l.prefix + o.d, u: o.u, qCalc: l.q, q: q, pu: pu, puCalc: arrondi5(sd.ds * k), ds: sd.ds, m: q * pu, phase: l.phase, detail: l.detail, forceQ: q !== l.q, forceP: pu !== arrondi5(sd.ds * k) };
    });
    // Installation de chantier (% des travaux)
    var travaux = lignes.reduce(function (s, l) { return s + l.m; }, 0);
    var pct = n((p.opt || {}).installPct);
    if (pct > 0) {
      var puI = arrondi5(travaux * pct / 100), oi = ov["F-inst"] || {};
      if (oi.pu !== undefined && oi.pu !== "" && oi.pu !== null) puI = n(oi.pu);
      lignes.unshift({ id: "F-inst", code: "1.1", lot: "L1", d: "Installation et repli de chantier (" + pct + " % des travaux)", u: "FF", qCalc: 1, q: 1, pu: puI, puCalc: arrondi5(travaux * pct / 100), ds: puI / k, m: puI, phase: "Terrassements et fondations", detail: pct + " % du montant des travaux", forceQ: false, forceP: false });
    }
    // Numérotation et regroupement par lot
    var lots = D.LOTS.map(function (L, i) {
      var ls = lignes.filter(function (l) { return l.lot === L[0]; });
      ls.forEach(function (l, j) { l.num = (i + 1) + "." + (j + 1); });
      return { code: L[0], num: i + 1, nom: L[1], lignes: ls, total: ls.reduce(function (s, l) { return s + l.m; }, 0) };
    }).filter(function (L) { return L.lignes.length; });
    lots.forEach(function (L, i) { L.num = i + 1; L.lignes.forEach(function (l, j) { l.num = (i + 1) + "." + (j + 1); }); });
    var ht = lots.reduce(function (s, L) { return s + L.total; }, 0);
    var tva = ht * n(st.ent.tva) / 100;
    var ds = lignes.reduce(function (s, l) { return s + l.q * l.ds; }, 0);
    // Montant par phase
    var phases = [];
    lignes.forEach(function (l) {
      var ph = phases.filter(function (x) { return x.nom === l.phase; })[0];
      if (!ph) { ph = { nom: l.phase, total: 0 }; phases.push(ph); }
      ph.total += l.m;
    });
    var ordre = ["Terrassements et fondations"].concat((p.niveaux || []).map(function (v) { return "Gros œuvre " + v.nom; }), ["Toiture-terrasse", "Second œuvre et finitions", "VRD et divers"]);
    phases.sort(function (a, b) { return ordre.indexOf(a.nom) - ordre.indexOf(b.nom); });
    return { lots: lots, lignes: lignes, ht: ht, tva: tva, ttc: ht + tva, ds: ds, k: k, surface: m.surface, phases: phases, cat: cat };
  }

  // ---------------------------------------------------------------- BESOINS MATÉRIAUX
  function besoins(q, st) {
    var cat = q.cat, parPhase = {}, total = {}, mo = {};
    q.lignes.forEach(function (l) {
      if (l.code === "1.1") return;
      var o = cat.ouv[l.code];
      if (!o) return;
      o.c.forEach(function (c) {
        var r = cat.res[c[0]];
        if (!r) return;
        var qt = l.q * c[1] * (1 + (r.cat === "MAT" ? r.perte : 0) / 100);
        if (r.cat === "MO") { mo[r.code] = (mo[r.code] || 0) + qt; return; }
        if (r.cat !== "MAT") return;
        parPhase[l.phase] = parPhase[l.phase] || {};
        parPhase[l.phase][r.code] = (parPhase[l.phase][r.code] || 0) + qt;
        total[r.code] = (total[r.code] || 0) + qt;
      });
    });
    return { parPhase: parPhase, total: total, mo: mo };
  }
  // conversion en unités d'achat
  function unitesAchat(code, qt, ent) {
    var kgm = D.KGM[code];
    if (code === "CIM") return Math.ceil(qt * 20) + " sacs de 50 kg (" + r2(qt) + " t)";
    if (code === "SAB") return r2(qt) + " m³ ≈ " + Math.ceil(qt / (n(ent.camionSable) || 16)) + " camion(s) de " + (n(ent.camionSable) || 16) + " m³";
    if (code === "GRA") return r2(qt) + " m³ ≈ " + Math.ceil(qt / (n(ent.camionGravier) || 8)) + " camion(s) de " + (n(ent.camionGravier) || 8) + " m³";
    if (kgm) return Math.ceil(qt / (kgm * 12)) + " barres de 12 m (" + r2(qt / 1000) + " t)";
    return null;
  }

  // ---------------------------------------------------------------- MONTANT EN LETTRES
  var U = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  var DIZ = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];
  function moins100(x) {
    if (x < 20) return U[x];
    var d = Math.floor(x / 10), u = x % 10;
    if (d === 7 || d === 9) { var base = d === 7 ? "soixante" : "quatre-vingt"; return base + (d === 7 && u === 1 ? " et " : "-") + U[10 + u]; }
    if (d === 8) return u === 0 ? "quatre-vingts" : "quatre-vingt-" + U[u];
    return DIZ[d] + (u === 0 ? "" : u === 1 ? " et un" : "-" + U[u]);
  }
  function moins1000(x, final) {
    var c = Math.floor(x / 100), r = x % 100, s = "";
    if (c) s = (c > 1 ? U[c] + " cent" : "cent") + (c > 1 && r === 0 && final ? "s" : "");
    if (r) { var t = moins100(r); if (!final && t === "quatre-vingts") t = "quatre-vingt"; s += (s ? " " : "") + t; }
    return s;
  }
  function enLettres(v) {
    v = Math.round(Math.abs(n(v)));
    if (v === 0) return "zéro";
    var parts = [], mds = Math.floor(v / 1e9), mio = Math.floor(v % 1e9 / 1e6), mil = Math.floor(v % 1e6 / 1000), rest = v % 1000;
    if (mds) parts.push(moins1000(mds, true) + " milliard" + (mds > 1 ? "s" : ""));
    if (mio) parts.push(moins1000(mio, true) + " million" + (mio > 1 ? "s" : ""));
    if (mil) parts.push(mil === 1 ? "mille" : moins1000(mil, false) + " mille");
    if (rest) parts.push(moins1000(rest, true));
    var s = parts.join(" ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  return { metre: metre, catalogue: catalogue, sousDetail: sousDetail, dqe: dqe, besoins: besoins, unitesAchat: unitesAchat, enLettres: enLettres, K: K, n: n, r2: r2 };
})();
if (typeof module !== "undefined") module.exports = CALC;
