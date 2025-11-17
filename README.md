
Handwriter — versiune web (PWA-lite)
===================================

Acest pachet conține o aplicație web statică pregătită pentru GitHub Pages.
Deschide `index.html` în browser sau urcă conținutul în repository GitHub și activează Pages (branch `main` / `root`).

Pași simpli pentru publicare pe GitHub Pages:
1. Creează un repository nou pe GitHub numit `handwriter` (sau alt nume).
2. În pagina repository-ului, apasă "Add file" → "Upload files" și încarcă toate fișierele din acest pachet (index.html, app.js, style.css, README.md, assets/).
3. Mergi la Settings → Pages, selectează Branch `main` și `/root`, apasă Save.
4. După câteva minute, site-ul va fi live la: `https://<username>.github.io/<repo-name>/`

Utilizare pe iPhone:
- Deschide link-ul în Safari, acordă permisiunea pentru cameră când ți se cere.
- Apasă "Începe calibrare" și urmează instrucțiunile: pentru fiecare caracter, va trebui să faci 3 fotografii ale literei scrise.
- După calibrare, folosește "Scan" pentru a fotografia notițele tale; aplicația va genera textul estimat.
- În pagina Export, poți descărca un fișier `.docx` (conține text simplu).

Limitări:
- Aceasta este o versiune prototip — segmentarea caracterelor este heuristica și funcționează cel mai bine pentru text clar, scris la distanțe constante și litere separate.
- Exportul `.docx` conține text simplu; pentru generare .docx complexă (stiluri, diacritice avansate) se poate extinde cu server sau librărie dedicată.
- Datele rămân în LocalStorage (pe dispozitiv).
