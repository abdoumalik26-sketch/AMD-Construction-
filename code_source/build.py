"""Assemble l'application en un seul fichier HTML autonome (fonctionne hors connexion)."""
import os
R = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(R, p), encoding="utf-8").read()
html = rd("src/index.tpl.html")
parts = {
    "/*JSPDF*/": rd("vendor/jspdf-2.5.2/package/dist/jspdf.umd.min.js"),
    "/*AUTOTABLE*/": rd("vendor/jspdf-autotable-3.8.4/package/dist/jspdf.plugin.autotable.min.js"),
    "/*LOGO*/": rd("src/logo.js"),
    "/*DATA*/": rd("src/data.js"),
    "/*CALC*/": rd("src/calc.js"),
    "/*PLAN*/": rd("src/plan.js"),
    "/*APP*/": rd("src/app.js"),
    "/*MODULES*/": rd("src/modules.js"),
    "/*TYPES*/": rd("src/types.js"),
    "/*PILOTAGE*/": rd("src/pilotage.js"),
    "/*SECURITE*/": rd("src/securite.js"),
    "/*XLSX*/": rd("vendor/xlsx/package/dist/xlsx.mini.min.js"),
    "/*OUTILS*/": rd("src/outils.js"),
    "/*SUPABASE*/": rd("vendor/sb/package/dist/umd/supabase.js"),
    "/*SYNC*/": rd("src/sync.js"),
}
for k, v in parts.items():
    html = html.replace(k, v.replace("</script>", "<\\/script>"), 1)
os.makedirs(os.path.join(R, "dist"), exist_ok=True)
out = os.path.join(R, "dist", "pilote_btp.html")
open(out, "w", encoding="utf-8").write(html)
print("OK", out, round(len(html) / 1024), "Ko")
