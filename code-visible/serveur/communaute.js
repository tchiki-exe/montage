// Monnet en ligne : le COMPTE de l'utilisateur et les SONS PARTAGÉS (« Communauté »).
// Monnet sert d'intermédiaire avec le serveur en ligne (voir Monnet-communaute/serveur.js) :
//  - compte : e-mail + mot de passe + nom unique, ou « Continuer avec Google » ; la session (un jeton) est gardée
//    dans reglages.json → communaute ; le mot de passe n'est jamais gardé sur le PC ;
//  - sons : il faut être connecté pour partager ; Monnet convertit le son (Ogg Opus, 30 s au plus) et l'envoie,
//    télécharge ceux des autres et les garde en cache.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { RACINE, PROGRAMMES, executer, lireJson, ecrireJson } = require('./outils');

// Adresse du serveur en ligne (sur le petit VPS de Lucas, derrière Caddy ; MONNET_COMMUNAUTE pour les essais)
const ADRESSE = 'https://141-11-103-42.sslip.io';
// « Continuer avec Google » : identifiants d'une application « Bureau » créée dans la console Google Cloud de Lucas.
// (Pour une application installée, Google indique que ce « secret » n'en est pas vraiment un : il peut être livré.)
const GOOGLE_ID = process.env.MONNET_GOOGLE_ID || '';
const GOOGLE_SECRET = process.env.MONNET_GOOGLE_SECRET || '';
const FICHIER_REGLAGES = path.join(RACINE, 'reglages.json');
const CACHE = path.join(RACINE, 'bruitages', 'communaute');
const CATEGORIES = ['whoosh', 'impacts', 'basses', 'montees', 'transitions', 'glitch', 'ui', 'jeu', 'droles', 'percus', 'ambiance', 'voix', 'musique', 'autre'];

function adresse() {
  return String(process.env.MONNET_COMMUNAUTE || lireJson(path.join(RACINE, 'version.json'), {}).communaute || ADRESSE || '').replace(/\/+$/, '');
}

// ---------- Session locale ----------

function sessionLocale() {
  const c = lireJson(FICHIER_REGLAGES, {}).communaute || {};
  return c.session ? c : null;
}
function ecrireSession(s) {
  const r = lireJson(FICHIER_REGLAGES, {});
  r.communaute = s ? { session: s.session, compte: s.compte } : {};
  ecrireJson(FICHIER_REGLAGES, r);
}
function majProfil(compte) {
  const s = sessionLocale();
  if (s) ecrireSession({ session: s.session, compte });
}
const auth = () => { const s = sessionLocale(); return s ? { Authorization: 'Bearer ' + s.session } : {}; };

// ---------- Appels au serveur en ligne ----------

async function appeler(chemin, options = {}, delai = 10000) {
  const base = adresse();
  if (!base) throw Object.assign(new Error('Monnet en ligne n\'est pas disponible.'), { horsLigne: true });
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), delai);
  try {
    return await fetch(base + chemin, { ...options, signal: ctrl.signal, headers: { 'User-Agent': 'Monnet', ...(options.headers || {}) } });
  } catch (e) {
    throw Object.assign(new Error('Serveur de Monnet injoignable (pas d\'internet ?)'), { horsLigne: true });
  } finally { clearTimeout(minuterie); }
}
async function json(r) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.erreur || `Erreur ${r.status}`), { code: r.status, infos: d });
  return d;
}
const corpsJson = obj => ({ method: 'POST', body: JSON.stringify(obj), headers: { 'Content-Type': 'application/json' } });
// Les refus « normaux » (nom pris, mauvais mot de passe…) sont renvoyés à l'interface sans erreur serveur
async function essayer(fn) {
  try { return await fn(); } catch (e) {
    if (e.code && e.code < 500) return { ok: false, erreur: e.message, ...(e.infos || {}) };
    throw e;
  }
}

// ---------- Compte ----------

async function etat() {
  const s = sessionLocale();
  let enLigne = true;
  if (s) {
    try {
      const r = await appeler('/moi', { headers: auth() }, 6000);
      if (r.status === 401) ecrireSession(null); // session effacée (compte supprimé ou déconnecté ailleurs)
      else if (r.ok) majProfil((await r.json()).compte);
    } catch (_) { enLigne = false; }
  }
  const l = sessionLocale();
  return { connecte: !!l, compte: l ? l.compte : null, google: !!GOOGLE_ID, enLigne };
}

function ouvrir(d) { ecrireSession({ session: d.session, compte: d.compte }); return { ok: true, compte: d.compte }; }

function creer({ email, motDePasse, nom, code }) {
  return essayer(async () => ouvrir(await json(await appeler('/comptes', corpsJson({ email, motDePasse, nom, code })))));
}
function connecter({ identifiant, motDePasse }) {
  return essayer(async () => ouvrir(await json(await appeler('/connexion', corpsJson({ identifiant, motDePasse })))));
}
async function deconnecter() {
  try { await appeler('/deconnexion', { method: 'POST', headers: auth() }, 5000); } catch (_) { /* hors ligne : on oublie quand même */ }
  ecrireSession(null);
  return { ok: true };
}
function supprimer({ motDePasse, confirmation }) {
  return essayer(async () => {
    await json(await appeler('/moi', { method: 'DELETE', body: JSON.stringify({ motDePasse, confirmation }), headers: { 'Content-Type': 'application/json', ...auth() } }));
    ecrireSession(null);
    return { ok: true };
  });
}
async function nomLibre(nom) {
  try { return await json(await appeler('/noms/libre?nom=' + encodeURIComponent(nom), {}, 5000)); } catch (e) { return { libre: null }; }
}

// ---------- « Continuer avec Google » (fenêtre Google, retour sur ce PC : http://127.0.0.1:<port>/google/retour) ----------

const googleEnCours = new Map(); // état → { verificateur, redirection, fini, resultat, idToken, quand }

function debutGoogle(port) {
  if (!GOOGLE_ID) throw new Error('La connexion Google n\'est pas encore activée');
  for (const [k, v] of googleEnCours) if (Date.now() - v.quand > 15 * 60000) googleEnCours.delete(k);
  const etatG = crypto.randomBytes(16).toString('hex');
  const verificateur = crypto.randomBytes(32).toString('base64url');
  const defi = crypto.createHash('sha256').update(verificateur).digest('base64url');
  const redirection = `http://127.0.0.1:${port}/google/retour`;
  googleEnCours.set(etatG, { verificateur, redirection, fini: false, resultat: null, idToken: null, quand: Date.now() });
  const p = new URLSearchParams({
    client_id: GOOGLE_ID, redirect_uri: redirection, response_type: 'code', scope: 'openid email profile',
    code_challenge: defi, code_challenge_method: 'S256', state: etatG, prompt: 'select_account',
  });
  return { url: 'https://accounts.google.com/o/oauth2/v2/auth?' + p, etat: etatG };
}

async function envoyerJetonGoogle(g, extra = {}) {
  const d = await essayer(async () => json(await appeler('/connexion/google', corpsJson({ idToken: g.idToken, ...extra }))));
  if (d.session) { ouvrir(d); g.resultat = { ok: true, compte: d.compte }; } else g.resultat = { ok: false, ...d };
  g.fini = true;
  return g.resultat;
}

// Google revient sur ce PC avec un code : on l'échange contre le jeton d'identité, que le serveur en ligne vérifie.
async function retourGoogle(code, etatG, erreur) {
  const g = googleEnCours.get(String(etatG || ''));
  if (!g) return 'Cette connexion a expiré : recommence depuis Monnet.';
  if (erreur || !code) { g.fini = true; g.resultat = { ok: false, erreur: 'Connexion Google annulée' }; return 'Connexion annulée. Tu peux fermer cette fenêtre.'; }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, code_verifier: g.verificateur, grant_type: 'authorization_code', redirect_uri: g.redirection }),
    });
    const d = await r.json();
    if (!d.id_token) throw new Error(d.error_description || d.error || 'Google n\'a pas répondu');
    g.idToken = d.id_token;
    const res = await envoyerJetonGoogle(g);
    if (res.ok) return `Connecté en tant que ${res.compte.nom} ! Tu peux fermer cette fenêtre et revenir dans Monnet.`;
    if (res.besoinNom || res.lierMotDePasse) return 'Presque fini : retourne dans Monnet pour terminer.';
    return 'Connexion impossible : ' + res.erreur;
  } catch (e) {
    g.fini = true; g.resultat = { ok: false, erreur: e.message };
    return 'Connexion impossible : ' + e.message;
  }
}
function etatGoogle(etatG) {
  const g = googleEnCours.get(String(etatG || ''));
  if (!g) return { fini: true, ok: false, erreur: 'Connexion expirée : recommence' };
  return { fini: g.fini, ...(g.resultat || {}) };
}
// Suite : choisir son nom (nouveau compte), ou relier Google à son compte existant (avec son mot de passe)
async function suiteGoogle(etatG, { nom, code, motDePasse }) {
  const g = googleEnCours.get(String(etatG || ''));
  if (!g || !g.idToken) return { ok: false, erreur: 'Connexion expirée : recommence' };
  return envoyerJetonGoogle(g, { nom, code, motDePasse });
}

// ---------- Sons partagés ----------

async function liste(tri = 'recents') {
  const moi = sessionLocale();
  try {
    const d = await json(await appeler(`/sons?tri=${tri === 'populaires' ? 'populaires' : 'recents'}`));
    return {
      disponible: true, compte: moi ? moi.compte : null,
      sons: d.sons.map(s => ({
        id: 'commu-' + s.id, nom: s.nom, cat: 'communaute', sousCat: s.cat, pseudo: s.pseudo, duree: s.duree, pics: s.pics,
        telechargements: s.telechargements, quand: s.quand, communaute: true, mien: !!(moi && s.compte && s.compte === moi.compte.id),
        mots: `${s.pseudo} ${s.cat}`,
      })),
    };
  } catch (e) {
    return { disponible: false, raison: e.message, compte: moi ? moi.compte : null, sons: [] };
  }
}

// Fichier d'un son partagé (téléchargé une fois, puis gardé sur le PC)
async function fichier(idComplet) {
  const id = String(idComplet).replace(/^commu-/, '');
  if (!/^[a-z0-9]{12}$/.test(id)) return null;
  fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, id + '.ogg');
  const infos = path.join(CACHE, id + '.json');
  if (!fs.existsSync(f)) {
    const r = await appeler(`/sons/${id}.ogg`, {}, 30000);
    if (!r.ok) return null;
    fs.writeFileSync(f + '.tmp', Buffer.from(await r.arrayBuffer()));
    fs.renameSync(f + '.tmp', f);
  }
  let nom = lireJson(infos, {}).nom;
  if (!nom) {
    try { const l = await liste(); const s = l.sons.find(x => x.id === 'commu-' + id); if (s) { nom = `${s.nom} (${s.pseudo})`; ecrireJson(infos, { nom }); } } catch (_) { /* rien */ }
  }
  return { chemin: f, nom: nom || 'Son partagé ' + id, ext: '.ogg' };
}

// Partage d'un des « Mes sons » sous le nom du compte : conversion en Ogg Opus puis envoi
async function partager({ chemin, nom, cat }) {
  if (!sessionLocale()) throw new Error('Connecte-toi à ton compte Monnet pour partager un son.');
  if (!chemin || !fs.existsSync(chemin)) throw new Error('Son introuvable');
  nom = String(nom || '').trim().replace(/\s+/g, ' ');
  if (nom.length < 2 || nom.length > 40) throw new Error('Donne un nom à ton son (2 à 40 caractères)');
  if (!CATEGORIES.includes(cat)) cat = 'autre';
  const tmp = path.join(CACHE, `.envoi-${Date.now()}.ogg`);
  fs.mkdirSync(CACHE, { recursive: true });
  try {
    const r = await executer(PROGRAMMES.ffmpeg, ['-v', 'error', '-y', '-i', chemin, '-vn', '-t', '30', '-ac', '2', '-ar', '48000', '-c:a', 'libopus', '-b:a', '96k', tmp], { delai: 120000 });
    if (r.code !== 0) throw new Error('Son illisible');
    const dec = await executer(PROGRAMMES.ffmpeg, ['-v', 'error', '-i', tmp, '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1'], { binaire: true, delai: 60000 });
    const x = new Float32Array(new Uint8Array(dec.sortie).buffer, 0, Math.floor(dec.sortie.length / 4));
    const duree = x.length / 8000;
    if (duree < 0.05) throw new Error('Son vide');
    const pics = [];
    let max = 0;
    for (let b = 0; b < 48; b++) {
      let m = 0;
      for (let i = Math.floor(b * x.length / 48); i < Math.floor((b + 1) * x.length / 48); i++) m = Math.max(m, Math.abs(x[i]));
      pics.push(m); max = Math.max(max, m);
    }
    const rep = await appeler('/sons', {
      method: 'POST', body: fs.readFileSync(tmp),
      headers: {
        'Content-Type': 'audio/ogg', 'X-Nom': encodeURIComponent(nom), 'X-Categorie': cat, ...auth(),
        'X-Duree': String(Math.round(duree * 1000) / 1000), 'X-Pics': encodeURIComponent(JSON.stringify(pics.map(v => Math.round(v / (max || 1) * 100) / 100))),
      },
    }, 60000);
    if (rep.status === 401) { ecrireSession(null); throw new Error('Ta session a expiré : reconnecte-toi.'); }
    return (await json(rep)).son;
  } finally { fs.rmSync(tmp, { force: true }); }
}

async function retirer(idComplet) {
  const id = String(idComplet).replace(/^commu-/, '');
  await json(await appeler(`/sons/${id}`, { method: 'DELETE', headers: auth() }));
  return { ok: true };
}

async function signaler(idComplet) {
  const id = String(idComplet).replace(/^commu-/, '');
  return json(await appeler(`/sons/${id}/signaler`, { method: 'POST' }));
}

module.exports = {
  etat, creer, connecter, deconnecter, supprimer, nomLibre, debutGoogle, retourGoogle, etatGoogle, suiteGoogle,
  liste, fichier, partager, retirer, signaler, adresse, CATEGORIES,
};
