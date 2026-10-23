// ═══════════════════════════════════════════════════════════════
//  ZENTRALE EINSTELLUNGEN
//  Neue Reviere, Projekte oder Auswahlwerte werden NUR hier gepflegt.
// ═══════════════════════════════════════════════════════════════

// Verbindung zum Firebase-Projekt "jagd-tagebuch".
// Diese Werte sind öffentlich (stehen in jeder Firebase-Web-App) –
// geschützt wird über Login + Firestore-Regeln (firebase/firestore.rules).
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDjpox0VLVHz0ztv7IsCuCxp9fgqXTQQTo',
  authDomain: 'jagd-tagebuch.firebaseapp.com',
  projectId: 'jagd-tagebuch',
  storageBucket: 'jagd-tagebuch.firebasestorage.app',
  messagingSenderId: '797083613111',
  appId: '1:797083613111:web:f607fd434fe0f946a91a32',
};

// Projekte (getrennte Datenbestände).
//  - Schlüssel (z. B. "gnoien") = Kennung in Firestore users/{email}.projekte
//  - prefix = Vorsatz für die Sammlungsnamen (Kavelstorf nutzt die alten Namen ohne Vorsatz)
//  - Neues Projekt: hier eintragen UND in firebase/firestore.rules freigeben.
export const PROJEKTE = {
  kavelstorf: {
    name: 'Kavelstorf',
    titel: 'Strecke Kavelstorf',
    prefix: '',
    reviere: ['GJB Kavelstorf III', 'Jahning'],
  },
  gnoien: {
    name: 'Gnoien',
    titel: 'Strecke Gnoien',
    prefix: 'gnoien_',
    reviere: ['Gnoien'],
  },
};

// Auswahlwerte für Erfassen und Bearbeiten
export const WILDARTEN = ['Schwarzwild', 'Rotwild', 'Rehwild'];
export const GESCHLECHTER = ['Männlich', 'Weiblich'];
export const ALTERSKLASSEN = ['0', '1', '2', '3', '4'];

// Jagdjahr beginnt am 1. April
export const SAISON_STARTMONAT = 4;
