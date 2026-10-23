// ═══════════════════════════════════════════════════════════════
//  EXPORT – CSV für Excel (Semikolon + UTF-8-BOM, damit Umlaute stimmen)
// ═══════════════════════════════════════════════════════════════
import { PROJEKTE } from './config.js';
import { zustand } from './daten.js';
import { saisonVon, eintraegeDerSaison } from './saison.js';
import { $ } from './oberflaeche.js';

const SPALTEN = [
  ['Saison', e => saisonVon(e.datum)],
  ['Datum', e => e.datum],
  ['Wildart', e => e.wildart],
  ['Wildmarkennummer', e => e.marke],
  ['Geschlecht', e => e.geschlecht],
  ['Gewicht (kg)', e => e.gewicht],
  ['Altersklasse (AK)', e => e.ak],
  ['Revier', e => e.revier],
  ['Erleger', e => e.erleger],
  ['Anmerkung', e => e.anmerkung],
];

const zelle = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function exportEinrichten() {
  $('btn-export').addEventListener('click', csvHerunterladen);
}

function csvHerunterladen() {
  const saison = $('export-season-select').value || zustand.saison;
  const eintraege = eintraegeDerSaison(saison);
  if (!eintraege.length) return alert('Keine Einträge für diese Saison.');

  const zeilen = [
    SPALTEN.map(s => s[0]).join(';'),
    ...eintraege.map(e => SPALTEN.map(s => zelle(s[1](e))).join(';')),
  ];
  const blob = new Blob(['﻿' + zeilen.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Jagd_Strecke_${PROJEKTE[zustand.projekt].name}_${saison.replace('/', '_')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
