// ═══════════════════════════════════════════════════════════════
//  DATEN – Verbindung zu Firebase und gemeinsamer App-Zustand
//  Alle Lese- und Schreibzugriffe auf die Datenbank laufen über diese Datei.
// ═══════════════════════════════════════════════════════════════
import { FIREBASE_CONFIG, PROJEKTE } from './config.js';

firebase.initializeApp(FIREBASE_CONFIG);
export const db = firebase.firestore();
export const auth = firebase.auth();

// Offline-Speicher: App funktioniert auch ohne Netz und synchronisiert später
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

// Gemeinsamer Zustand, den alle Bereiche der App lesen
export const zustand = {
  projekt: null,     // aktueller Projekt-Schlüssel, z. B. "kavelstorf"
  eintraege: [],     // alle Abschüsse des Projekts (inkl. _docId)
  saisonsDb: [],     // manuell angelegte Saisons
  saison: '',        // gewählte Saison, z. B. "2026/2027"
};

// Sammlungsname je Projekt, z. B. "entries" oder "gnoien_entries"
const sammlung = name => db.collection(PROJEKTE[zustand.projekt].prefix + name);

let abmelder = [];

// Live-Verbindung zu den Daten des aktuellen Projekts starten.
// onAenderung wird bei jeder Änderung aufgerufen (auch von anderen Geräten).
export function datenAbonnieren(onAenderung, onFehler) {
  datenAbbestellen();
  abmelder.push(sammlung('entries').orderBy('id', 'desc').onSnapshot(snap => {
    zustand.eintraege = snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
    onAenderung('eintraege');
  }, onFehler));
  abmelder.push(sammlung('seasons').orderBy('label', 'desc').onSnapshot(snap => {
    zustand.saisonsDb = snap.docs.map(d => d.data().label);
    onAenderung('saisons');
  }, () => {}));
}

export function datenAbbestellen() {
  abmelder.forEach(fn => fn());
  abmelder = [];
}

// Welche Projekte darf der Nutzer sehen? (Firestore: users/{email}.projekte)
export async function ladeFreigaben(email) {
  try {
    const doc = await db.collection('users').doc((email || '').toLowerCase()).get();
    const liste = doc.exists && Array.isArray(doc.data().projekte) ? doc.data().projekte : [];
    return liste.filter(p => PROJEKTE[p]);
  } catch (e) {
    console.error(e);
    return [];
  }
}

export const eintragAnlegen = eintrag => sammlung('entries').add(eintrag);
export const eintragAendern = (docId, felder) => sammlung('entries').doc(docId).update(felder);
export const eintragLoeschen = docId => sammlung('entries').doc(docId).delete();
export const saisonAnlegen = label => sammlung('seasons').add({ label });
