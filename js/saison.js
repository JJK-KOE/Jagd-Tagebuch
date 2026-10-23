// ═══════════════════════════════════════════════════════════════
//  SAISON – Jagdjahr-Logik (1. April bis 31. März) und Saisonauswahl
// ═══════════════════════════════════════════════════════════════
import { SAISON_STARTMONAT } from './config.js';
import { zustand, saisonAnlegen } from './daten.js';
import { $, zeigeMeldung } from './oberflaeche.js';

// "2026-10-23" → "2026/2027"
export function saisonVon(datum) {
  if (!datum) return null;
  const d = new Date(datum), j = d.getFullYear();
  return d.getMonth() + 1 >= SAISON_STARTMONAT ? `${j}/${j + 1}` : `${j - 1}/${j}`;
}

export const aktuelleSaison = () => saisonVon(new Date().toISOString().slice(0, 10));

export const eintraegeDerSaison = saison =>
  zustand.eintraege.filter(e => saisonVon(e.datum) === saison);

// Alle bekannten Saisons: angelegte + aus Einträgen + aktuelle, neueste zuerst
export function alleSaisons() {
  const ausEintraegen = zustand.eintraege.map(e => saisonVon(e.datum)).filter(Boolean);
  return [...new Set([...zustand.saisonsDb, ...ausEintraegen, aktuelleSaison()])].sort().reverse();
}

// Saison-Auswahl oben und im Export neu aufbauen (Auswahl bleibt erhalten)
export function saisonAuswahlAktualisieren() {
  const saisons = alleSaisons();
  const optionen = saisons.map(s => `<option value="${s}">Saison ${s}</option>`).join('');

  const oben = $('season-select');
  const bisher = zustand.saison || aktuelleSaison();
  oben.innerHTML = optionen;
  zustand.saison = saisons.includes(bisher) ? bisher : saisons[0];
  oben.value = zustand.saison;
  $('season-badge').textContent = zustand.saison;

  const exp = $('export-season-select');
  const expBisher = exp.value;
  exp.innerHTML = optionen;
  if (saisons.includes(expBisher)) exp.value = expBisher;
}

export async function neueSaisonAnlegen() {
  const eingabe = prompt('Neue Jagdsaison (Format: JJJJ/JJJJ, z.B. 2025/2026):');
  if (!eingabe) return;
  const label = eingabe.trim();
  if (!/^\d{4}\/\d{4}$/.test(label)) {
    alert('Bitte Format JJJJ/JJJJ verwenden, z.B. 2025/2026');
    return;
  }
  try {
    await saisonAnlegen(label);
    zeigeMeldung('success', `✓ Saison ${label} hinzugefügt!`);
  } catch (e) {
    zeigeMeldung('error', 'Fehler: ' + e.message);
  }
}
