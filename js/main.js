// ═══════════════════════════════════════════════════════════════
//  START – verbindet alle Teile der App
// ═══════════════════════════════════════════════════════════════
import { PROJEKTE } from './config.js';
import { zustand, datenAbonnieren, datenAbbestellen } from './daten.js';
import { anmeldungEinrichten } from './anmeldung.js';
import { saisonAuswahlAktualisieren, neueSaisonAnlegen } from './saison.js';
import { formularEinrichten, reviereSetzen } from './formular.js';
import { streckeEinrichten, filterAktualisieren, listeZeichnen } from './strecke.js';
import { statistikZeichnen } from './statistik.js';
import { exportEinrichten } from './export.js';
import {
  $, esc, setzeStatus, tabsEinrichten, neueEintraegePruefen, hinweisZuruecksetzen,
} from './oberflaeche.js';

// Alles neu zeichnen, was von den Daten abhängt
function allesZeichnen() {
  saisonAuswahlAktualisieren();
  filterAktualisieren();
  listeZeichnen();
  statistikZeichnen();
}

function projektWechseln(projekt) {
  if (!PROJEKTE[projekt]) return;
  zustand.projekt = projekt;
  zustand.eintraege = [];
  zustand.saisonsDb = [];
  zustand.saison = '';
  try { localStorage.setItem('jagd_projekt', projekt); } catch (e) { /* egal */ }

  const titel = PROJEKTE[projekt].titel;
  $('app-title').textContent = '🦌 ' + titel;
  document.title = titel;
  $('projekt-select').value = projekt;
  reviereSetzen();
  hinweisZuruecksetzen();
  allesZeichnen();

  datenAbonnieren(art => {
    allesZeichnen();
    if (art === 'eintraege') {
      setzeStatus(true);
      neueEintraegePruefen(zustand.projekt, zustand.eintraege);
    }
  }, err => {
    console.error(err);
    setzeStatus(false);
  });
}

// ── Einmalige Einrichtung ───────────────────────────────────────
formularEinrichten();
streckeEinrichten();
exportEinrichten();
tabsEinrichten(tab => {
  if (tab === 'liste') { filterAktualisieren(); listeZeichnen(); }
  if (tab === 'statistik') statistikZeichnen();
});
$('season-select').addEventListener('change', ev => {
  zustand.saison = ev.target.value;
  $('season-badge').textContent = zustand.saison;
  filterAktualisieren();
  listeZeichnen();
  statistikZeichnen();
});
$('btn-neue-saison').addEventListener('click', neueSaisonAnlegen);
$('projekt-select').addEventListener('change', ev => projektWechseln(ev.target.value));

anmeldungEinrichten({
  onAngemeldet(email, projekte) {
    $('user-info').textContent = email;
    $('logout-btn').hidden = false;
    // Anzeige "Kavelstorf", Wert "kavelstorf"
    $('projekt-select').innerHTML = projekte
      .map(p => `<option value="${esc(p)}">${esc(PROJEKTE[p].name)}</option>`).join('');
    $('projekt-bar').hidden = projekte.length < 2;
    let gemerkt = null;
    try { gemerkt = localStorage.getItem('jagd_projekt'); } catch (e) { /* egal */ }
    projektWechseln(projekte.includes(gemerkt) ? gemerkt : projekte[0]);
  },
  onAbgemeldet() {
    datenAbbestellen();
    $('user-info').textContent = '';
    $('logout-btn').hidden = true;
    $('projekt-bar').hidden = true;
    setzeStatus(false);
  },
});
