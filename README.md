# Jagd-Strecke

Web-App zum Erfassen und Auswerten von Abschüssen – mehrere Projekte (aktuell **Kavelstorf** und **Gnoien**) mit getrennten Daten.

- **Website:** https://jjk-koe.github.io/Jagd-Tagebuch/ (GitHub Pages, liefert diesen Ordner direkt aus)
- **Datenbank & Login:** Firebase-Projekt `jagd-tagebuch` (Firestore + Authentication)
- **Automatischer Import:** Google Apps Script im Agent-Postfach (Kopie: `firebase/streckenliste-import.gs`)

## Aufbau

```
index.html              Seitengerüst (nur HTML)
css/style.css           Aussehen inkl. Dark Mode
img/icon.png            App-Symbol (Homescreen)
js/
  config.js             ★ Projekte, Reviere, Wildarten, Altersklassen – hier wird gepflegt
  daten.js              Firebase-Verbindung, Laden/Speichern/Löschen
  anmeldung.js          Login, Passwort vergessen, Abmelden
  saison.js             Jagdjahr (1.4.–31.3.) und Saisonauswahl
  formular.js           Erfassen + Bearbeiten (gemeinsame Pflichtfeld-Prüfung), Foto
  strecke.js            Liste mit Filtern
  statistik.js          Auswertungen
  export.js             CSV-Export für Excel
  oberflaeche.js        Helfer: Tabs, Meldungen, Foto-Ansicht, Neu-Hinweis
  main.js               Start, verbindet alles
firebase/
  firestore.rules       Datenbank-Regeln (in der Firebase-Konsole einfügen)
  streckenliste-import.gs  Import-Skript (Kopie, persönliche Angaben entfernt)
```

## Häufige Handgriffe

### Neue Person freischalten
1. Firebase-Konsole → **Authentication → Nutzer hinzufügen** (E-Mail + Startpasswort).
2. Firestore → Sammlung `users` → Dokument mit **ID = E-Mail (klein geschrieben)**,
   Feld `projekte` (Typ *array*) mit den Kennungen, z. B. `kavelstorf`, `gnoien`.
3. Die Person kann in der App über „Passwort vergessen?“ ein eigenes Passwort setzen.

### Neues Revier in einem bestehenden Projekt
In `js/config.js` beim Projekt unter `reviere` ergänzen. Fertig.

### Neues Projekt
1. In `js/config.js` unter `PROJEKTE` einen Eintrag mit eigenem `prefix` anlegen (z. B. `neu_`).
2. In `firebase/firestore.rules` zwei Zeilen für `neu_entries` und `neu_seasons` ergänzen
   und die Regeln in der Firebase-Konsole veröffentlichen.
3. Betroffenen Personen die Kennung in `users/{email}.projekte` eintragen.

### Änderungen veröffentlichen
Dateien ins Repository übernehmen (Commit auf `main`) – GitHub Pages aktualisiert
die Website nach 1–2 Minuten. Im Browser mit **Strg + Shift + R** neu laden.

## Hinweise
- Der Firebase-`apiKey` in `config.js` ist öffentlich und kein Geheimnis; geschützt wird über
  Login und Firestore-Regeln. Selbstregistrierung ist in Firebase deaktiviert.
- Kavelstorf nutzt aus historischen Gründen die Sammlungen `entries` / `seasons` ohne Vorsatz –
  diese Namen **nicht** ändern, sonst findet das Import-Skript die Daten nicht mehr.
- Fotos werden verkleinert direkt im Eintrag gespeichert.
