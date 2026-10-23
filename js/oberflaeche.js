// ═══════════════════════════════════════════════════════════════
//  OBERFLÄCHE – kleine Helfer, die überall gebraucht werden:
//  Tabs, Meldungen, Statusanzeige, Foto-Ansicht, "Neue Abschüsse"-Banner
// ═══════════════════════════════════════════════════════════════

export const $ = id => document.getElementById(id);

// Text sicher in HTML einsetzen (verhindert, dass Eingaben als Code laufen)
export const esc = v => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// "2026-09-11" → "11.09.2026"
export function datumDE(d) {
  if (!d) return '–';
  const t = d.split('-');
  return t.length === 3 ? `${t[2]}.${t[1]}.${t[0]}` : d;
}

export const heute = () => new Date().toISOString().split('T')[0];

// Liste eindeutiger, sortierter Werte eines Feldes
export const eindeutig = (liste, feld) =>
  [...new Set(liste.map(e => e[feld]).filter(Boolean))].sort();

export function optionenHTML(werte, leertext) {
  const leer = leertext !== undefined ? `<option value="">${esc(leertext)}</option>` : '';
  return leer + werte.map(w => `<option value="${esc(w)}">${esc(w)}</option>`).join('');
}

// Grüne/rote Meldung oben im Erfassen-Tab
export function zeigeMeldung(typ, text) {
  const el = $('toast-' + typ);
  if (!el) return;
  el.textContent = text || '';
  el.style.display = 'block';
  setTimeout(() => (el.style.display = 'none'), 3000);
}

export function setzeStatus(online) {
  const el = $('sync-status');
  el.textContent = online ? '● Synchronisiert' : '○ Offline';
  el.style.color = online ? 'var(--green-text)' : 'var(--red-text)';
}

// Tabs umschalten; onWechsel(tab) erlaubt dem Aufrufer, Inhalte neu zu zeichnen
export function tabsEinrichten(onWechsel) {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn));
      document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
      onWechsel(tab);
    });
  });
}

// Foto groß anzeigen
export function fotoAnzeigen(src) {
  const overlay = document.createElement('div');
  overlay.className = 'foto-overlay';
  overlay.innerHTML = '<img alt="Foto Wildmarke" /><button type="button">✕</button>';
  overlay.querySelector('img').src = src;
  overlay.addEventListener('click', ev => {
    if (ev.target === overlay || ev.target.tagName === 'BUTTON') overlay.remove();
  });
  document.body.appendChild(overlay);
}

// ── "Neue Abschüsse"-Hinweis ────────────────────────────────────
// Merkt sich pro Projekt, wann die App zuletzt geöffnet war, und zeigt
// einmalig einen Hinweis, wenn seitdem Einträge dazugekommen sind.
let hinweisGezeigt = false;
export const hinweisZuruecksetzen = () => (hinweisGezeigt = false);

export function neueEintraegePruefen(projekt, eintraege) {
  if (hinweisGezeigt) return;
  // Kavelstorf behält den alten Schlüssel, damit der Stand erhalten bleibt
  const schluessel = projekt === 'kavelstorf' ? 'jagd_last_seen' : 'jagd_last_seen_' + projekt;
  let zuletzt = 0;
  try { zuletzt = parseInt(localStorage.getItem(schluessel) || '0', 10); } catch (e) { return; }
  const neue = zuletzt ? eintraege.filter(e => e.id > zuletzt).length : 0;
  if (neue > 0) {
    hinweisGezeigt = true;
    zeigeBanner(neue === 1 ? '🦌 1 neuer Abschuss eingetragen!' : `🦌 ${neue} neue Abschüsse eingetragen!`);
  }
  try { localStorage.setItem(schluessel, Date.now().toString()); } catch (e) { /* egal */ }
}

function zeigeBanner(text) {
  const banner = document.createElement('div');
  banner.className = 'banner';
  banner.innerHTML = `<span>${esc(text)}</span><button type="button">✕</button>`;
  banner.querySelector('button').addEventListener('click', () => banner.remove());
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 5000);
}
