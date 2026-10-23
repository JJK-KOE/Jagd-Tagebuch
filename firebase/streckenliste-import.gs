/**
 * Streckenliste -> Jagd App (Firestore) – automatischer Import
 * Läuft als Google Apps Script im Agent-Gmail-Konto.
 * KOPIE zur Dokumentation – die aktive Version liegt in Apps Script (script.google.com).
 *
 * Ablauf:
 *  1. Sucht Mails mit Label "Quelle/Jagd" UND "Status/Offen"
 *  2. Liest alle Excel-Anhänge (alle Tabellenblätter)
 *  3. Gleicht über die Wildmarkennummer mit der App ab
 *  4. Schreibt nur fehlende Einträge in Firestore
 *  5. Setzt Label "Status/Erledigt" (bei Fehler bleibt "Status/Offen")
 *  6. Schickt eine kurze Zusammenfassung
 */

// ───────────── EINSTELLUNGEN ─────────────
const CONFIG = {
  DRY_RUN: true,                       // true = nur testen, nichts schreiben. Nach erfolgreichem Test auf false setzen.
  REVIER: 'Jahning',                   // Revier für alle importierten Einträge
  ERLEGER: 'NAME DES UNTERPÄCHTERS',   // im echten Skript eingetragen (steht nicht in der Excel)
  SUMMARY_TO: 'EMPFAENGER@BEISPIEL.DE',     // im echten Skript (Apps Script) steht hier die eigene Adresse
  LABEL_QUELLE: 'Quelle/Jagd',
  LABEL_OFFEN: 'Status/Offen',
  LABEL_ERLEDIGT: 'Status/Erledigt',
  FIREBASE_PROJECT: 'jagd-tagebuch',
  FIREBASE_API_KEY: 'AIzaSyDjpox0VLVHz0ztv7IsCuCxp9fgqXTQQTo',
  ERLAUBTE_WILDARTEN: ['Schwarzwild', 'Rotwild', 'Rehwild'],
};
// ─────────────────────────────────────────

const FS_BASE = 'https://firestore.googleapis.com/v1/projects/' + CONFIG.FIREBASE_PROJECT +
                '/databases/(default)/documents';

function importStreckenliste() {
  const query = 'label:' + slug_(CONFIG.LABEL_QUELLE) + ' label:' + slug_(CONFIG.LABEL_OFFEN);
  const threads = GmailApp.search(query);
  if (threads.length === 0) { Logger.log('Nichts zu tun.'); return; }

  const labelOffen = GmailApp.getUserLabelByName(CONFIG.LABEL_OFFEN);
  const labelErledigt = GmailApp.getUserLabelByName(CONFIG.LABEL_ERLEDIGT) ||
                        GmailApp.createLabel(CONFIG.LABEL_ERLEDIGT);

  const letzterImport = letzterImport_(threads);  // Zeitpunkt des vorigen Imports (ISO) oder null
  const eintraege = ladeEintraege_();             // alle Einträge der App (ohne Fotos)
  const vorhanden = new Set(eintraege.map(e => e.marke));
  const bericht = [];

  threads.forEach(thread => {
    const betreff = thread.getFirstMessageSubject();
    const r = { betreff, neu: [], vorhanden: 0, uebersprungen: [], fehler: [], zeilen: [] };
    try {
      const zeilen = [];
      thread.getMessages().forEach(msg => {
        msg.getAttachments().forEach(att => {
          if (/\.xlsx?$/i.test(att.getName())) zeilen.push(...leseExcel_(att));
        });
      });
      if (zeilen.length === 0) throw new Error('Kein Excel-Anhang mit Daten gefunden.');
      r.zeilen = zeilen;

      zeilen.forEach(z => {
        const check = pruefeZeile_(z);
        if (check) { r.uebersprungen.push(z.marke + ': ' + check); return; }
        if (vorhanden.has(z.marke)) { r.vorhanden++; return; }
        if (!CONFIG.DRY_RUN) schreibeEintrag_(z);
        vorhanden.add(z.marke);
        r.neu.push(z);
        eintraege.push(Object.assign({}, z, { revier: CONFIG.REVIER, erleger: CONFIG.ERLEGER, neu: true,
                                              erstellt: new Date().toISOString() }));
      });

      if (!CONFIG.DRY_RUN) {
        thread.removeLabel(labelOffen);
        thread.addLabel(labelErledigt);
      }
    } catch (e) {
      r.fehler.push(String(e.message || e));
    }
    bericht.push(r);
  });

  sendeBericht_(bericht, eintraege, letzterImport);

  // Zeitpunkt merken, wenn wirklich importiert wurde und kein Fehler auftrat
  if (!CONFIG.DRY_RUN && bericht.every(r => !r.fehler.length)) {
    PropertiesService.getScriptProperties().setProperty('LETZTER_IMPORT', new Date().toISOString());
  }
}

// Zeitpunkt des letzten Imports: gespeicherter Wert, sonst Datum der zuletzt
// erledigten Streckenlisten-Mail (für den ersten Lauf mit dieser Version)
function letzterImport_(aktuelleThreads) {
  const p = PropertiesService.getScriptProperties().getProperty('LETZTER_IMPORT');
  if (p) return p;
  const ids = new Set(aktuelleThreads.map(t => t.getId()));
  const erledigt = GmailApp.search('label:' + slug_(CONFIG.LABEL_QUELLE) + ' label:' + slug_(CONFIG.LABEL_ERLEDIGT))
                           .filter(t => !ids.has(t.getId()));
  if (!erledigt.length) return null;
  const d = erledigt.map(t => t.getLastMessageDate()).sort((a, b) => b - a)[0];
  return d.toISOString();
}

// ── Excel lesen (direkt aus der .xlsx, keine Zusatzdienste nötig) ──
function leseExcel_(blob) {
  const b = blob.copyBlob();
  b.setContentType('application/zip');
  const teile = {};
  Utilities.unzip(b).forEach(f => teile[f.getName()] = f.getDataAsString('UTF-8'));
  return parseXlsxTeile_(teile);
}

function parseXlsxTeile_(teile) {
  const ergebnis = [];
  const shared = [];
  const ss = teile['xl/sharedStrings.xml'] || '';
  (ss.match(/<si>[\s\S]*?<\/si>/g) || []).forEach(si => {
    shared.push((si.match(/<t[^>]*>[\s\S]*?<\/t>/g) || [])
      .map(t => xmlDecode_(t.replace(/<[^>]+>/g, ''))).join(''));
  });
  Object.keys(teile).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort().forEach(n => {
    const werte = sheetZuTabelle_(teile[n], shared);
    {
      // Kopfzeile suchen (Zeile, die "Wildmarke" enthält)
      const kopfIdx = werte.findIndex(row => row.some(c => String(c).trim() === 'Wildmarke'));
      if (kopfIdx < 0) return;
      const kopf = werte[kopfIdx].map(c => String(c).trim());
      const col = name => kopf.findIndex(h => h.toLowerCase().startsWith(name.toLowerCase()));
      const c = {
        marke: col('Wildmarke'), wildart: col('Wildart'), ak: col('AK'),
        geschlecht: col('Geschlecht'), ursache: col('Todesursache'),
        gewicht: col('Gewicht'), datum: col('Datum'),
      };
      for (let i = kopfIdx + 1; i < werte.length; i++) {
        const row = werte[i];
        if (row[c.marke] === '' || row[c.marke] === null) continue;   // leere Zeile
        ergebnis.push({
          marke: String(row[c.marke]).replace(/\D/g, '').padStart(7, '0'),
          wildart: String(row[c.wildart]).trim(),
          ak: row[c.ak] === '' ? '' : String(row[c.ak]),
          geschlecht: grossAnfang_(String(row[c.geschlecht]).trim()),
          gewicht: row[c.gewicht] === '' ? '' : String(row[c.gewicht]),
          datum: excelDatum_(row[c.datum]),
          ursache: c.ursache >= 0 ? String(row[c.ursache]).trim() : '',
        });
      }
    }
  });
  return ergebnis;
}

// Wandelt ein Tabellenblatt-XML in ein 2D-Array um
function sheetZuTabelle_(xml, shared) {
  const tabelle = [];
  const re = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const spalte = m[1].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const zeile = parseInt(m[2], 10) - 1;
    const attr = m[3] || '', inhalt = m[4] || '';
    const typ = (attr.match(/t="(\w+)"/) || [])[1];
    const v = (inhalt.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    let wert = '';
    if (typ === 's' && v !== undefined) wert = shared[parseInt(v, 10)];
    else if (typ === 'inlineStr') wert = xmlDecode_((inhalt.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '');
    else if (typ === 'str') wert = xmlDecode_(v || '');
    else if (v !== undefined) wert = Number(v);
    while (tabelle.length <= zeile) tabelle.push([]);
    while (tabelle[zeile].length <= spalte) tabelle[zeile].push('');
    tabelle[zeile][spalte] = wert;
  }
  return tabelle;
}

// Excel-Datum (Seriennummer) oder Text "TT.MM.JJJJ" -> "JJJJ-MM-TT"
function excelDatum_(w) {
  if (typeof w === 'number' && w > 20000) {
    const d = new Date(Math.round((w - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const t = String(w || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return t ? t[3] + '-' + t[2].padStart(2, '0') + '-' + t[1].padStart(2, '0') : '';
}

function xmlDecode_(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function pruefeZeile_(z) {
  if (z.marke.length !== 7) return 'Wildmarke nicht 7-stellig';
  if (!CONFIG.ERLAUBTE_WILDARTEN.includes(z.wildart)) return 'Wildart "' + z.wildart + '" nicht in der App';
  if (!['Männlich', 'Weiblich'].includes(z.geschlecht)) return 'Geschlecht fehlt/unklar';
  if (!/^[0-4]$/.test(z.ak)) return 'AK fehlt/unklar';
  if (!z.datum) return 'Datum fehlt';
  return null;
}

// ── Anmeldung bei Firebase ──
// Zugangsdaten stehen NICHT im Code, sondern unter
// Projekteinstellungen (Zahnrad) → Skripteigenschaften: AGENT_EMAIL und AGENT_PASSWORD
let _idToken = null;
function authHeader_() {
  if (_idToken) return { Authorization: 'Bearer ' + _idToken };
  const props = PropertiesService.getScriptProperties();
  const email = props.getProperty('AGENT_EMAIL'), pw = props.getProperty('AGENT_PASSWORD');
  if (!email || !pw) throw new Error('Skripteigenschaften AGENT_EMAIL / AGENT_PASSWORD fehlen.');
  const res = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + CONFIG.FIREBASE_API_KEY,
    { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ email: email, password: pw, returnSecureToken: true }) });
  const data = JSON.parse(res.getContentText());
  if (!data.idToken) throw new Error('Firebase-Anmeldung fehlgeschlagen: ' + ((data.error && data.error.message) || res.getResponseCode()));
  _idToken = data.idToken;
  return { Authorization: 'Bearer ' + _idToken };
}

// Zum Testen der Anmeldung einmal manuell ausführen
function testeAnmeldung() {
  authHeader_();
  const n = ladeEintraege_().length;
  Logger.log('Anmeldung OK – ' + n + ' Einträge in der App gelesen.');
}

// ── Firestore ──
function ladeEintraege_() {
  const felder = ['marke', 'wildart', 'geschlecht', 'ak', 'gewicht', 'datum', 'revier', 'erleger'];
  const maske = felder.map(f => '&mask.fieldPaths=' + f).join('');
  const liste = [];
  let token = '';
  do {
    const url = FS_BASE + '/entries?pageSize=300' + maske + '&key=' + CONFIG.FIREBASE_API_KEY +
                (token ? '&pageToken=' + encodeURIComponent(token) : '');
    const res = JSON.parse(UrlFetchApp.fetch(url, { headers: authHeader_() }).getContentText());
    (res.documents || []).forEach(d => {
      const e = {};
      felder.forEach(f => {
        const v = d.fields && d.fields[f];
        e[f] = v ? String(v.stringValue !== undefined ? v.stringValue
                 : v.integerValue !== undefined ? v.integerValue
                 : v.doubleValue !== undefined ? v.doubleValue : '') : '';
      });
      e.erstellt = d.createTime || '';   // wann der Eintrag in der App angelegt wurde
      liste.push(e);
    });
    token = res.nextPageToken || '';
  } while (token);
  return liste;
}

// Ermittelt den Meldemonat: aus dem Betreff ("... Monat September 2026"),
// sonst der späteste Monat in der Excel-Liste. Ergebnis "JJJJ-MM".
function meldemonat_(r) {
  const namen = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli',
                 'august', 'september', 'oktober', 'november', 'dezember'];
  const m = r.betreff.toLowerCase().replace('maerz', 'märz')
             .match(/(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+(\d{4})/);
  if (m) return m[2] + '-' + String(namen.indexOf(m[1]) + 1).padStart(2, '0');
  const daten = r.zeilen.map(z => z.datum).filter(Boolean).sort();
  return daten.length ? daten[daten.length - 1].slice(0, 7) : '';
}

function monatsuebersicht_(monat, eintraege) {
  const namen = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
                 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const titel = namen[parseInt(monat.slice(5, 7), 10) - 1] + ' ' + monat.slice(0, 4);
  const liste = eintraege.filter(e => (e.datum || '').slice(0, 7) === monat);
  return eintragsliste_('Gesamtstrecke ' + titel + ' laut App', liste);
}

// Einträge, die seit dem letzten Import angelegt wurden und NICHT im Meldemonat liegen
// (im aktuellen Lauf importierte stehen schon oben unter "Neu importiert")
function nacheintraege_(monat, eintraege, letzterImport) {
  if (!letzterImport) {
    return '  ── Nacheinträge seit letztem Import ──\n    (ab dem nächsten Import verfügbar)\n';
  }
  const seit = Utilities.formatDate(new Date(letzterImport), 'Europe/Berlin', 'dd.MM.yyyy HH:mm');
  const liste = eintraege.filter(e => !e.neu && e.erstellt && e.erstellt > letzterImport &&
                                      (e.datum || '').slice(0, 7) !== monat);
  return eintragsliste_('Nacheinträge seit letztem Import (' + seit + ')', liste);
}

function eintragsliste_(titel, liste) {
  liste = liste.slice().sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
  let t = '  ── ' + titel + ' (' + liste.length + ' Stück) ──\n';
  if (!liste.length) return t + '    keine Einträge\n';
  const reviere = [...new Set(liste.map(e => e.revier || '–'))].sort();
  reviere.forEach(rv => {
    const teil = liste.filter(e => (e.revier || '–') === rv);
    t += '  📍 ' + rv + ' (' + teil.length + ')\n';
    teil.forEach(e => {
      const d = e.datum.split('-').reverse().join('.');
      t += '    ' + (e.neu ? '[NEU] ' : '      ') + d + '  ' + e.wildart + '  ' + e.geschlecht +
           '  AK ' + e.ak + '  ' + e.gewicht + ' kg  ' + e.marke + '  ' + (e.erleger || '') + '\n';
    });
  });
  const proArt = {};
  liste.forEach(e => proArt[e.wildart] = (proArt[e.wildart] || 0) + 1);
  t += '  Summe: ' + Object.keys(proArt).sort().map(a => a + ' ' + proArt[a]).join(', ') + '\n';
  return t;
}

function schreibeEintrag_(z) {
  const anmerkung = 'Import Streckenliste' + (z.ursache && z.ursache !== 'Erlegung' ? ' – ' + z.ursache : '');
  const s = v => ({ stringValue: v });
  const body = {
    fields: {
      id: { integerValue: String(Date.now()) },
      wildart: s(z.wildart), marke: s(z.marke), geschlecht: s(z.geschlecht),
      gewicht: s(z.gewicht), ak: s(z.ak), revier: s(CONFIG.REVIER),
      erleger: s(CONFIG.ERLEGER), datum: s(z.datum), anmerkung: s(anmerkung),
      photo: { nullValue: null },
    },
  };
  UrlFetchApp.fetch(FS_BASE + '/entries?key=' + CONFIG.FIREBASE_API_KEY, {
    method: 'post', headers: authHeader_(), contentType: 'application/json', payload: JSON.stringify(body),
  });
  Utilities.sleep(5);   // sorgt für eindeutige id (Zeitstempel)
}

// ── Bericht ──
function sendeBericht_(bericht, eintraege, letzterImport) {
  const prefix = CONFIG.DRY_RUN ? '[TESTLAUF – nichts geschrieben] ' : '';
  let text = prefix + 'Streckenlisten-Import ' + Utilities.formatDate(new Date(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm') + '\n\n';
  bericht.forEach(r => {
    text += '■ ' + r.betreff + '\n';
    text += '  Neu importiert: ' + r.neu.length + '\n';
    r.neu.forEach(z => text += '    + ' + z.marke + '  ' + z.wildart + '  ' + z.geschlecht + '  AK ' + z.ak + '  ' + z.gewicht + ' kg  ' + z.datum + '\n');
    text += '  Bereits vorhanden: ' + r.vorhanden + '\n';
    if (r.uebersprungen.length) text += '  Übersprungen:\n' + r.uebersprungen.map(u => '    – ' + u).join('\n') + '\n';
    if (r.fehler.length) text += '  FEHLER (Mail bleibt auf Status/Offen):\n' + r.fehler.map(f => '    ! ' + f).join('\n') + '\n';
    const monat = r.fehler.length ? '' : meldemonat_(r);
    if (monat) {
      text += '\n' + monatsuebersicht_(monat, eintraege);
      text += '\n' + nacheintraege_(monat, eintraege, letzterImport);
    }
    text += '\n';
  });
  const fehler = bericht.some(r => r.fehler.length);
  MailApp.sendEmail(CONFIG.SUMMARY_TO, prefix + (fehler ? '⚠ ' : '') + 'Streckenliste importiert', text);
}

// ── Hilfsfunktionen ──
function slug_(label) { return label.toLowerCase().replace(/[\/\s]/g, '-'); }
function grossAnfang_(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; }

// Einmal ausführen: richtet den täglichen Lauf um ca. 7 Uhr ein
function einrichtenTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('importStreckenliste').timeBased().everyDays(1).atHour(7).create();
}
