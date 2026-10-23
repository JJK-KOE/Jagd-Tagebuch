// ═══════════════════════════════════════════════════════════════
//  FORMULAR – Eintrag erfassen, bearbeiten und löschen
//  Beide Formulare teilen sich Auswahlwerte und Pflichtfeld-Prüfung.
// ═══════════════════════════════════════════════════════════════
import { PROJEKTE, WILDARTEN, GESCHLECHTER, ALTERSKLASSEN } from './config.js';
import { zustand, eintragAnlegen, eintragAendern, eintragLoeschen } from './daten.js';
import { $, esc, heute, eindeutig, optionenHTML, zeigeMeldung } from './oberflaeche.js';

const FELDER = ['wildart', 'marke', 'geschlecht', 'gewicht', 'ak', 'revier', 'erleger', 'datum', 'anmerkung'];
let fotoBase64 = null;     // Foto im Erfassen-Formular (verkleinert)
let bearbeiteDocId = null; // Eintrag, der gerade im Bearbeiten-Fenster offen ist

// ── Einrichten (einmal beim Start) ──────────────────────────────
export function formularEinrichten() {
  for (const p of ['', 'edit-']) {
    $(p + 'wildart').innerHTML = optionenHTML(WILDARTEN, 'Bitte wählen …');
    $(p + 'geschlecht').innerHTML = optionenHTML(GESCHLECHTER, '–');
    $(p + 'ak').innerHTML = optionenHTML(ALTERSKLASSEN, '–');
    // Wildmarke: nur Ziffern, max. 7
    $(p + 'marke').addEventListener('input', ev => {
      ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, 7);
      if (!p) $('marke-hint').textContent = ev.target.value.length + ' / 7 Ziffern';
    });
  }
  $('datum').value = heute();

  $('btn-speichern').addEventListener('click', speichern);
  $('photo-input').addEventListener('change', fotoGewaehlt);
  $('btn-foto-entfernen').addEventListener('click', fotoEntfernen);

  // Erleger-Vorschläge
  $('erleger').addEventListener('input', erlegerVorschlaege);
  $('erleger').addEventListener('focus', erlegerVorschlaege);
  $('erleger-suggestions').addEventListener('click', ev => {
    if (!ev.target.dataset.name) return;
    $('erleger').value = ev.target.dataset.name;
    $('erleger-suggestions').innerHTML = '';
  });

  // Bearbeiten-Fenster
  $('btn-aenderungen-speichern').addEventListener('click', aenderungenSpeichern);
  $('btn-loeschen').addEventListener('click', loeschen);
  $('btn-modal-schliessen').addEventListener('click', bearbeitenSchliessen);
  $('edit-modal').addEventListener('click', ev => { if (ev.target.id === 'edit-modal') bearbeitenSchliessen(); });
}

// Revier-Auswahl passend zum Projekt (ein einziges Revier wird vorausgewählt)
export function reviereSetzen() {
  const reviere = PROJEKTE[zustand.projekt].reviere;
  $('revier').innerHTML = optionenHTML(reviere, 'Bitte wählen …');
  $('edit-revier').innerHTML = optionenHTML(reviere);
  if (reviere.length === 1) $('revier').value = reviere[0];
}

// ── Gemeinsame Helfer ───────────────────────────────────────────
function liesFormular(prefix) {
  const d = {};
  FELDER.forEach(f => (d[f] = ($(prefix + f).value || '').trim()));
  return d;
}

// Gibt eine Fehlermeldung zurück oder null, wenn alles passt
function pruefe(d, eigeneDocId) {
  if (!d.wildart) return 'Bitte Wildart auswählen.';
  if (!d.marke) return 'Bitte Wildmarkennummer eingeben.';
  if (d.marke.length !== 7) return 'Wildmarkennummer muss genau 7 Ziffern haben.';
  if (!d.geschlecht) return 'Bitte Geschlecht auswählen.';
  if (!d.gewicht) return 'Bitte Gewicht eingeben.';
  if (!d.ak) return 'Bitte Altersklasse auswählen.';
  if (!d.revier) return 'Bitte Revier auswählen.';
  if (!d.erleger) return 'Bitte Erleger eingeben.';
  if (!d.datum) return 'Bitte Datum eingeben.';
  if (zustand.eintraege.some(e => e.marke === d.marke && e._docId !== eigeneDocId)) {
    return `Wildmarkennummer ${d.marke} ist bereits vorhanden!`;
  }
  return null;
}

// ── Erfassen ────────────────────────────────────────────────────
async function speichern() {
  const d = liesFormular('');
  const fehler = pruefe(d, null);
  if (fehler) return zeigeMeldung('error', fehler);

  const btn = $('btn-speichern');
  btn.disabled = true;
  try {
    await eintragAnlegen({ id: Date.now(), ...d, photo: fotoBase64 || null });
    formularLeeren();
    zeigeMeldung('success', '✓ Eintrag gespeichert!');
  } catch (e) {
    console.error(e);
    zeigeMeldung('error', 'Fehler: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

function formularLeeren() {
  ['wildart', 'geschlecht', 'ak', 'marke', 'gewicht', 'erleger', 'anmerkung'].forEach(f => ($(f).value = ''));
  reviereSetzen();
  $('datum').value = heute();
  $('marke-hint').textContent = '0 / 7 Ziffern';
  $('erleger-suggestions').innerHTML = '';
  fotoEntfernen();
}

function erlegerVorschlaege() {
  const suche = $('erleger').value.toLowerCase();
  const namen = eindeutig(zustand.eintraege, 'erleger').filter(n => n.toLowerCase().includes(suche));
  $('erleger-suggestions').innerHTML = namen
    .map(n => `<button type="button" class="erleger-pill" data-name="${esc(n)}">${esc(n)}</button>`).join('');
}

// Foto auf max. 800 px verkleinern, damit die Datenbank klein bleibt
function fotoGewaehlt(ev) {
  const datei = ev.target.files[0];
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 800, f = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * f);
      canvas.height = Math.round(img.height * f);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      fotoBase64 = canvas.toDataURL('image/jpeg', 0.65);
      $('photo-preview').src = fotoBase64;
      $('photo-preview-wrap').style.display = 'block';
      $('photo-upload-area').style.display = 'none';
    };
    img.src = e.target.result;
  };
  leser.readAsDataURL(datei);
}

function fotoEntfernen() {
  fotoBase64 = null;
  $('photo-input').value = '';
  $('photo-preview').removeAttribute('src');
  $('photo-preview-wrap').style.display = 'none';
  $('photo-upload-area').style.display = 'block';
}

// ── Bearbeiten & Löschen ────────────────────────────────────────
export function bearbeitenOeffnen(docId) {
  const e = zustand.eintraege.find(x => x._docId === docId);
  if (!e) return;
  bearbeiteDocId = docId;
  // Alte Einträge mit einem Revier, das nicht (mehr) in der Liste steht, nicht verlieren
  const rev = $('edit-revier');
  if (e.revier && ![...rev.options].some(o => o.value === e.revier)) {
    rev.insertAdjacentHTML('beforeend', optionenHTML([e.revier]));
  }
  FELDER.forEach(f => ($('edit-' + f).value = e[f] ?? ''));
  $('edit-modal').style.display = 'flex';
}

function bearbeitenSchliessen() {
  $('edit-modal').style.display = 'none';
  bearbeiteDocId = null;
}

async function aenderungenSpeichern() {
  if (!bearbeiteDocId) return;
  const d = liesFormular('edit-');
  const fehler = pruefe(d, bearbeiteDocId);
  if (fehler) return alert(fehler);

  const btn = $('btn-aenderungen-speichern');
  btn.disabled = true;
  btn.textContent = 'Speichert …';
  try {
    await eintragAendern(bearbeiteDocId, d);
    bearbeitenSchliessen();
    zeigeMeldung('success', '✓ Eintrag aktualisiert!');
  } catch (e) {
    alert('Fehler: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Änderungen speichern';
  }
}

async function loeschen() {
  if (!bearbeiteDocId) return;
  if (!confirm('Eintrag wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return;
  try {
    await eintragLoeschen(bearbeiteDocId);
    bearbeitenSchliessen();
  } catch (e) {
    alert('Fehler: ' + e.message);
  }
}
