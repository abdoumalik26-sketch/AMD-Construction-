/* ============================================================
   PILOTE BTP — données de base (valeurs INDICATIVES, modifiables)
   Prix en FCFA HT, base Dakar. Sources principales : ANSD (IMC/ICC 2026)
   pour ciment, fer, sable, gravier. Le reste : ordres de grandeur à remplacer
   par vos prix fournisseurs.
   ============================================================ */
var DATA = (function () {

  // ---------- Ressources : [code, désignation, unité, prix Dakar, catégorie, perte %]
  var RES = [
    // Matériaux de base (ANSD 2026)
    ["CIM", "Ciment CPJ 32,5 R", "t", 71845, "MAT", 5],
    ["SAB", "Sable de dune", "m³", 4950, "MAT", 10],
    ["GRA", "Gravier concassé 5/15 – 8/16", "m³", 14400, "MAT", 5],
    ["LAT", "Latérite / sable de remblai d'apport", "m³", 4000, "MAT", 10],
    ["EAU", "Eau de chantier", "m³", 800, "MAT", 0],
    ["HA6", "Fer à béton HA 6", "kg", 390, "MAT", 8],
    ["HA8", "Fer à béton HA 8", "kg", 494, "MAT", 8],
    ["HA10", "Fer à béton HA 10", "kg", 484, "MAT", 8],
    ["HA12", "Fer à béton HA 12", "kg", 488, "MAT", 8],
    ["HA14", "Fer à béton HA 14", "kg", 548, "MAT", 8],
    ["HA16", "Fer à béton HA 16", "kg", 560, "MAT", 8],
    ["FIL", "Fil à ligaturer (fil recuit)", "kg", 1200, "MAT", 0],
    ["COF", "Coffrage bois (par emploi, amorti)", "m²", 1800, "MAT", 0],
    ["ETA", "Étaiement (par emploi, amorti)", "m²", 700, "MAT", 0],
    ["TS", "Treillis soudé", "m²", 1500, "MAT", 10],
    ["AG10", "Agglo creux 10×20×40", "u", 300, "MAT", 5],
    ["AG15", "Agglo creux 15×20×40", "u", 375, "MAT", 5],
    ["AG20", "Agglo creux 20×20×40", "u", 450, "MAT", 5],
    ["AG20P", "Agglo plein 20×20×40", "u", 550, "MAT", 5],
    ["HOU16", "Hourdis 16×20×50", "u", 500, "MAT", 5],
    ["ATE", "Produit anti-termite", "m²", 700, "MAT", 0],
    ["ETAN", "Membrane d'étanchéité multicouche autoprotégée", "m²", 7500, "MAT", 10],
    ["DEP", "Descente EP PVC Ø100 + accessoires (6 m)", "u", 20000, "MAT", 0],
    ["CAR", "Carreau grès cérame sol", "m²", 8500, "MAT", 8],
    ["CARX", "Carreau extérieur antidérapant", "m²", 7500, "MAT", 8],
    ["FAI", "Faïence murale", "m²", 6500, "MAT", 8],
    ["PLI", "Plinthe céramique", "ml", 1000, "MAT", 5],
    // Menuiseries (fourniture)
    ["PB90", "Porte isoplane 90×220 + cadre + quincaillerie", "u", 70000, "MAT", 0],
    ["PB80", "Porte isoplane 80×220 + cadre + quincaillerie", "u", 65000, "MAT", 0],
    ["PE160", "Porte d'entrée bois massif 160×220", "u", 350000, "MAT", 0],
    ["FA120", "Fenêtre aluminium vitrée 120×120", "u", 110000, "MAT", 0],
    ["FA150", "Fenêtre aluminium vitrée 150×120", "u", 140000, "MAT", 0],
    ["FA60", "Fenêtre aluminium d'aération 60×60", "u", 45000, "MAT", 0],
    ["PFA", "Porte-fenêtre aluminium 200×220", "u", 260000, "MAT", 0],
    ["PM", "Porte métallique 100×220", "u", 150000, "MAT", 0],
    ["GRI", "Grille de protection métallique (anti-vol)", "m²", 30000, "MAT", 0],
    ["GC", "Garde-corps métallique", "ml", 40000, "MAT", 0],
    // Plomberie
    ["WC", "WC à l'anglaise complet (cuvette, réservoir, abattant)", "u", 75000, "MAT", 0],
    ["LAV", "Lavabo complet + robinetterie", "u", 45000, "MAT", 0],
    ["DOU", "Douche : receveur/siphon + colonne + mitigeur", "u", 55000, "MAT", 0],
    ["EVI", "Évier de cuisine 2 bacs + robinetterie", "u", 50000, "MAT", 0],
    ["BAC", "Bac à laver", "u", 25000, "MAT", 0],
    ["CE", "Chauffe-eau électrique 50 L", "u", 110000, "MAT", 0],
    ["RESA", "Réseau d'alimentation EF par point d'eau (tubes, raccords)", "pt", 20000, "MAT", 0],
    ["RESE", "Réseau d'évacuation PVC par point (tubes, raccords)", "pt", 22000, "MAT", 0],
    // Électricité
    ["PL", "Point lumineux complet (câble, gaine, boîte, luminaire LED)", "u", 9000, "MAT", 0],
    ["PC", "Prise 2P+T 16 A complète (câble, gaine, boîte)", "u", 7000, "MAT", 0],
    ["INT", "Interrupteur simple allumage", "u", 3500, "MAT", 0],
    ["IVV", "Interrupteur va-et-vient", "u", 5000, "MAT", 0],
    ["TAB", "Tableau de répartition équipé (disjoncteurs, différentiel)", "ens", 180000, "MAT", 0],
    ["TER", "Mise à la terre (piquet, câble, barrette)", "ens", 60000, "MAT", 0],
    ["BRAN", "Coffret de branchement / compteur (hors frais Senelec)", "ens", 150000, "MAT", 0],
    // Peinture
    ["PEI_INT", "Fournitures peinture intérieure (impression + 2 couches)", "m²", 900, "MAT", 0],
    ["PEI_EXT", "Fournitures peinture extérieure (impression + 2 couches)", "m²", 1400, "MAT", 0],
    ["PEI_GLY", "Fournitures peinture glycéro (métaux)", "m²", 1200, "MAT", 0],
    ["VERN", "Fournitures vernis bois", "m²", 1000, "MAT", 0],
    // Assainissement / divers
    ["FOS", "Fournitures fosse septique (par m³ utile)", "m³", 150000, "MAT", 0],
    ["REG", "Regard béton 40×40 avec tampon", "u", 25000, "MAT", 0],
    ["DIV", "Petites fournitures et outillage", "FF", 15000, "MAT", 0],
    // Main-d'œuvre (journée, charges comprises)
    ["CHEF", "Chef d'équipe", "j", 15000, "MO", 0],
    ["MAC", "Maçon", "j", 8000, "MO", 0],
    ["FER", "Ferrailleur", "j", 8000, "MO", 0],
    ["COFR", "Coffreur", "j", 8000, "MO", 0],
    ["MAN", "Manœuvre", "j", 4000, "MO", 0],
    ["CARR", "Carreleur", "j", 8000, "MO", 0],
    ["PEIN", "Peintre", "j", 7000, "MO", 0],
    ["PLOM", "Plombier", "j", 8000, "MO", 0],
    ["ELEC", "Électricien", "j", 8000, "MO", 0],
    ["MEN", "Menuisier / poseur", "j", 8000, "MO", 0],
    ["ETANC", "Étancheur", "j", 8000, "MO", 0],
    // Matériel
    ["BET", "Bétonnière (location)", "j", 15000, "MATL", 0],
    ["VIB", "Pervibrateur (location)", "j", 10000, "MATL", 0]
  ];

  // ---------- Aides à la composition des sous-détails
  function beton(dosage, v) { v = v || 1; return [["CIM", dosage / 1000 * v], ["SAB", 0.4 * v], ["GRA", 0.8 * v], ["EAU", 0.18 * v]]; }
  function mortier(dosage, v) { return [["CIM", dosage / 1000 * v], ["SAB", 1.1 * v], ["EAU", 0.25 * v]]; }
  function acier(kg, split) {
    var out = [], k;
    for (k in split) if (split[k] > 0) out.push([k, kg * split[k]]);
    out.push(["FIL", kg * 0.01]);
    return out;
  }
  function mo(o) { var out = [], k; for (k in o) out.push([k, o[k]]); return out; }
  function cat() { return [].concat.apply([], arguments); }

  // ---------- Lots
  var LOTS = [
    ["L1", "Installation de chantier – Terrassements"],
    ["L2", "Fondations"],
    ["L3", "Gros œuvre en élévation"],
    ["L4", "Étanchéité – Toiture-terrasse"],
    ["L5", "Enduits"],
    ["L6", "Menuiserie bois"],
    ["L7", "Menuiserie aluminium et métallique"],
    ["L8", "Revêtements de sols et murs"],
    ["L9", "Plomberie – Sanitaire"],
    ["L10", "Électricité"],
    ["L11", "Peinture"],
    ["L12", "Assainissement – VRD – Divers"]
  ];

  // ---------- Ouvrages : code -> {lot, d (désignation), u, c (composants par unité)}
  var OUV = {
    "1.2": { lot: "L1", d: "Implantation de l'ouvrage", u: "FF", c: cat([["DIV", 1]], mo({ CHEF: 1, MAC: 2, MAN: 2 })) },
    "1.3": { lot: "L1", d: "Décapage de la terre végétale (ép. 15 cm)", u: "m²", c: mo({ MAN: 0.05 }) },
    "1.4": { lot: "L1", d: "Fouilles en rigoles et en puits", u: "m³", c: mo({ MAN: 0.5 }) },
    "1.5": { lot: "L1", d: "Remblai compacté des fouilles avec les déblais", u: "m³", c: mo({ MAN: 0.25 }) },
    "1.6": { lot: "L1", d: "Remblai d'apport compacté sous dallage (latérite / sable)", u: "m³", c: cat([["LAT", 1.15]], mo({ MAN: 0.3 })) },
    "1.7": { lot: "L1", d: "Traitement anti-termite du sol", u: "m²", c: cat([["ATE", 1]], mo({ MAN: 0.01 })) },

    "2.1": { lot: "L2", d: "Béton de propreté dosé à 150 kg/m³ (ép. 5 cm)", u: "m³", c: cat(beton(150), mo({ MAC: 0.3, MAN: 1 }), [["BET", 0.1]]) },
    "2.2": { lot: "L2", d: "Béton armé dosé à 350 kg/m³ pour semelles", u: "m³", c: cat(beton(350), acier(60, { HA8: 0.1, HA10: 0.5, HA12: 0.4 }), [["COF", 2]], mo({ MAC: 0.5, FER: 0.6, COFR: 0.3, MAN: 1.5 }), [["BET", 0.15], ["VIB", 0.1]]) },
    "2.3": { lot: "L2", d: "Béton armé dosé à 350 kg/m³ pour amorces de poteaux", u: "m³", c: cat(beton(350), acier(120, { HA6: 0.25, HA12: 0.75 }), [["COF", 12]], mo({ MAC: 0.8, FER: 1.2, COFR: 1.2, MAN: 2 }), [["BET", 0.2], ["VIB", 0.2]]) },
    "2.4": { lot: "L2", d: "Béton armé dosé à 350 kg/m³ pour longrines / chaînage bas", u: "m³", c: cat(beton(350), acier(100, { HA6: 0.25, HA10: 0.25, HA12: 0.5 }), [["COF", 8]], mo({ MAC: 0.8, FER: 1, COFR: 1, MAN: 2 }), [["BET", 0.2], ["VIB", 0.2]]) },
    "2.5": { lot: "L2", d: "Maçonnerie en agglos pleins de 20 en soubassement", u: "m²", c: cat([["AG20P", 12.5]], mortier(300, 0.025), mo({ MAC: 0.12, MAN: 0.12 })) },
    "2.6": { lot: "L2", d: "Dallage en béton dosé à 300 kg/m³", u: "m³", c: cat(beton(300), mo({ MAC: 0.5, MAN: 1.5 }), [["BET", 0.1]]) },
    "2.7": { lot: "L2", d: "Treillis soudé pour dallage", u: "m²", c: cat([["TS", 1.1]], mo({ MAN: 0.01 })) },

    "3.1": { lot: "L3", d: "Maçonnerie en agglos creux de 20", u: "m²", c: cat([["AG20", 12.5]], mortier(300, 0.025), mo({ MAC: 0.12, MAN: 0.12 })) },
    "3.2": { lot: "L3", d: "Maçonnerie en agglos creux de 15", u: "m²", c: cat([["AG15", 12.5]], mortier(300, 0.02), mo({ MAC: 0.11, MAN: 0.11 })) },
    "3.3": { lot: "L3", d: "Maçonnerie en agglos creux de 10", u: "m²", c: cat([["AG10", 12.5]], mortier(300, 0.015), mo({ MAC: 0.1, MAN: 0.1 })) },
    "3.4": { lot: "L3", d: "Béton armé dosé à 350 kg/m³ pour poteaux", u: "m³", c: cat(beton(350), acier(130, { HA6: 0.25, HA12: 0.75 }), [["COF", 14]], mo({ MAC: 1, FER: 1.5, COFR: 1.5, MAN: 2.5 }), [["BET", 0.2], ["VIB", 0.2]]) },
    "3.5": { lot: "L3", d: "Béton armé dosé à 350 kg/m³ pour poutres", u: "m³", c: cat(beton(350), acier(120, { HA6: 0.2, HA10: 0.2, HA12: 0.45, HA14: 0.15 }), [["COF", 10], ["ETA", 3]], mo({ MAC: 0.8, FER: 1.4, COFR: 1.4, MAN: 2.5 }), [["BET", 0.2], ["VIB", 0.2]]) },
    "3.6": { lot: "L3", d: "Béton armé dosé à 350 kg/m³ pour chaînages et linteaux", u: "m³", c: cat(beton(350), acier(100, { HA6: 0.25, HA10: 0.75 }), [["COF", 10]], mo({ MAC: 0.8, FER: 1.2, COFR: 1.2, MAN: 2.2 }), [["BET", 0.2]]) },
    "3.7": { lot: "L3", d: "Plancher en corps creux 16+4 (hourdis, nervures, table de compression)", u: "m²", c: cat([["HOU16", 8]], beton(350, 0.075), acier(4.5, { HA6: 0.2, HA10: 0.5, HA12: 0.3 }), [["TS", 1.05], ["ETA", 1], ["COF", 0.15]], mo({ MAC: 0.12, FER: 0.08, COFR: 0.1, MAN: 0.35 }), [["BET", 0.01], ["VIB", 0.005]]) },
    "3.8": { lot: "L3", d: "Béton armé dosé à 350 kg/m³ pour dalle pleine", u: "m³", c: cat(beton(350), acier(90, { HA8: 0.4, HA10: 0.6 }), [["COF", 7], ["ETA", 7]], mo({ MAC: 0.7, FER: 1, COFR: 1, MAN: 2 }), [["BET", 0.15], ["VIB", 0.15]]) },
    "3.9": { lot: "L3", d: "Béton armé dosé à 350 kg/m³ pour escalier", u: "m³", c: cat(beton(350), acier(110, { HA6: 0.15, HA10: 0.45, HA12: 0.4 }), [["COF", 8], ["ETA", 4]], mo({ MAC: 1.2, FER: 1.5, COFR: 1.8, MAN: 3 }), [["BET", 0.2], ["VIB", 0.2]]) },

    "4.1": { lot: "L4", d: "Forme de pente en mortier dosé à 250 kg/m³ (ép. moy. 5 cm)", u: "m²", c: cat(mortier(250, 0.05), mo({ MAC: 0.08, MAN: 0.1 })) },
    "4.2": { lot: "L4", d: "Étanchéité multicouche autoprotégée, y compris relevés", u: "m²", c: cat([["ETAN", 1.15]], mo({ ETANC: 0.06, MAN: 0.03 })) },
    "4.3": { lot: "L4", d: "Descente d'eaux pluviales PVC Ø100", u: "u", c: cat([["DEP", 1]], mo({ PLOM: 0.3 })) },

    "5.1": { lot: "L5", d: "Enduit intérieur au mortier de ciment (ép. 1,5 cm)", u: "m²", c: cat(mortier(350, 0.018), mo({ MAC: 0.1, MAN: 0.08 })) },
    "5.2": { lot: "L5", d: "Enduit extérieur au mortier de ciment (ép. 2 cm)", u: "m²", c: cat(mortier(350, 0.022), mo({ MAC: 0.12, MAN: 0.1 })) },
    "5.3": { lot: "L5", d: "Enduit sous plafond", u: "m²", c: cat(mortier(350, 0.015), mo({ MAC: 0.14, MAN: 0.1 })) },

    "6.1": { lot: "L6", d: "Porte isoplane 90×220, y compris cadre et quincaillerie", u: "u", c: cat([["PB90", 1]], mo({ MEN: 0.5 })) },
    "6.2": { lot: "L6", d: "Porte isoplane 80×220, y compris cadre et quincaillerie", u: "u", c: cat([["PB80", 1]], mo({ MEN: 0.5 })) },
    "6.3": { lot: "L6", d: "Porte d'entrée en bois massif 160×220", u: "u", c: cat([["PE160", 1]], mo({ MEN: 1 })) },

    "7.1": { lot: "L7", d: "Fenêtre en aluminium vitrée 120×120", u: "u", c: cat([["FA120", 1]], mo({ MEN: 0.4 })) },
    "7.2": { lot: "L7", d: "Fenêtre en aluminium vitrée 150×120", u: "u", c: cat([["FA150", 1]], mo({ MEN: 0.4 })) },
    "7.3": { lot: "L7", d: "Fenêtre d'aération en aluminium 60×60", u: "u", c: cat([["FA60", 1]], mo({ MEN: 0.2 })) },
    "7.4": { lot: "L7", d: "Porte-fenêtre en aluminium 200×220", u: "u", c: cat([["PFA", 1]], mo({ MEN: 0.6 })) },
    "7.5": { lot: "L7", d: "Porte métallique 100×220", u: "u", c: cat([["PM", 1]], mo({ MEN: 0.5 })) },
    "7.6": { lot: "L7", d: "Grille de protection (anti-vol) sur fenêtres", u: "m²", c: cat([["GRI", 1]], mo({ MEN: 0.3 })) },
    "7.7": { lot: "L7", d: "Garde-corps métallique", u: "ml", c: cat([["GC", 1]], mo({ MEN: 0.3 })) },

    "8.1": { lot: "L8", d: "Carrelage grès cérame au sol, y compris mortier de pose", u: "m²", c: cat([["CAR", 1]], mortier(300, 0.03), mo({ CARR: 0.15, MAN: 0.08 })) },
    "8.2": { lot: "L8", d: "Carrelage extérieur antidérapant (terrasses, balcons)", u: "m²", c: cat([["CARX", 1]], mortier(300, 0.03), mo({ CARR: 0.15, MAN: 0.08 })) },
    "8.3": { lot: "L8", d: "Faïence murale (salles d'eau, cuisine)", u: "m²", c: cat([["FAI", 1]], mortier(350, 0.012), mo({ CARR: 0.2, MAN: 0.05 })) },
    "8.4": { lot: "L8", d: "Plinthes céramique", u: "ml", c: cat([["PLI", 1]], mo({ CARR: 0.04 })) },
    "8.5": { lot: "L8", d: "Revêtement des marches d'escalier (marche + contremarche)", u: "u", c: cat([["CAR", 0.45], ["PLI", 1]], mortier(300, 0.015), mo({ CARR: 0.25 })) },

    "9.1": { lot: "L9", d: "WC à l'anglaise complet", u: "u", c: cat([["WC", 1]], mo({ PLOM: 0.5 })) },
    "9.2": { lot: "L9", d: "Lavabo complet, y compris robinetterie", u: "u", c: cat([["LAV", 1]], mo({ PLOM: 0.4 })) },
    "9.3": { lot: "L9", d: "Douche complète (receveur, siphon, colonne, mitigeur)", u: "u", c: cat([["DOU", 1]], mo({ PLOM: 0.5 })) },
    "9.4": { lot: "L9", d: "Évier de cuisine 2 bacs, y compris robinetterie", u: "u", c: cat([["EVI", 1]], mo({ PLOM: 0.4 })) },
    "9.5": { lot: "L9", d: "Bac à laver", u: "u", c: cat([["BAC", 1]], mo({ PLOM: 0.3 })) },
    "9.6": { lot: "L9", d: "Chauffe-eau électrique 50 L", u: "u", c: cat([["CE", 1]], mo({ PLOM: 0.4 })) },
    "9.7": { lot: "L9", d: "Réseau d'alimentation eau froide (par point d'eau)", u: "pt", c: cat([["RESA", 1]], mo({ PLOM: 0.3, MAN: 0.1 })) },
    "9.8": { lot: "L9", d: "Réseau d'évacuation EU/EV en PVC (par point)", u: "pt", c: cat([["RESE", 1]], mo({ PLOM: 0.3, MAN: 0.15 })) },

    "10.1": { lot: "L10", d: "Point lumineux complet (câblage, boîte, luminaire LED)", u: "u", c: cat([["PL", 1]], mo({ ELEC: 0.25 })) },
    "10.2": { lot: "L10", d: "Prise de courant 2P+T 16 A, y compris câblage", u: "u", c: cat([["PC", 1]], mo({ ELEC: 0.2 })) },
    "10.3": { lot: "L10", d: "Interrupteur simple allumage", u: "u", c: cat([["INT", 1]], mo({ ELEC: 0.1 })) },
    "10.4": { lot: "L10", d: "Interrupteur va-et-vient", u: "u", c: cat([["IVV", 1]], mo({ ELEC: 0.15 })) },
    "10.5": { lot: "L10", d: "Tableau de répartition équipé", u: "ens", c: cat([["TAB", 1]], mo({ ELEC: 1.5 })) },
    "10.6": { lot: "L10", d: "Mise à la terre", u: "ens", c: cat([["TER", 1]], mo({ ELEC: 0.5, MAN: 0.5 })) },
    "10.7": { lot: "L10", d: "Coffret de branchement / compteur", u: "ens", c: cat([["BRAN", 1]], mo({ ELEC: 1 })) },

    "11.1": { lot: "L11", d: "Peinture intérieure sur murs (impression + 2 couches)", u: "m²", c: cat([["PEI_INT", 1]], mo({ PEIN: 0.06 })) },
    "11.2": { lot: "L11", d: "Peinture sous plafond (impression + 2 couches)", u: "m²", c: cat([["PEI_INT", 1]], mo({ PEIN: 0.08 })) },
    "11.3": { lot: "L11", d: "Peinture extérieure (impression + 2 couches)", u: "m²", c: cat([["PEI_EXT", 1]], mo({ PEIN: 0.07 })) },
    "11.4": { lot: "L11", d: "Peinture glycéro sur ouvrages métalliques", u: "m²", c: cat([["PEI_GLY", 1]], mo({ PEIN: 0.1 })) },
    "11.5": { lot: "L11", d: "Vernis sur portes bois (2 faces)", u: "m²", c: cat([["VERN", 1]], mo({ PEIN: 0.1 })) },

    "12.1": { lot: "L12", d: "Fosse septique et puisard (par m³ utile)", u: "m³", c: cat([["FOS", 1]], mo({ MAC: 2, MAN: 4 })) },
    "12.2": { lot: "L12", d: "Regard de visite 40×40 avec tampon", u: "u", c: cat([["REG", 1]], mortier(300, 0.02), mo({ MAC: 0.3, MAN: 0.3 })) },
    "12.3": { lot: "L12", d: "Mur de clôture en agglos de 15 (h 2,50 m), y compris fondation et raidisseurs", u: "ml", c: cat([["AG15", 31]], mortier(300, 0.05), beton(350, 0.12), acier(10, { HA6: 0.3, HA10: 0.7 }), mo({ MAC: 0.5, MAN: 0.6 })) }
  };

  // ---------- Types de pièces : équipements par pièce
  // sol: "int" | "ext" ; fai: "sdb" | "cui" | null ; lum, pc (prises), int, vv (va-et-vient), wc, lav, dou, evi, bac
  var PIECES = {
    "Chambre": { sol: "int", lum: 1, pc: 3, int: 1 },
    "Séjour / salon": { sol: "int", lum: 2, pc: 5, int: 2 },
    "Salle à manger": { sol: "int", lum: 1, pc: 2, int: 1 },
    "Cuisine": { sol: "int", fai: "cui", lum: 1, pc: 4, int: 1, evi: 1 },
    "Salle de bain / douche": { sol: "int", fai: "sdb", lum: 1, pc: 1, int: 1, wc: 1, lav: 1, dou: 1 },
    "WC visiteurs": { sol: "int", fai: "sdb", lum: 1, int: 1, wc: 1, lav: 1 },
    "Hall / couloir": { sol: "int", lum: 1, pc: 1, vv: 2 },
    "Bureau": { sol: "int", lum: 1, pc: 4, int: 1 },
    "Buanderie / magasin": { sol: "int", lum: 1, pc: 1, int: 1, bac: 1 },
    "Terrasse / balcon": { sol: "ext", lum: 1, pc: 1, int: 1 },
    "Garage": { sol: "int", lum: 1, pc: 1, int: 1 }
  };

  // ---------- Menuiseries : code -> {ouv (code ouvrage), d, L, H, pos: "ext"|"int", bois, metal}
  var MENU = {
    "PE160": { ouv: "6.3", d: "Porte d'entrée bois 160×220", L: 1.6, H: 2.2, pos: "ext", bois: true },
    "PB90": { ouv: "6.1", d: "Porte isoplane 90×220", L: 0.9, H: 2.2, pos: "int", bois: true },
    "PB80": { ouv: "6.2", d: "Porte isoplane 80×220", L: 0.8, H: 2.2, pos: "int", bois: true },
    "FA150": { ouv: "7.2", d: "Fenêtre alu 150×120", L: 1.5, H: 1.2, pos: "ext", fen: true },
    "FA120": { ouv: "7.1", d: "Fenêtre alu 120×120", L: 1.2, H: 1.2, pos: "ext", fen: true },
    "FA60": { ouv: "7.3", d: "Fenêtre d'aération alu 60×60", L: 0.6, H: 0.6, pos: "ext", fen: true },
    "PFA": { ouv: "7.4", d: "Porte-fenêtre alu 200×220", L: 2.0, H: 2.2, pos: "ext" },
    "PM": { ouv: "7.5", d: "Porte métallique 100×220", L: 1.0, H: 2.2, pos: "ext", metal: true }
  };

  // ---------- Régions : coefficient appliqué au prix des matériaux (base Dakar)
  // ANSD T2-2026 (prix du ciment) pour Dakar, Diourbel, Kaolack, Kolda, Saint-Louis ; autres = estimations.
  var REGIONS = {
    "Dakar": [1.00, "ANSD"], "Thiès": [1.02, "estimé"], "Diourbel": [1.04, "ANSD"], "Fatick": [1.03, "estimé"],
    "Kaolack": [1.02, "ANSD"], "Kaffrine": [1.04, "estimé"], "Louga": [1.05, "estimé"], "Saint-Louis": [1.06, "ANSD"],
    "Matam": [1.10, "estimé"], "Tambacounda": [1.10, "estimé"], "Kédougou": [1.14, "estimé"], "Kolda": [1.11, "ANSD"],
    "Sédhiou": [1.11, "estimé"], "Ziguinchor": [1.10, "estimé"]
  };

  // Acier : masse linéique (kg/m)
  var KGM = { HA6: 0.222, HA8: 0.395, HA10: 0.617, HA12: 0.888, HA14: 1.208, HA16: 1.578 };

  // ---------- Projet exemple : villa R+1 (fictive)
  function exemple() {
    return {
      id: "p" + Date.now(),
      info: { nom: "Villa R+1 – exemple", client: "Client exemple (diaspora)", tel: "+221 77 000 00 00", adresse: "Cité Keur Gorgui", ville: "Thiès", region: "Thiès", date: new Date().toISOString().slice(0, 10), type: "Villa R+1", description: "Villa individuelle R+1, structure poteaux-poutres en béton armé, remplissage en agglos, toiture-terrasse.", dateLivraison: "" },
      fond: {
        profFouille: 1.0, surlarg: 0.2, epBP: 0.05, debordBP: 0.05, surelev: 0.4,
        semelles: [{ nom: "S1", nb: 12, L: 1.0, l: 1.0, h: 0.35 }, { nom: "S2", nb: 4, L: 1.2, l: 1.2, h: 0.4 }],
        filante: { L: 0, b: 0.5, h: 0.25 },
        amorces: { nb: 16, a: 0.2, b: 0.2 },
        longrines: { L: 64, b: 0.2, h: 0.3 },
        soub: { L: 64, h: 0.9 },
        dallage: { S: 125, ep: 0.1, treillis: true, antiTermite: true },
        emprise: 135
      },
      niveaux: [
        {
          nom: "RDC", hsp: 3.0, h: 3.2, S: 130, Lext: 46, extType: "3.2", Lclo: 38, cloType: "3.3",
          pot: { nb: 16, a: 0.2, b: 0.2 }, pout: { L: 60, b: 0.2, h: 0.35 }, chain: { L: 40, b: 0.15, h: 0.2 },
          plancher: "3.7", epDalle: 0.15, escalier: 1.6,
          pieces: [["Séjour / salon", 1, 30], ["Cuisine", 1, 10], ["Chambre", 1, 13], ["Salle de bain / douche", 1, 5], ["WC visiteurs", 1, 2.5], ["Hall / couloir", 1, 12], ["Terrasse / balcon", 1, 15]],
          menu: [["PE160", 1], ["PB90", 3], ["PB80", 2], ["FA150", 3], ["FA120", 2], ["FA60", 2]]
        },
        {
          nom: "R+1", hsp: 3.0, h: 3.2, S: 130, Lext: 46, extType: "3.2", Lclo: 42, cloType: "3.3",
          pot: { nb: 16, a: 0.2, b: 0.2 }, pout: { L: 60, b: 0.2, h: 0.35 }, chain: { L: 40, b: 0.15, h: 0.2 },
          plancher: "3.7", epDalle: 0.15, escalier: 1.2,
          pieces: [["Chambre", 3, 13], ["Salle de bain / douche", 3, 5], ["Hall / couloir", 1, 12], ["Terrasse / balcon", 1, 8]],
          menu: [["PB90", 3], ["PB80", 3], ["FA150", 3], ["FA120", 3], ["FA60", 3], ["PFA", 1]]
        }
      ],
      toit: { acroH: 0.6, etancheite: true, formePente: true },
      opt: { grilles: true, gardeCorps: 8, fosseM3: 0, chauffeEau: 2, clotureL: 0, faiSdb: 2.0, faiCui: 0.6, regards: 3, branchement: true, installPct: 2 },
      overrides: {},  // code-ligne -> {q: quantité forcée, pu: prix forcé}
      created: new Date().toISOString()
    };
  }

  function projetVide() {
    var p = exemple();
    p.id = "p" + Date.now();
    p.info = { nom: "Nouveau projet", client: "", tel: "", adresse: "", ville: "", region: "Dakar", date: new Date().toISOString().slice(0, 10), type: "", description: "", dateLivraison: "" };
    p.fond.semelles = [{ nom: "S1", nb: 0, L: 1.0, l: 1.0, h: 0.35 }];
    p.fond.amorces.nb = 0; p.fond.longrines.L = 0; p.fond.soub.L = 0; p.fond.dallage.S = 0; p.fond.emprise = 0;
    p.niveaux = [{ nom: "RDC", hsp: 3.0, h: 3.2, S: 0, Lext: 0, extType: "3.2", Lclo: 0, cloType: "3.3", pot: { nb: 0, a: 0.2, b: 0.2 }, pout: { L: 0, b: 0.2, h: 0.35 }, chain: { L: 0, b: 0.15, h: 0.2 }, plancher: "3.7", epDalle: 0.15, escalier: 0, pieces: [], menu: [] }];
    p.opt.gardeCorps = 0; p.opt.chauffeEau = 0; p.opt.regards = 0;
    p.overrides = {};
    return p;
  }

  var ENTREPRISE = {
    nom: "2AM CONSTRUCTION", slogan: "Bâtir aujourd'hui · Construire demain — Concevoir, construire, valoriser", adresse: "Sénégal",
    tel: "+33 6 49 99 49 78", email: "", ninea: "", rccm: "", logo: (typeof LOGO_2AM !== "undefined" ? LOGO_2AM : ""),
    responsable: "Malick DIALLO", fonction: "Ingénieur en génie civil",
    tva: 18, fc: 8, fg: 10, aleas: 3, benef: 10, validite: 30, acompte: 40,
    camionSable: 16, camionGravier: 8, retenue: 5, delaiPaiement: 30, factuSeq: 0,
    paiementInfo: "Paiement par virement bancaire, Wave ou Orange Money.",
    capacite: { MAC: 8, FER: 4, COFR: 4, MAN: 12, CARR: 4, PEIN: 4, PLOM: 2, ELEC: 2, MEN: 2, ETANC: 2 },
    conditions: "Prix fermes pendant la durée de validité du devis. Paiement : acompte à la commande, puis situations mensuelles selon l'avancement des travaux. Les travaux non prévus au présent devis feront l'objet d'un avenant."
  };

  return { RES: RES, OUV: OUV, LOTS: LOTS, PIECES: PIECES, MENU: MENU, REGIONS: REGIONS, KGM: KGM, ENTREPRISE: ENTREPRISE, exemple: exemple, projetVide: projetVide };
})();
if (typeof module !== "undefined") module.exports = DATA;
