// ═══════════════════════════════════════════════════════════════
//  STRECKE – Liste der Abschüsse der gewählten Saison mit Filtern
// ═══════════════════════════════════════════════════════════════
import { zustand } from './daten.js';
import { eintraegeDerSaison } from './saison.js';
import { $, esc, datumDE, eindeutig, optionenHTML, fotoAnzeigen } from './oberflaeche.js';
import { bearbeitenOeffnen } from './formular.js';

const FILTER = [
  { id: 'filter-wild', feld: 'wildart', alle: 'Alle Wildarten' },
  { id: 'filter-revier', feld: 'revier', alle: 'Alle Reviere' },
  { id: 'filter-erleger', feld: 'erleger', alle: 'Alle Erleger' },
];

export function streckeEinrichten() {
  FILTER.forEach(f => $(f.id).addEventListener('change', listeZeichnen));
  // Klicks auf Bearbeiten / Foto in der Liste
  $('liste-content').addEventListener('click', ev => {
    const btn = ev.target.closest('[data-aktion]');
    if (!btn) return;
    const e = zustand.eintraege.find(x => x._docId === btn.dataset.id);
    if (!e) return;
    if (btn.dataset.aktion === 'bearbeiten') bearbeitenOeffnen(e._docId);
    if (btn.dataset.aktion === 'foto' && e.photo) fotoAnzeigen(e.photo);
  });
}

// Filter-Auswahl an die Saison anpassen (gewählte Werte bleiben, wenn möglich)
export function filterAktualisieren() {
  const eintraege = eintraegeDerSaison(zustand.saison);
  FILTER.forEach(f => {
    const sel = $(f.id), bisher = sel.value, werte = eindeutig(eintraege, f.feld);
    sel.innerHTML = optionenHTML(werte, f.alle);
    if (werte.includes(bisher)) sel.value = bisher;
  });
}

export function listeZeichnen() {
  let eintraege = eintraegeDerSaison(zustand.saison);
  FILTER.forEach(f => {
    const wert = $(f.id).value;
    if (wert) eintraege = eintraege.filter(e => e[f.feld] === wert);
  });

  const el = $('liste-content');
  if (!eintraege.length) {
    el.innerHTML = '<div class="empty">Keine Einträge für diese Auswahl.</div>';
    return;
  }
  el.innerHTML = eintraege.map(eintragHTML).join('');
}

function eintragHTML(e) {
  const pills = [
    e.geschlecht && `<span class="pill">${esc(e.geschlecht)}</span>`,
    e.ak !== '' && e.ak != null && `<span class="pill">AK ${esc(e.ak)}</span>`,
    e.gewicht && `<span class="pill green">${parseFloat(e.gewicht).toFixed(1)} kg</span>`,
    e.marke && `<span class="pill">Nr. ${esc(e.marke)}</span>`,
  ].filter(Boolean).join('');

  return `
    <div class="list-item">
      <div class="list-top">
        <span class="list-wildart">${esc(e.wildart || '–')}</span>
        <div class="list-right">
          <span class="list-date">${datumDE(e.datum)}</span>
          <button type="button" class="icon-btn" data-aktion="bearbeiten" data-id="${esc(e._docId)}" title="Bearbeiten">✏️</button>
        </div>
      </div>
      <div class="list-meta">${pills}</div>
      ${e.revier ? `<div class="list-revier">📍 ${esc(e.revier)}</div>` : ''}
      ${e.erleger ? `<div class="list-erleger">👤 ${esc(e.erleger)}</div>` : ''}
      ${e.anmerkung ? `<div class="list-anm">${esc(e.anmerkung)}</div>` : ''}
      ${e.photo ? `<div class="photo-link" data-aktion="foto" data-id="${esc(e._docId)}">📷 Foto ansehen</div>` : ''}
    </div>`;
}
