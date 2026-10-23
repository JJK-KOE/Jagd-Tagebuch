// ═══════════════════════════════════════════════════════════════
//  STATISTIK – Gesamtstrecke, Wildart × Revier und pro Erleger
// ═══════════════════════════════════════════════════════════════
import { zustand } from './daten.js';
import { eintraegeDerSaison } from './saison.js';
import { $, esc, eindeutig } from './oberflaeche.js';

// Zählt, wie oft jeder Wert eines Feldes vorkommt → [[wert, anzahl], …] absteigend
function zaehle(liste, feld) {
  const z = {};
  liste.forEach(e => { if (e[feld]) z[e[feld]] = (z[e[feld]] || 0) + 1; });
  return Object.entries(z).sort((a, b) => b[1] - a[1]);
}

// Balkendiagramm aus [[bezeichnung, anzahl], …]
function balken(paare) {
  const max = Math.max(...paare.map(p => p[1]), 1);
  return paare.map(([name, n]) => `
    <div class="bar-row">
      <div class="bar-lbl">${esc(name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(n / max * 100)}%"></div></div>
      <div class="bar-n">${n}</div>
    </div>`).join('');
}

const block = (titel, anzahl, inhalt) => `
  <div class="sub-section">
    <div class="sub-title">${titel} <span class="sub-count">— ${anzahl} gesamt</span></div>
    ${inhalt}
  </div>`;

export function statistikZeichnen() {
  const eintraege = eintraegeDerSaison(zustand.saison);
  const el = $('stats-content');
  if (!eintraege.length) {
    el.innerHTML = '<div class="empty">Keine Daten für diese Saison.</div>';
    return;
  }

  const proWildart = eindeutig(eintraege, 'wildart').map(w => {
    const teil = eintraege.filter(e => e.wildart === w);
    return block(esc(w), teil.length, balken(zaehle(teil, 'revier')));
  }).join('');

  const proErleger = eindeutig(eintraege, 'erleger').map(name => {
    const teil = eintraege.filter(e => e.erleger === name);
    return block('👤 ' + esc(name), teil.length, balken(zaehle(teil, 'wildart')));
  }).join('');

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card stat-card-breit">
        <div class="stat-label">Gesamtstrecke Saison ${esc(zustand.saison)}</div>
        <div class="stat-value">${eintraege.length}</div>
      </div>
    </div>
    <div class="chart-section">
      <div class="chart-title">Strecke nach Wildart & Revier</div>
      ${proWildart}
    </div>
    <div class="chart-section">
      <div class="chart-title">Statistik pro Erleger</div>
      ${proErleger}
    </div>`;
}
