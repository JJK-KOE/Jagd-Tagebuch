// ═══════════════════════════════════════════════════════════════
//  ANMELDUNG – Login, Passwort vergessen, Abmelden
//  Zugänge werden in der Firebase-Konsole angelegt (Selbstregistrierung ist aus).
// ═══════════════════════════════════════════════════════════════
import { auth, ladeFreigaben } from './daten.js';
import { $ } from './oberflaeche.js';

function meldung(text, typ) {
  $('login-msg').className = 'login-msg ' + (typ || '');
  $('login-msg').textContent = text || '';
}

// onAngemeldet(email, projekte) und onAbgemeldet() kommen aus main.js
export function anmeldungEinrichten({ onAngemeldet, onAbgemeldet }) {
  $('login-form').addEventListener('submit', anmelden);
  $('btn-passwort-vergessen').addEventListener('click', passwortVergessen);
  $('logout-btn').addEventListener('click', () => auth.signOut());

  auth.onAuthStateChanged(async user => {
    if (!user) {
      $('login-overlay').hidden = false;
      onAbgemeldet();
      return;
    }
    const projekte = await ladeFreigaben(user.email);
    if (!projekte.length) {
      meldung(`Für ${user.email} ist noch kein Projekt freigeschaltet. Bitte bei Jakob melden.`, 'err');
      auth.signOut();
      return;
    }
    $('login-overlay').hidden = true;
    onAngemeldet(user.email, projekte);
  });
}

async function anmelden(ev) {
  ev.preventDefault();
  const btn = $('login-submit');
  meldung('');
  btn.disabled = true;
  try {
    await auth.signInWithEmailAndPassword($('login-email').value.trim(), $('login-pw').value);
    $('login-pw').value = '';
  } catch (e) {
    meldung(e.code === 'auth/too-many-requests'
      ? 'Zu viele Versuche. Bitte kurz warten.'
      : 'E-Mail oder Passwort falsch.', 'err');
  } finally {
    btn.disabled = false;
  }
}

async function passwortVergessen() {
  const email = $('login-email').value.trim();
  if (!email) return meldung('Bitte zuerst die E-Mail eintragen.', 'err');
  try { await auth.sendPasswordResetEmail(email); } catch (e) { /* bewusst keine Details */ }
  meldung('Falls ein Zugang existiert, wurde eine E-Mail zum Zurücksetzen verschickt.', 'ok');
}
