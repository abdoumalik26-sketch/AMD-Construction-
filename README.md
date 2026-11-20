# 2AM Construction — application de gestion BTP

**Bâtir aujourd'hui · Construire demain**

Application en ligne : https://abdoumalik26-sketch.github.io/AMD-Construction-/

Études de prix (métrés, sous-détails, DQE, BPU, devis), planning, OPC et anticipation, suivi terrain des collaborateurs, approvisionnements, facturation et trésorerie, mémoires techniques. Fonctionne hors connexion une fois installée et se met à jour automatiquement.

- Les données de chantier restent sur chaque appareil (navigateur) : elles ne sont jamais envoyées sur GitHub.
- `index.html` : l'application publiée (générée).
- `code_source/` : le code source. Reconstruire avec `python code_source/build.py`, puis copier `code_source/dist/pilote_btp.html` vers `index.html`.
